"""Prepare local paired landmark annotations; never infer terrain from brightness."""

import argparse
import json
from pathlib import Path
import subprocess
import sys
import warnings

import numpy as np
import rasterio
from rasterio.errors import NotGeoreferencedWarning

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from pipeline import (
    RECIPES, REPOSITORY, digest, earth_elevation, load_height, normal_map,
    require, resize, source_records, variants, verify_outputs, verify_sources,
)
from prepare_landmarks import crop_color, write


def residual(albedo, relief, bounds, dimensions):
    """Return east/north and Euclidean normal-texel displacement."""
    west, south, east, north = bounds
    require(east > west and north > south, "Invalid geographic bounds")
    require(all(0 <= value <= 1 for point in [albedo, relief] for value in point),
            "Annotation coordinates must be normalized to the image")
    longitude = (relief[0] - albedo[0]) * (east - west)
    latitude = (albedo[1] - relief[1]) * (north - south)
    x = longitude * dimensions[0] / 360
    y = latitude * dimensions[1] / 180
    return {"eastDegrees": longitude, "northDegrees": latitude,
            "eastNormalTexels": x, "northNormalTexels": y,
            "distanceNormalTexels": float(np.hypot(x, y))}


def verify_normal_recipe(body, sources, selected):
    recipe = RECIPES[body]
    if body == "earth":
        summed, fraction = earth_elevation(sources)
    else:
        elevation = load_height(body, sources)
    checks = []
    for tier, (width, height) in [("low", [1024, 512]), ("standard", recipe["normalStandard"])]:
        land = None
        if body == "earth":
            weighted, coverage = resize(summed, width, height), resize(fraction, width, height)
            heights = np.divide(weighted, coverage, out=np.zeros_like(weighted), where=coverage > 0)
            land = coverage >= 1 - 1e-6
        else:
            heights = resize(elevation, width, height)
        expected, _ = normal_map(heights, recipe["radius"], land)
        if recipe.get("polarTreatment") == "geodesic":
            expected = variants(elevation, expected, recipe["radius"])["geodesic"]
        file = selected / f"{recipe['prefix']}-{tier}-normal.png"
        with rasterio.open(file) as image:
            delivered = image.read()
        require(np.array_equal(delivered, expected), f"Normal recipe/grid mismatch: {file}")
        checks.append({"tier": tier, "dimensions": [width, height], "file": file.name,
                       "sha256": digest(file), "allDecodedSamplesMatchSourceRecipe": True})
    return checks


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    store, output = args.artifact_root.resolve(), args.output.resolve()
    require(not output.is_relative_to(REPOSITORY), "Review output must stay outside repository")
    require(output.is_relative_to(store / "work"), "Review output must be in the artifact store work directory")
    require(not output.exists(), "Refusing to overwrite existing review evidence")
    checks = {}
    for body, recipe in RECIPES.items():
        sources = store / "sources" / body
        selected = REPOSITORY / "assets" / "sol-textures" / recipe["version"]
        verify_sources(body, sources)
        verify_outputs(selected)
        checks[body] = verify_normal_recipe(body, sources, selected)
    output.mkdir(parents=True)
    subprocess.run([sys.executable, str(Path(__file__).with_name("prepare_landmarks.py")),
                    "--artifact-root", str(store), "--output", str(output / "source")], check=True)
    regions = json.loads((output / "source" / "index.json").read_text())
    for entry in regions:
        body = entry["body"]
        recipe = RECIPES[body]
        selected = REPOSITORY / "assets" / "sol-textures" / recipe["version"]
        entry["assetVersion"] = recipe["version"]
        entry["normalChecks"] = checks[body]
        entry["sourceRelief"] = f"source/{entry['prefix']}-hillshade.png"
        entry["sourceOverlay"] = f"source/{entry['prefix']}-overlay.png"
        entry["tiers"] = {}
        for check in checks[body]:
            tier = check["tier"]
            filename = f"{entry['prefix']}-{tier}-albedo.png"
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", NotGeoreferencedWarning)
                image = crop_color(selected / f"{recipe['prefix']}-{tier}-albedo.jpg", entry["boundsDegrees"])
            write(output / filename, image)
            entry["tiers"][tier] = {
                "albedo": filename, "normalDimensions": check["dimensions"],
                "normalTexelDegrees": 360 / check["dimensions"][0],
            }
    evidence = {
        "schemaVersion": 1, "evidenceId": output.name, "normalTexelTolerance": 1,
        "scope": "Local non-polar albedo/source-elevation registration; not final Viewer appearance",
        "method": "Human paired homologous-feature annotations; no brightness correlation fit",
        "sources": {body: source_records(body) for body in RECIPES},
        "tools": {"python": sys.version, "numpy": np.__version__, "rasterio": rasterio.__version__,
                  "gdal": rasterio.__gdal_version__, "scriptSha256": digest(Path(__file__)),
                  "templateSha256": digest(Path(__file__).with_name("registration-review.html"))},
        "limitations": [
            "Source hillshade uses display-only 8x exaggeration; runtime normals remain unchanged.",
            "Earth coastal normal suppression is intentional and is not a coastline displacement.",
            "Mars MDIM/MOLA local differences are not corrected by a universal longitude shift.",
            "Hellas haze, lunar rays, snow/ice and vegetation need not follow elevation contours.",
            "One pair is a landmark sample, not proof of global or sub-texel registration.",
            "Polar boundaries/detail loss and final Stellar Viewer visual acceptance remain open.",
        ],
        "regions": regions,
    }
    (output / "review-data.js").write_text("const evidence = " + json.dumps(evidence) + ";\n", encoding="utf-8")
    template = Path(__file__).with_name("registration-review.html")
    (output / "index.html").write_bytes(template.read_bytes())
    files = sorted(file for file in output.rglob("*") if file.is_file())
    (output / "evidence-inventory.json").write_text(json.dumps({
        "files": [{"file": str(file.relative_to(output)), "bytes": file.stat().st_size, "sha256": digest(file)}
                  for file in files],
        "normalChecks": checks,
    }, indent=2), encoding="utf-8")
    print(f"Prepared {len(regions)} landmark regions; six delivered normal grids match their source recipes.")
    print(f"Review output: {output}")
    print("No annotations yet; registration gate remains OPEN.")


if __name__ == "__main__":
    main()
