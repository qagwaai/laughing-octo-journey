import unittest

import numpy as np

from diagnostic.probe_poles import normal_cap_light, polar_image, row_statistics


class PoleProbeTests(unittest.TestCase):
    def test_hemispheres_sample_opposite_rows(self):
        array = np.zeros((3, 180, 360), dtype=np.uint8)
        array[:, :6] = 50
        array[:, -6:] = 200
        for north, expected in [(True, 50), (False, 200)]:
            cap = polar_image(array, north, size=33)
            self.assertEqual(cap[:, 16, 16].tolist(), [expected]*3)
            self.assertEqual(cap[:, 0, 0].tolist(), [0]*3)

    def test_periodic_longitude_stays_within_raster(self):
        array = np.broadcast_to(np.arange(360) % 256, (3, 180, 360)).astype(np.uint8)
        cap = polar_image(array, True, size=33)
        self.assertEqual(cap[:, 16, 20].tolist(), [270 % 256]*3)
        self.assertEqual(cap[:, 16, 12].tolist(), [90]*3)

    def test_world_normal_light_is_finite_at_both_poles(self):
        array = np.empty((3, 180, 360), dtype=np.uint8)
        array[:] = np.array([128, 128, 255])[:, None, None]
        for north in [True, False]:
            cap = normal_cap_light(array, north, size=33)
            self.assertEqual(cap.dtype, np.uint8)
            self.assertGreater(int(cap[0, 16, 16]), 180)
            self.assertEqual(cap[:, 0, 0].tolist(), [0]*3)

    def test_constant_height_has_no_longitude_variation(self):
        rows = row_statistics(np.full((8, 16), -100.0, dtype=np.float32))
        self.assertTrue(all(row["std"] == 0 and row["longitudeAdjacentRms"] == 0 for row in rows))


if __name__ == "__main__":
    unittest.main()
