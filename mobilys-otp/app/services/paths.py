from pathlib import Path
from app import config


def _normalize_graph_type(graph_type: str | None) -> str:
    return (graph_type or "osm").strip().lower()


def graph_dir(scenario_id: str) -> Path:
    return config.GRAPH_DIR / scenario_id


def graph_obj_path(scenario_id: str) -> Path:
    return graph_dir(scenario_id) / "Graph.obj"


def pbf_dir(graph_type: str | None = None) -> Path:
    normalized = _normalize_graph_type(graph_type)
    return config.OSM_DIR if normalized == "osm" else config.DRM_DIR


def pbf_path(prefecture: str, graph_type: str | None = None) -> Path:
    normalized = _normalize_graph_type(graph_type)
    return pbf_dir(normalized) / f"{prefecture}{config.PBF_EXTENSION}"


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)
