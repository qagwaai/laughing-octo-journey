import argparse
import gzip
import json
import math
import pathlib
import warnings
import sys

import numpy as np
import rasterio
from affine import Affine
from rasterio.enums import Resampling
from rasterio.errors import NotGeoreferencedWarning
from rasterio.transform import from_bounds
from rasterio.warp import reproject
from rasterio.windows import from_bounds as window_from_bounds, Window

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from pipeline import verify_sources
from artifact_store import artifact_root

ROOT = pathlib.Path(__file__).resolve().parent
SIZE = 512
REGIONS = {
    "earth": [
        ("California coast", -122, 37, 10),
        ("Andes coast", -72, -23, 10),
        ("Himalayan plateau", 86, 30, 10),
    ],
    "luna": [
        ("Tycho", -11.36, -43.31, 8),
        ("Copernicus", -20.08, 9.62, 8),
        ("Mare Crisium", 59.1, 17, 16),
    ],
    "mars": [
        ("Olympus Mons", -133.8, 18.65, 12),
        ("Valles Marineris", -70, -12, 16),
        ("Hellas", 70, -42, 24),
    ],
}


def warp(array, transform, bounds, nodata=None):
    target = np.full((SIZE, SIZE), np.nan, dtype=np.float32)
    reproject(
        source=array.astype(np.float32), destination=target,
        src_transform=transform, src_crs="EPSG:4326", src_nodata=nodata,
        dst_transform=from_bounds(*bounds, SIZE, SIZE), dst_crs="EPSG:4326",
        dst_nodata=np.nan, resampling=Resampling.bilinear,
    )
    return target


def crop_color(path, bounds, mars=False):
    with rasterio.open(path) as image:
        if mars:
            scale = 180 / (math.pi * 3396190)
            transform = Affine(image.transform.a * scale, 0, image.transform.c * scale,
                               0, image.transform.e * scale, image.transform.f * scale)
        elif image.crs:
            transform = image.transform
        else:
            transform = from_bounds(-180, -90, 180, 90, image.width, image.height)
        floating = window_from_bounds(*bounds, transform=transform)
        # Include a full interpolation footprint; rounded lengths can omit target-edge cells.
        left = max(0, math.floor(floating.col_off) - 1)
        top = max(0, math.floor(floating.row_off) - 1)
        right = min(image.width, math.ceil(floating.col_off + floating.width) + 1)
        bottom = min(image.height, math.ceil(floating.row_off + floating.height) + 1)
        window = Window(left, top, right - left, bottom - top)
        array = image.read(window=window)
        origin = transform @ Affine.translation(window.col_off, window.row_off)
        result = np.stack([warp(channel, origin, bounds) for channel in array])
        assert np.isfinite(result).all()
        if array.dtype == np.uint16:
            result = result / 257
        return np.clip(np.rint(result), 0, 255).astype(np.uint8)


