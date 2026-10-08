"""Local, hash-verified reconstruction of the approved October 2026 pilot."""

import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path
import platform
import urllib.request
import warnings

import numpy as np
import rasterio
from affine import Affine
from rasterio.enums import Resampling
from rasterio.errors import NotGeoreferencedWarning
from rasterio.transform import from_bounds
from rasterio.warp import reproject
from rasterio.windows import Window
from artifact_store import artifact_root
from polar_normals import variants

ROOT = Path(__file__).resolve().parent
REPOSITORY = ROOT.parent.parent
MIB = 1024 * 1024
RECIPES = {
    "earth": {"version": "earth-july-v2", "prefix": "earth-july", "radius": 6371000,
              "color": "world.200407.3x5400x2700_geo.tif", "normalStandard": [2048, 1024],
              "qualityStandard": 98},
    "luna": {"version": "luna-v3", "baselineVersion": "luna-v2", "polarTreatment": "geodesic",
             "prefix": "luna", "radius": 1737400,
             "color": "lroc_color_16bit_srgb_4k.tif", "height": "ldem_16_uint.tif",
             "normalStandard": [1024, 512], "qualityStandard": 95},
    "mars": {"version": "mars-v2", "baselineVersion": "mars-v1", "polarTreatment": "geodesic",
             "prefix": "mars", "radius": 3396000,
             "color": "Mars_Viking_ClrMosaic_global_925m.tif", "height": "megt90n000eb.img",
             "normalStandard": [2048, 1024], "qualityStandard": 98},
}
LUNA_REFERENCE = {
    "file": "LDEM_16.IMG", "bytes": 33177600,
    "sha256": "a511e40d7a3ea3275945b4da2a1df377133264fab0be94b7434b1cf8907254cb",
    "url": "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_16.img",
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def source_records(body, include_notices=False):
    manifest = json.loads((ROOT / "source-manifests" / (body + ".json")).read_text())
    recipe = RECIPES[body]
    names = {recipe["color"]}
    if body == "earth":
        names.update(letter + "10g.gz" for letter in "abcdefghijklmnop")
    else:
        names.add(recipe["height"])
    selected = [entry for entry in manifest["files"] if include_notices or entry["file"] in names]
    require(names.issubset({entry["file"] for entry in selected}), "Incomplete source manifest")
    return selected + ([LUNA_REFERENCE] if body == "luna" else [])


def verify_sources(body, directory):
    for entry in source_records(body):
        path = Path(directory) / entry["file"]
        require(path.stat().st_size == entry["bytes"], f"Source byte count: {path}")
        require(digest(path) == entry["sha256"], f"Source hash mismatch: {path}; do not silently adopt changed downloads")


def fetch_sources(body, directory, include_notices=False):
    require(not directory.is_relative_to(REPOSITORY), "Originals must remain outside repository")
    directory.mkdir(parents=True, exist_ok=True)
    for entry in source_records(body, include_notices=include_notices):
        path = directory / entry["file"]
        if path.exists():
            require(path.stat().st_size == entry["bytes"] and digest(path) == entry["sha256"], f"Existing source mismatch: {path}")
            print("Verified existing source:", path.name)
            continue
        partial = path.with_name(path.name + ".partial")
        request = urllib.request.Request(entry["url"], headers={"Cache-Control": "no-cache, no-store", "Pragma": "no-cache"})
        # Failed downloads stay explicitly .partial; reruns refuse to overwrite them.
        with partial.open("xb") as output, urllib.request.urlopen(request, timeout=120) as response:
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
        require(partial.stat().st_size == entry["bytes"] and digest(partial) == entry["sha256"],
                f"Downloaded source changed: {partial}; fresh source/rights review required")
        partial.rename(path)
        print("Acquired and verified:", path.name)


def srgb_to_linear(values):
    return np.where(values <= 0.04045, values / 12.92, ((values + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(values):
    return np.where(values <= 0.0031308, values * 12.92, 1.055 * values ** (1 / 2.4) - 0.055)


def resize(array, width, height):
    result = np.empty((height, width), dtype=np.float32)
    reproject(source=array.astype(np.float32), destination=result,
              src_transform=from_bounds(-180, -90, 180, 90, array.shape[1], array.shape[0]),
              dst_transform=from_bounds(-180, -90, 180, 90, width, height),
              src_crs="EPSG:4326", dst_crs="EPSG:4326", resampling=Resampling.average)
    return result


def normal_map(heights, radius, land=None):
    height, width = heights.shape
    latitude = math.pi / 2 - (np.arange(height) + 0.5) * math.pi / height
    east_distance = radius * (2 * math.pi / width)
    north_distance = radius * math.pi / height
    east = (np.roll(heights, -1, axis=1) - np.roll(heights, 1, axis=1)) / (
        2 * east_distance * np.cos(latitude)[:, None])
    south = np.zeros_like(heights)
    south[1:-1] = (heights[2:] - heights[:-2]) / (2 * north_distance)
    safe = np.ones_like(heights, dtype=bool)
    if land is not None:
        safe &= land & np.roll(land, -1, axis=1) & np.roll(land, 1, axis=1)
        safe[1:-1] &= land[:-2] & land[2:]
    safe[0] = False
    safe[-1] = False
    vector = np.stack([-east, south, np.ones_like(heights)])
    vector[:, ~safe] = np.array([0, 0, 1])[:, None]
    vector /= np.linalg.norm(vector, axis=0)
    return np.rint((vector * 0.5 + 0.5) * 255).astype(np.uint8), safe


def png_chunks(path):
    chunks = []
    with Path(path).open("rb") as stream:
        require(stream.read(8) == b"\x89PNG\r\n\x1a\n", "PNG signature")
        while True:
            size = stream.read(4)
            require(len(size) == 4, "Truncated PNG")
            length = int.from_bytes(size, "big")
            kind = stream.read(4).decode("ascii")
            chunks.append(kind)
            stream.seek(length + 4, 1)
            if kind == "IEND":
                break
    require(not any(kind in chunks for kind in ["sRGB", "gAMA", "iCCP"]), "Normal has display-color metadata")
    return chunks


def write_image(path, image, driver, **options):
    require(not path.exists(), f"Refusing to overwrite {path}")
    with rasterio.open(path, "w", driver=driver, width=image.shape[2], height=image.shape[1],
                       count=3, dtype="uint8", **options) as output:
        output.write(image)
    with rasterio.open(path) as output:
        decoded = output.read()
        require(decoded.shape == image.shape and output.dtypes == ("uint8",) * 3, "Output decode")
    return decoded


def earth_elevation(directory):
    summed = np.empty((1080, 2160), dtype=np.float32)
    fraction = np.empty_like(summed)
    for index, letter in enumerate("abcdefghijklmnop"):
        rows = 4800 if index < 4 or index >= 12 else 6000
        row0 = [0, 240, 540, 840][index // 4]
        col0 = index % 4 * 540
        with gzip.open(directory / (letter + "10g.gz"), "rb") as source:
            for block in range(rows // 20):
                chunk = source.read(20 * 10800 * 2)
                require(len(chunk) == 20 * 10800 * 2, "Truncated GLOBE tile")
                values = np.frombuffer(chunk, dtype="<i2").reshape(20, 540, 20)
                valid = values != -500
                summed[row0 + block, col0:col0 + 540] = np.where(valid, values, 0).sum(
                    axis=(0, 2), dtype=np.float64) / 400
                fraction[row0 + block, col0:col0 + 540] = valid.mean(axis=(0, 2))
            require(source.read(1) == b"", "Unexpected GLOBE payload size")
    return summed, fraction


def load_height(body, directory):
    if body == "luna":
        with rasterio.open(directory / RECIPES[body]["height"]) as source:
            unsigned = source.read(1)
        reference = np.fromfile(directory / LUNA_REFERENCE["file"], dtype="<i2").reshape(2880, 5760)
        require(np.array_equal(unsigned.astype(np.int32),
                               np.roll(reference.astype(np.int32), 2880, axis=1) + 20000), "LOLA reference correspondence")
        height = (unsigned.astype(np.float32) - 20000) * 0.5
        require((height.min(), height.max()) == (-8981.5, 10685.5), "LOLA height range")
        return height
    raw = np.fromfile(directory / RECIPES[body]["height"], dtype=">i2").reshape(2880, 5760)
    require((raw.min(), raw.max()) == (-8177, 21171) and np.count_nonzero(raw == 0) == 2128, "MOLA heights/zero cells")
    return np.roll(raw.astype(np.float32), 2880, axis=1)


def mars_color_working(directory, path):
    require(not path.exists(), f"Working file exists: {path}")
    with rasterio.open(directory / RECIPES["mars"]["color"]) as source:
        scale = 180 / (math.pi * 3396190)
        transform = Affine(source.transform.a * scale, 0, source.transform.c * scale,
                           0, source.transform.e * scale, source.transform.f * scale)
        with rasterio.open(path, "w", driver="GTiff", width=source.width, height=source.height,
                           count=3, dtype="float32", crs="EPSG:4326", transform=transform,
                           tiled=True, blockxsize=256, blockysize=256, BIGTIFF="IF_SAFER") as working:
            for row in range(0, source.height, 128):
                window = Window(0, row, source.width, min(128, source.height - row))
                rgb = source.read(window=window)
                require(np.all(rgb[:, :, 0] == 0) and np.all(rgb[:, :, 1:] > 0), "Viking nodata layout changed")
                rgb[:, :, 0] = rgb[:, :, 1]
                working.write(srgb_to_linear(rgb.astype(np.float32) / 255), window=window)


def budgets(products, prefix):
    result = {}
    for tier, cap, resident_cap in [("low", 2, 32), ("standard", 4, 96)]:
        names = [f"{prefix}-preview-albedo.jpg", f"{prefix}-{tier}-albedo.jpg", f"{prefix}-{tier}-normal.png"]
        transfer = sum(products[name]["bytes"] for name in names)
        resident = sum(math.ceil(width * height * 4 * 4 / 3)
                       for width, height in [products[name]["dimensions"] for name in names])
        require(transfer <= cap * MIB, f"{tier} transfer exceeded {cap} MiB; request a new quality decision")
        require(resident <= resident_cap * MIB, f"{tier} residency estimate exceeded {resident_cap} MiB")
        result[tier] = {"files": names, "transferBytesIncludingPreview": transfer, "transferCapMiB": cap,
                        "estimatedRgba8MipmappedBytes": resident, "residentCapMiB": resident_cap}
    return result


def verify_outputs(directory, comparison=None):
    manifest = json.loads((directory / "derivative-manifest.json").read_text())
    require({file.name for file in directory.iterdir()} == {*manifest["products"], "derivative-manifest.json"},
            "Output contains unexpected originals/intermediates or missing maps")
    for name, entry in manifest["products"].items():
        file = directory / name
        require(file.stat().st_size == entry["bytes"] and digest(file) == entry["sha256"], f"Output hash/bytes: {file}")
        with rasterio.open(file) as image:
            require([image.width, image.height] == entry["dimensions"] and image.dtypes == ("uint8",) * 3, "Output shape/type")
            decoded = image.read()
        if name.endswith(".png"):
            png_chunks(file)
            require(np.all(decoded[:, 0] == np.array([128, 128, 255])[:, None]) and
                    np.all(decoded[:, -1] == np.array([128, 128, 255])[:, None]), "Pole normals")
    prefix = next(name.removesuffix("-preview-albedo.jpg") for name in manifest["products"] if "-preview-albedo.jpg" in name)
    require(budgets(manifest["products"], prefix) == manifest["budgets"], "Recorded budget mismatch")
    if comparison:
        previous = json.loads((comparison / "derivative-manifest.json").read_text())
        require(manifest["products"].keys() == previous["products"].keys(), "Comparison filenames differ")
        for name, entry in manifest["products"].items():
            require(entry["sha256"] == previous["products"][name]["sha256"], f"Rebuild differs: {name}")
    print("PASS: persisted maps, full decodes, hashes, budgets" + (" and byte-identical rebuild" if comparison else ""))


def prepare(body, source_dir, output, work_dir):
    recipe = RECIPES[body]
    verify_sources(body, source_dir)
    require(not output.exists(), f"Refusing overwrite: {output}; choose a new version")
    require(not source_dir.is_relative_to(REPOSITORY), "Originals must remain outside repository")
    require(not output.is_relative_to(source_dir) and not source_dir.is_relative_to(output),
            "Output and original source directories must be separate")
    require(not work_dir.resolve().is_relative_to(REPOSITORY), "Working directory must be outside repository")
    output.mkdir(parents=True)
    work_dir.mkdir(parents=True, exist_ok=True)
    temporary = work_dir / "viking-linear-working.tif"
    products = {}
    if body == "mars":
        mars_color_working(source_dir, temporary)
        linear = None
    else:
        with rasterio.open(source_dir / recipe["color"]) as source:
            array = source.read()
        linear = srgb_to_linear(array.astype(np.float32) / (65535 if body == "luna" else 255))
    for tier, width, height in [("preview", 512, 256), ("low", 2048, 1024), ("standard", 4096, 2048)]:
        if body == "mars":
            filtered = np.full((3, height, width), np.nan, dtype=np.float32)
            with rasterio.open(temporary) as working:
                for band in range(1, 4):
                    reproject(source=rasterio.band(working, band), destination=filtered[band - 1],
                              src_transform=working.transform, src_crs=working.crs,
                              dst_transform=from_bounds(-180, -90, 180, 90, width, height),
                              dst_crs="EPSG:4326", dst_nodata=np.nan, resampling=Resampling.average)
            require(np.isfinite(filtered).all() and np.all(filtered > 0), "Missing color cells")
        else:
            filtered = np.stack([resize(channel, width, height) for channel in linear])
        rgb = np.rint(linear_to_srgb(np.clip(filtered, 0, 1)) * 255).astype(np.uint8)
        path = output / f"{recipe['prefix']}-{tier}-albedo.jpg"
        quality = recipe["qualityStandard"] if tier == "standard" else 98
        decoded = write_image(path, rgb, "JPEG", QUALITY=quality, PROGRESSIVE="YES")
        mse = float(np.mean((decoded.astype(np.float64) - rgb) ** 2))
        products[path.name] = {"dimensions": [width, height], "bytes": path.stat().st_size, "sha256": digest(path),
                               "colorSpace": "sRGB (source ICC verified)" if body == "luna" else "sRGB display assumption; source has no ICC",
                               "jpegQuality": quality, "psnrDbVersusResampledRgb": 10 * math.log10(255 * 255 / mse)}
    if body == "mars":
        temporary.unlink()
    if body == "earth":
        summed, fraction = earth_elevation(source_dir)
    else:
        elevation = load_height(body, source_dir)
    for tier, (width, height) in [("low", [1024, 512]), ("standard", recipe["normalStandard"])]:
        land = None
        if body == "earth":
            weighted, coverage = resize(summed, width, height), resize(fraction, width, height)
            heights = np.divide(weighted, coverage, out=np.zeros_like(weighted), where=coverage > 0)
            land = coverage >= 1 - 1e-6
        else:
            heights = resize(elevation, width, height)
        image, safe = normal_map(heights, recipe["radius"], land)
        if recipe.get("polarTreatment") == "geodesic":
            image = variants(elevation, image, recipe["radius"])["geodesic"]
        path = output / f"{recipe['prefix']}-{tier}-normal.png"
        options = {} if recipe.get("polarTreatment") == "geodesic" else {"ZLEVEL": 9}
        require(np.array_equal(write_image(path, image, "PNG", **options), image), "PNG not lossless")
        require(np.all(image[:, ~safe] == np.array([128, 128, 255])[:, None]), "Non-neutral masked normals")
        products[path.name] = {"dimensions": [width, height], "bytes": path.stat().st_size,
                               "sha256": digest(path), "pngChunks": png_chunks(path),
                               "colorSpace": "NoColorSpace (linear data)", "reliefExaggeration": 1,
                               "referenceRadiusMetres": recipe["radius"], "poleRowsNeutral": True,
                               "longitudeGradient": "periodic"}
    # Preserve audited rights/interpretation when making an exact-source new version.
    previous = REPOSITORY / "assets" / "sol-textures" / recipe.get("baselineVersion", recipe["version"]) / "derivative-manifest.json"
    provenance = json.loads(previous.read_text())["provenance"].copy()
    provenance["sourceAudit"] = "docs/sol-textures-2026-10-08.md"
    provenance["sourceAuditBase"] = "repository"
    provenance["sources"] = source_records(body)
    provenance["processingScriptSha256"] = digest(Path(__file__))
    provenance["recipe"] = recipe
    if recipe.get("polarTreatment") == "geodesic":
        provenance["polarRecipeScriptSha256"] = digest(ROOT / "polar_normals.py")
        provenance["normal"] = (
            f"Physical slopes at radius {recipe['radius']} m, no exaggeration; red=-east, green=-north; "
            "baseline periodic longitude gradient outside +/-85 degrees; original-DEM spherical "
            "equal-distance neighbors with step pi/normalHeight, bilinear pixel-center sampling "
            "U periodic/V clamped; smoothstep slope blend 85..87 degrees; neutral outer rows; no ocean mask")
        provenance["polarAcceptance"] = {
            "date": "2026-10-08", "variant": "geodesic", "scope": "current low/standard polar normal appearance",
            "baselineVersion": recipe["baselineVersion"],
            "evidence": "artifact-root work/polar-normal-experiments-v1 and work/polar-normal-render-comparison-v1",
            "limitations": "Accepted despite unfinished boundary/detail-loss review; source albedo pinching persists; "
                            "fine registration unproven; final Stellar Viewer acceptance remains on hold",
        }
    manifest = {"tools": {"python": platform.python_version(), "rasterio": rasterio.__version__,
                          "gdal": rasterio.__gdal_version__, "numpy": np.__version__},
                "products": products, "budgets": budgets(products, recipe["prefix"]), "provenance": provenance}
    (output / "derivative-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    verify_outputs(output)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    build = sub.add_parser("prepare")
    build.add_argument("body", choices=RECIPES)
    sources = build.add_mutually_exclusive_group()
    sources.add_argument("--source-dir", type=Path)
    sources.add_argument("--artifact-root", type=Path)
    build.add_argument("--output", required=True, type=Path)
    build.add_argument("--work-dir", type=Path)
    fetch = sub.add_parser("fetch", help="Explicitly download approved, hash-pinned raster originals")
    fetch.add_argument("body", choices=RECIPES)
    sources = fetch.add_mutually_exclusive_group()
    sources.add_argument("--source-dir", type=Path)
    sources.add_argument("--artifact-root", type=Path)
    fetch.add_argument("--include-notices", action="store_true",
                       help="Also restore hash-pinned historical notice pages/labels; changed web pages fail")
    check = sub.add_parser("verify")
    check.add_argument("--output", required=True, type=Path)
    check.add_argument("--compare", type=Path)
    args = parser.parse_args()
    if args.command in ("prepare", "fetch"):
        store = artifact_root(args.artifact_root) if not args.source_dir else None
        directory = args.source_dir.resolve() if args.source_dir else store / "sources" / args.body
    if args.command == "prepare":
        if not args.work_dir and store is None:
            parser.error("--work-dir is required with --source-dir")
        work = args.work_dir.resolve() if args.work_dir else store / "work" / args.body
        prepare(args.body, directory, args.output.resolve(), work)
    elif args.command == "fetch":
        fetch_sources(args.body, directory, include_notices=args.include_notices)
    else:
        verify_outputs(args.output.resolve(), args.compare.resolve() if args.compare else None)


if __name__ == "__main__":
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", category=NotGeoreferencedWarning)
        main()
