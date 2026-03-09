# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import osmium
from app.services import paths


def get_pbf_bbox(prefecture: str, graph_type: str = "osm"):
    pbf_path = paths.pbf_path(prefecture, graph_type)
    if not pbf_path.exists():
        return None

    reader = osmium.io.Reader(str(pbf_path))
    header = reader.header()
    box = header.box()
    reader.close()

    if box is None:
        return None

    return {
        "min_lon": box.bottom_left.x / 1e7,
        "min_lat": box.bottom_left.y / 1e7,
        "max_lon": box.top_right.x / 1e7,
        "max_lat": box.top_right.y / 1e7,
    }


def is_pbf_available(prefecture: str, graph_type: str = "osm") -> bool:
    return paths.pbf_path(prefecture, graph_type).exists()
