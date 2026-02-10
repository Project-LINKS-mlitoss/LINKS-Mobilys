import os
import shutil
import time
from typing import Tuple, List
from app import config
from app.infra.process import run_streaming
from app.services import paths


def build_graph(scenario_id: str, prefecture: str, gtfs_filename: str, gtfs_bytes: bytes, graph_type: str = "osm") -> Tuple[int, List[str]]:
    build_dir = paths.graph_dir(scenario_id)
    paths.ensure_dir(build_dir)

    graph_obj_path = paths.graph_obj_path(scenario_id)
    if graph_obj_path.exists():
        graph_obj_path.unlink()

    pbf_source = paths.pbf_path(prefecture, graph_type)
    if not pbf_source.exists():
        raise FileNotFoundError(f"PBF file not found for '{prefecture}' (graph_type={graph_type})")
    pbf_dest = build_dir / pbf_source.name
    shutil.copy(pbf_source, pbf_dest)

    gtfs_dest = build_dir / gtfs_filename
    gtfs_dest.write_bytes(gtfs_bytes)

    exit_code, lines = run_streaming(
        [
            "java",
            f"-Xmx{config.OTP_BUILD_HEAP}",
            "-jar",
            str(config.OTP_JAR),
            "--build",
            str(build_dir),
        ]
    )

    if gtfs_dest.exists():
        gtfs_dest.unlink()
    if pbf_dest.exists():
        pbf_dest.unlink()

    os.sync()
    time.sleep(2)
    return exit_code, lines


def delete_graph_dir(scenario_id: str) -> None:
    build_dir = paths.graph_dir(scenario_id)
    if build_dir.exists():
        shutil.rmtree(build_dir)
