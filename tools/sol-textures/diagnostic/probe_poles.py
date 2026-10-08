"""Inspect original/candidate polar samples without rewriting any selected asset."""

import argparse
import json
import math
from pathlib import Path
import sys
import warnings

import numpy as np
import rasterio
from rasterio.errors import NotGeoreferencedWarning
from rasterio.windows import Window

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from artifact_store import artifact_root
from pipeline import RECIPES, REPOSITORY, load_height, normal_map, resize, verify_sources


def row_statistics(array, count=8):
    return [{"row": row, "min": float(array[row].min()), "max": float(array[row].max()),
             "std": float(array[row].std()),
             "longitudeAdjacentRms": float(np.sqrt(np.mean((array[row] - np.roll(array[row], 1)) ** 2)))}
            for row in range(count)]


def polar_image(array, north, latitude_limit=85, size=512):
    y, x = np.mgrid[-1:1:complex(size), -1:1:complex(size)]
    radius = np.sqrt(x * x + y * y)
    latitude = 90 - radius * (90 - latitude_limit)
    longitude = np.arctan2(x, -y) * 180 / math.pi
    if not north:
        latitude = -latitude
    rows = np.clip(np.floor((90 - latitude) / 180 * array.shape[1]).astype(int), 0, array.shape[1] - 1)
    cols = np.mod(np.floor((longitude + 180) / 360 * array.shape[2]).astype(int), array.shape[2])
    image = array[:, rows, cols].copy()
    image[:, radius > 1] = 0
    return image


def write(path, image):
    with rasterio.open(path, "w", driver="PNG", width=image.shape[2], height=image.shape[1],
                       count=3, dtype="uint8") as file:
        file.write(image)


def normal_cap_light(encoded, north, size=512):
    """Rotate physical tangent normals to world axes without Three derivative tangents."""
    cap = polar_image(encoded, north, size=size).astype(np.float64) / 255 * 2 - 1
    y, x = np.mgrid[-1:1:complex(size), -1:1:complex(size)]
    radius = np.sqrt(x*x + y*y)
    longitude = np.arctan2(x, -y)
    latitude = np.radians(90 - radius*5) * (1 if north else -1)
    east = np.stack([-np.sin(longitude), np.cos(longitude), np.zeros_like(x)])
    north_axis = np.stack([-np.sin(latitude)*np.cos(longitude),
                           -np.sin(latitude)*np.sin(longitude), np.cos(latitude)])
    radial = np.stack([np.cos(latitude)*np.cos(longitude),
                       np.cos(latitude)*np.sin(longitude), np.sin(latitude)])
    world = east*cap[0] + north_axis*cap[1] + radial*cap[2]
    world /= np.linalg.norm(world, axis=0)
    light = np.array([-0.4, -0.4, 1 if north else -1])
    light /= np.linalg.norm(light)
    value = np.clip(0.15 + 0.75*np.sum(world*light[:, None, None], axis=0), 0, 1)
    image = np.repeat(np.rint(value[None]*255).astype(np.uint8), 3, axis=0)
    image[:, radius > 1] = 0
    return image


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact-root", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    root, output = artifact_root(args.artifact_root), args.output.resolve()
    if output.exists():
        raise FileExistsError(output)
    if output.is_relative_to(REPOSITORY):
        raise ValueError("Diagnostic evidence must stay outside repository")
    output.mkdir(parents=True)
    report = {}
    for body in ["luna", "mars"]:
        recipe = RECIPES[body]
        sources = root / "sources" / body
        verify_sources(body, sources)
        heights = load_height(body, sources)
        width, height = recipe["normalStandard"]
        reduced = resize(heights, width, height)
        entries = {}
        with rasterio.open(sources / recipe["color"]) as source, rasterio.open(
            REPOSITORY / "assets" / "sol-textures" / recipe.get("baselineVersion", recipe["version"]) / f"{body}-standard-albedo.jpg"
        ) as candidate:
            for pole, north in [("north", True), ("south", False)]:
                # Read only source polar strips; retain each raster's actual sampling for this diagnostic.
                source_rows = math.ceil(source.height * 5 / 180)
                start = 0 if north else source.height - source_rows
                rgb = source.read(window=Window(0, start, source.width, source_rows))
                if rgb.dtype == np.uint16:
                    rgb = np.rint(rgb.astype(np.float32) / 257).astype(np.uint8)
                # Project the original strip directly, without Three UVs or normal mapping.
                y, x = np.mgrid[-1:1:512j, -1:1:512j]
                radius = np.sqrt(x*x + y*y)
                longitude = np.arctan2(x, -y)
                rows = np.clip((radius * source_rows).astype(int), 0, source_rows - 1)
                if not north:
                    rows = source_rows - 1 - rows
                cols = np.mod(((longitude + math.pi) / (2*math.pi)*source.width).astype(int), source.width)
                source_cap = rgb[:, rows, cols]
                source_cap[:, radius > 1] = 0
                write(output / f"{body}-{pole}-original-color-cap.png", source_cap)
                write(output / f"{body}-{pole}-candidate-color-cap.png", polar_image(candidate.read(), north))
                ordered = heights if north else heights[::-1]
                reduced_ordered = reduced if north else reduced[::-1]
                entries[pole] = {"originalHeightRows": row_statistics(ordered),
                                 "resampledHeightRows": row_statistics(reduced_ordered),
                                 "originalColorFirstRowChannelStd": rgb[:, 0 if north else -1].std(axis=1).tolist()}
        with rasterio.open(REPOSITORY / "assets" / "sol-textures" / recipe.get("baselineVersion", recipe["version"]) /
                           f"{body}-standard-normal.png") as file:
            normal = file.read()
        original_normal, _ = normal_map(heights, recipe["radius"])
        for pole, north in [("north", True), ("south", False)]:
            write(output / f"{body}-{pole}-original-dem-cpu-relief.png", normal_cap_light(original_normal, north))
            write(output / f"{body}-{pole}-candidate-cpu-relief.png", normal_cap_light(normal, north))
        entries["normalNearPoleTiltDegrees"] = {}
        for pole, data in [("north", normal), ("south", normal[:, ::-1])]:
            vector = data.astype(np.float64) / 255 * 2 - 1
            angle = np.degrees(np.arctan2(np.sqrt(vector[0] ** 2 + vector[1] ** 2), vector[2]))
            entries["normalNearPoleTiltDegrees"][pole] = [
                {"row": row, "median": float(np.median(angle[row])), "max": float(angle[row].max())}
                for row in range(8)]
        report[body] = entries
    report["limitations"] = [
        "Polar nearest projection is diagnostic, not a replacement derivative",
        "Mars original-color strip projection uses nominal latitude sampling only; small affine extent offsets not corrected",
        "Row variation is evidence of longitude dependence, not proof of invented source detail or a scientifically exact pole",
        "CPU relief uses the existing physical-slope recipe on original resolution and nearest sampling; independent world tangent axes and fixed lighting, not a pixel match to Three",
    ]
    (output / "source-pole-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("PASS: original/candidate polar caps and height/normal statistics saved; selected maps unchanged")


if __name__ == "__main__":
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", category=NotGeoreferencedWarning)
        main()
