"""Normal-only polar trials; no promotion or original/selected-asset writes."""

import argparse
import json
from pathlib import Path
import sys
import warnings

import numpy as np
import rasterio
from rasterio.errors import NotGeoreferencedWarning

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from artifact_store import artifact_root
from pipeline import RECIPES, REPOSITORY, digest, load_height, verify_sources, write_image
from diagnostic.probe_poles import normal_cap_light, write
from polar_normals import variants


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact-root", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    root, output = artifact_root(args.artifact_root), args.output.resolve()
    if output.exists() or output.is_relative_to(REPOSITORY) or root.is_relative_to(output):
        raise ValueError("Use a new external output, not an artifact-root ancestor")
    output.mkdir(parents=True)
    report = {"experimental": True, "promoted": False, "parameters": {
        "capStartDegrees": 85, "geodesicFullWeightDegrees": 87,
        "transitionZeroSlopeDegrees": 90, "physicalStepRadians": "pi / tier normal height",
        "sourceSampling": "bilinear pixel centers; U periodic; V edge clamp",
        "outerRows": "retain neutral RGB8 convention",
    }, "outputs": []}
    for body in ["luna", "mars"]:
        recipe = RECIPES[body]
        verify_sources(body, root / "sources" / body)
        heights = load_height(body, root / "sources" / body)
        folder = REPOSITORY / "assets" / "sol-textures" / recipe.get("baselineVersion", recipe["version"])
        for tier in ["low", "standard"]:
            selected = folder / f"{body}-{tier}-normal.png"
            with rasterio.open(selected) as file:
                baseline = file.read()
            latitude = 90 - (np.arange(baseline.shape[1])+0.5)*180/baseline.shape[1]
            for variant, image in variants(heights, baseline, recipe["radius"]).items():
                name = f"{body}-{tier}-{variant}-normal.png"
                path = output / name
                decoded = write_image(path, image, "PNG")
                if not np.array_equal(decoded, image):
                    raise ValueError("Lossless decode mismatch")
                if not np.array_equal(image[:, np.abs(latitude) <= 85], baseline[:, np.abs(latitude) <= 85]):
                    raise ValueError("Changed non-polar pixels")
                preview = folder / f"{body}-preview-albedo.jpg"
                albedo = folder / f"{body}-{tier}-albedo.jpg"
                transfer = preview.stat().st_size + albedo.stat().st_size + path.stat().st_size
                report["outputs"].append({
                    "body": body, "tier": tier, "variant": variant, "file": name,
                    "sha256": digest(path), "bytes": path.stat().st_size,
                    "baselineSha256": digest(selected), "albedoSha256": digest(albedo),
                    "selectedTransferBytes": transfer, "transferCapPassed": transfer <= (2 if tier == "low" else 4)*1024**2,
                    "outsideCapByteIdentical": True,
                })
                for pole, north in [("north", True), ("south", False)]:
                    write(output / f"{body}-{tier}-{variant}-{pole}-cpu.png", normal_cap_light(image, north))
    (output / "experiment-manifest.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("PASS: 8 normal-only experiments verified; selected assets unchanged; inspect budgets in manifest")


if __name__ == "__main__":
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", category=NotGeoreferencedWarning)
        main()
