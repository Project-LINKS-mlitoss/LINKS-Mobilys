# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from django.test import SimpleTestCase

from visualization.services.boarding_alighting.catalog_service import _coords_centroid


class CoordsCentroidTests(SimpleTestCase):
    """_coords_centroid（座標リストの重心計算）のユニットテスト。"""

    def test_empty_list_returns_origin(self):
        self.assertEqual(_coords_centroid([]), (0.0, 0.0))

    def test_single_point_returns_itself(self):
        self.assertEqual(_coords_centroid([(137.0, 36.0)]), (137.0, 36.0))

    def test_multiple_points_returns_mean(self):
        lon, lat = _coords_centroid([(137.0, 36.0), (139.0, 38.0)])
        self.assertAlmostEqual(lon, 138.0)
        self.assertAlmostEqual(lat, 37.0)
