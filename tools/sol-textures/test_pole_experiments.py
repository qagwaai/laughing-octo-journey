import unittest
import json
from pathlib import Path
import numpy as np
import rasterio
from polar_normals import geodesic_slopes, sample_height, variants
from pipeline import RECIPES, digest


class PolarExperimentTests(unittest.TestCase):
    def test_promoted_versions_preserve_color_and_nonpolar_normals(self):
        root = Path(__file__).resolve().parents[2] / "assets" / "sol-textures"
        for body in ["luna", "mars"]:
            recipe = RECIPES[body]
            selected, previous = root / recipe["version"], root / recipe["baselineVersion"]
            manifest = json.loads((selected / "derivative-manifest.json").read_text())
            self.assertEqual(manifest["provenance"]["polarAcceptance"]["variant"], "geodesic")
            for tier in ["preview", "low", "standard"]:
                name = f"{body}-{tier}-albedo.jpg"
                self.assertEqual(digest(selected / name), digest(previous / name))
            for tier in ["low", "standard"]:
                name = f"{body}-{tier}-normal.png"
                with rasterio.open(selected / name) as file:
                    image = file.read()
                with rasterio.open(previous / name) as file:
                    baseline = file.read()
                latitude = 90-(np.arange(image.shape[1])+0.5)*180/image.shape[1]
                np.testing.assert_array_equal(image[:, np.abs(latitude) <= 85],
                                              baseline[:, np.abs(latitude) <= 85])

    def test_periodic_sampling(self):
        grid = np.arange(32, dtype=float).reshape(4, 8)
        lon = np.array([-np.pi, np.pi, 3*np.pi])
        values = sample_height(grid, lon, np.zeros(3))
        np.testing.assert_allclose(values, values[0])

    def test_constant_signed_height_has_zero_slopes_across_poles(self):
        lon = np.linspace(-np.pi, np.pi, 16)
        for lat in [np.pi/2, -np.pi/2, np.radians(89.9)]:
            for slope in geodesic_slopes(np.full((32, 64), -123.), lon, lat, 1000, 0.05):
                np.testing.assert_allclose(slope, 0, atol=1e-12)

    def test_physical_north_slope_and_radius_scaling(self):
        lat = np.pi/2 - (np.arange(720)+0.5)*np.pi/720
        heights = np.broadcast_to((100*np.sin(lat))[:, None], (720, 1440))
        east, north = geodesic_slopes(heights, np.zeros(3), np.radians([0, 60, 88]), 1000, 0.01)
        np.testing.assert_allclose(east, 0, atol=1e-10)
        np.testing.assert_allclose(north, 0.1*np.cos(np.radians([0, 60, 88])), atol=5e-5)
        _, doubled = geodesic_slopes(heights, np.zeros(3), np.radians([0, 60, 88]), 2000, 0.01)
        np.testing.assert_allclose(doubled*2, north)

    def test_outside_cap_unchanged_and_outer_rows_neutral(self):
        baseline = np.empty((3, 180, 360), dtype=np.uint8)
        baseline[:] = np.array([140, 120, 254])[:, None, None]
        for image in variants(np.full((360, 720), 0.), baseline, 1000).values():
            np.testing.assert_array_equal(image[:, 5:-5], baseline[:, 5:-5])
            np.testing.assert_array_equal(image[:, 0], np.broadcast_to(np.array([128, 128, 255])[:, None], (3, 360)))
