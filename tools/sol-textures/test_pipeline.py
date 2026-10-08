import json
import importlib.util
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_bounds

from pipeline import RECIPES, budgets, fetch_sources, normal_map, png_chunks, require, source_records, srgb_to_linear, linear_to_srgb, verify_sources


class PipelineTests(unittest.TestCase):
    def test_normal_directions_for_every_radius(self):
        east = np.tile(np.arange(16, dtype=np.float32), (8, 1)) * 100000
        south = np.tile(np.arange(8, dtype=np.float32)[:, None], (1, 16)) * 100000
        for recipe in RECIPES.values():
            with self.subTest(radius=recipe["radius"]):
                self.assertLess(normal_map(east, recipe["radius"])[0][0, 3, 5], 128)
                self.assertGreater(normal_map(south, recipe["radius"])[0][1, 3, 5], 128)

    def test_constant_zero_and_negative_land(self):
        for metres in [0, -500, -8177]:
            image, _ = normal_map(np.full((8, 16), metres, dtype=np.float32), 3396000)
            self.assertTrue(np.all(image == np.array([128, 128, 255])[:, None, None]))

    def test_earth_ocean_and_coastal_neighbours_neutral(self):
        heights = np.tile(np.arange(16, dtype=np.float32), (8, 1)) * 100000
        land = np.ones_like(heights, dtype=bool)
        land[:, 4] = False
        image, safe = normal_map(heights, 6371000, land)
        self.assertFalse(safe[:, 3:6].any())
        self.assertTrue(np.all(image[:, ~safe] == np.array([128, 128, 255])[:, None]))

    def test_periodic_longitude(self):
        terrain = np.tile(np.sin(np.arange(16) * np.pi / 8), (8, 1)).astype(np.float32) * 100000
        for recipe in RECIPES.values():
            original, _ = normal_map(terrain, recipe["radius"])
            shifted, _ = normal_map(np.roll(terrain, 4, axis=1), recipe["radius"])
            self.assertTrue(np.array_equal(shifted, np.roll(original, 4, axis=2)))

    def test_color_roundtrip(self):
        values = np.linspace(0, 1, 1000)
        self.assertTrue(np.allclose(linear_to_srgb(srgb_to_linear(values)), values))

    def test_all_source_records_complete(self):
        self.assertEqual(len(source_records("earth")), 17)
        self.assertEqual(len(source_records("luna")), 3)
        self.assertEqual(len(source_records("mars")), 2)

    def test_current_asset_budgets_and_failure(self):
        root = Path(__file__).resolve().parents[2] / "assets" / "sol-textures"
        for recipe in RECIPES.values():
            manifest = json.loads((root / recipe["version"] / "derivative-manifest.json").read_text())
            self.assertEqual(budgets(manifest["products"], recipe["prefix"]), manifest["budgets"])
            for product in manifest["products"].values():
                product["bytes"] = 10 * 1024 * 1024
            with self.assertRaisesRegex(ValueError, "transfer exceeded"):
                budgets(manifest["products"], recipe["prefix"])

    def test_failures_are_not_disabled_by_optimized_python(self):
        with self.assertRaisesRegex(ValueError, "explicit"):
            require(False, "explicit")

    def test_truncated_png_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "broken.png"
            path.write_bytes(b"\x89PNG\r\n\x1a\n")
            with self.assertRaisesRegex(ValueError, "Truncated"):
                png_chunks(path)

    def test_source_hash_mismatch_is_explicit(self):
        with tempfile.TemporaryDirectory() as directory:
            (Path(directory) / "source.bin").write_bytes(b"bad")
            entry = {"file": "source.bin", "bytes": 3, "sha256": "wrong"}
            with patch("pipeline.source_records", return_value=[entry]):
                with self.assertRaisesRegex(ValueError, "Source hash mismatch"):
                    verify_sources("earth", directory)

    def test_fetch_never_overwrites_existing_original(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "source.bin"
            path.write_bytes(b"bad")
            entry = {"file": "source.bin", "bytes": 3, "sha256": "wrong"}
            with patch("pipeline.source_records", return_value=[entry]):
                with self.assertRaisesRegex(ValueError, "Existing source mismatch"):
                    fetch_sources("earth", Path(directory))
            self.assertEqual(path.read_bytes(), b"bad")

    def test_landmark_crop_includes_interpolation_edges(self):
        script = Path(__file__).parent / "diagnostic" / "prepare_landmarks.py"
        spec = importlib.util.spec_from_file_location("landmark_helpers", script)
        helpers = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(helpers)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "synthetic.tif"
            with rasterio.open(path, "w", driver="GTiff", width=64, height=32, count=3,
                               dtype="uint8", crs="EPSG:4326",
                               transform=from_bounds(-180, -90, 180, 90, 64, 32)) as image:
                image.write(np.full((3, 32, 64), 123, dtype=np.uint8))
            crop = helpers.crop_color(path, [-24.08, 5.62, -16.08, 13.62])
            self.assertEqual(crop.shape, (3, 512, 512))
            self.assertTrue(np.all(crop == 123))


if __name__ == "__main__":
    unittest.main()