def earth_height(bounds, sources):
    west, south, east, north = bounds
    result = np.full((SIZE, SIZE), np.nan, dtype=np.float32)
    for index, letter in enumerate("abcdefghijklmnop"):
        tile_west = -180 + (index % 4) * 90
        tile_east = tile_west + 90
        tile_north = [90, 50, 0, -50][index // 4]
        tile_south = [50, 0, -50, -90][index // 4]
        if east <= tile_west or west >= tile_east or north <= tile_south or south >= tile_north:
            continue
        row_start = max(0, math.floor((tile_north - north) * 120) - 1)
        rows = min(int((tile_north - tile_south) * 120), math.ceil((tile_north - south) * 120) + 1) - row_start
        col_start = max(0, math.floor((west - tile_west) * 120) - 1)
        col_end = min(10800, math.ceil((east - tile_west) * 120) + 1)
        with gzip.open(sources / (letter + "10g.gz"), "rb") as source:
            source.seek(row_start * 10800 * 2)
            array = np.frombuffer(source.read(rows * 10800 * 2), dtype="<i2").reshape(rows, 10800)[:, col_start:col_end]
        transform = Affine(1 / 120, 0, tile_west + col_start / 120,
                           0, -1 / 120, tile_north - row_start / 120)
        part = warp(array, transform, bounds, -500)
        valid = np.isfinite(part)
        result[valid] = part[valid]
    return result


def write(path, image):
    with rasterio.open(path, "w", driver="PNG", width=SIZE, height=SIZE, count=3,
                       dtype="uint8", ZLEVEL=6) as output:
        output.write(image)


def main():
    parser = argparse.ArgumentParser(description="Create common-grid landmark diagnostics, not runtime textures.")
    for body in REGIONS:
        parser.add_argument("--" + body + "-sources", type=pathlib.Path)
    parser.add_argument("--artifact-root", type=pathlib.Path)
    parser.add_argument("--output", required=True, type=pathlib.Path)
    args = parser.parse_args()
    output = args.output.resolve()
    supplied = [getattr(args, body + "_sources") for body in REGIONS]
    if any(supplied) and (not all(supplied) or args.artifact_root):
        parser.error("Use --artifact-root or all three explicit source paths, not a mixture")
    store = artifact_root(args.artifact_root) if not all(supplied) else None
    sources = {body: getattr(args, body + "_sources").resolve() if all(supplied)
               else store / "sources" / body for body in REGIONS}
    if output.exists():
        raise FileExistsError(output)
    for body, directory in sources.items():
        verify_sources(body, directory)
    output.mkdir(parents=True)
    with rasterio.open(sources["luna"] / "ldem_16_uint.tif") as source:
        lunar = (source.read(1).astype(np.float32) - 20000) * 0.5
    martian = np.roll(np.fromfile(sources["mars"] / "megt90n000eb.img",
                                 dtype=">i2").reshape(2880, 5760).astype(np.float32), 2880, axis=1)
    colors = {
        "earth": sources["earth"] / "world.200407.3x5400x2700_geo.tif",
        "luna": sources["luna"] / "lroc_color_16bit_srgb_4k.tif",
        "mars": sources["mars"] / "Mars_Viking_ClrMosaic_global_925m.tif",
    }
    entries = []
    for body, regions in REGIONS.items():
        for index, (name, longitude, latitude, span) in enumerate(regions):
            bounds = [longitude - span / 2, latitude - span / 2, longitude + span / 2, latitude + span / 2]
            color = crop_color(colors[body], bounds, body == "mars")
            if body == "earth":
                elevation = earth_height(bounds, sources["earth"])
            else:
                array = lunar if body == "luna" else martian
                elevation = warp(array, from_bounds(-180, -90, 180, 90, array.shape[1], array.shape[0]), bounds)
            valid = np.isfinite(elevation)
            filled = np.where(valid, elevation, 0)
            dy, dx = np.gradient(filled)
            # Display-only exaggerated hillshade exposes morphology; not a runtime normal derivative.
            radius = {"earth": 6371000, "luna": 1737400, "mars": 3396000}[body]
            scale = radius * math.radians(span) / SIZE
            nx = -dx * 8 / (scale * math.cos(math.radians(latitude)))
            ny = dy * 8 / scale
            length = np.sqrt(nx * nx + ny * ny + 1)
            shade = np.clip(((-nx + ny + 1) / (length * math.sqrt(3))) * 0.75 + 0.2, 0, 1)
            gray = np.rint(shade * 255).astype(np.uint8)
            hill = np.stack([gray, gray, gray])
            hill[:, ~valid] = np.array([20, 40, 70])[:, None]
            interval = 1000 if body != "earth" else 500
            bands = np.floor(filled / interval)
            edge = np.zeros_like(valid)
            edge[1:] |= (bands[1:] != bands[:-1]) & valid[1:] & valid[:-1]
            edge[:, 1:] |= (bands[:, 1:] != bands[:, :-1]) & valid[:, 1:] & valid[:, :-1]
            coast = np.zeros_like(valid)
            coast[1:] |= valid[1:] != valid[:-1]
            coast[:, 1:] |= valid[:, 1:] != valid[:, :-1]
            overlay = color.copy()
            overlay[:, edge] = np.array([0, 255, 255])[:, None]
            overlay[:, coast] = np.array([255, 255, 0])[:, None]
            prefix = f"{body}-{index}"
            for suffix, image in [("color", color), ("hillshade", hill), ("overlay", overlay)]:
                write(output / (prefix + "-" + suffix + ".png"), image)
            entries.append({
                "body": body, "name": name, "boundsDegrees": bounds, "prefix": prefix,
                "contourIntervalMetres": interval, "displayHillshadeExaggeration": 8,
                "minMetres": float(elevation[valid].min()), "maxMetres": float(elevation[valid].max()),
                "note": "Identical grid crops; cyan elevation contours, yellow DEM land/ocean boundary. Alignment review, not automatic correction.",
            })
    (output / "index.json").write_text(json.dumps(entries, indent=2), encoding="utf-8")
    print("Prepared", len(entries), "paired landmark sets; 8x diagnostic hillshade only, originals unchanged.")


if __name__ == "__main__":
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", category=NotGeoreferencedWarning)
        main()
