from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).parent / "diagnostic"))
from registration_review import residual


class RegistrationReviewTests(unittest.TestCase):
    def test_identical_points_have_zero_residual(self):
        result = residual([0.5, 0.5], [0.5, 0.5], [-10, -5, 10, 5], [1024, 512])
        self.assertEqual(result["distanceNormalTexels"], 0)

    def test_one_texel_and_north_up_sign(self):
        step = 360 / 1024 / 10
        result = residual([0.5, 0.5], [0.5 + step, 0.5 - step], [0, 0, 10, 10], [1024, 512])
        self.assertAlmostEqual(result["eastNormalTexels"], 1)
        self.assertAlmostEqual(result["northNormalTexels"], 1)
        self.assertAlmostEqual(result["distanceNormalTexels"], 2 ** 0.5)

    def test_standard_grid_has_twice_the_texel_residual(self):
        bounds = [0, 0, 10, 10]
        points = ([0.4, 0.4], [0.42, 0.42])
        low = residual(*points, bounds, [1024, 512])["distanceNormalTexels"]
        standard = residual(*points, bounds, [2048, 1024])["distanceNormalTexels"]
        self.assertAlmostEqual(standard, low * 2)

    def test_invalid_annotations_fail(self):
        for point in [[-0.1, 0.5], [1.1, 0.5], [float("nan"), 0.5]]:
            with self.assertRaises(ValueError):
                residual(point, [0.5, 0.5], [0, 0, 10, 10], [1024, 512])


if __name__ == "__main__":
    unittest.main()
