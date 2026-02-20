# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from pathlib import Path
import os


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


ROOT_DIR = Path(__file__).resolve().parents[1]

GRAPH_DIR = ROOT_DIR / "graphs"
OSM_DIR = ROOT_DIR / "preloaded_osm_files"
DRM_DIR = ROOT_DIR / "preloaded_drm_files"
ROUTER_MAP_FILE = ROOT_DIR / "router_map.json"
NGINX_CONFIG_DIR = ROOT_DIR / "nginx" / "router_configs"

OTP_PORT_START = int(os.getenv("OTP_PORT_START", "8800"))
OTP_PORT_END = int(os.getenv("OTP_PORT_END", "9000"))
OTP_BUILD_HEAP = os.getenv("OTP_BUILD_HEAP", "8G")
OTP_ROUTER_IMAGE = os.getenv("OTP_ROUTER_IMAGE", "otp-router-image")
OTP_ROUTER_CONTAINER_PREFIX = os.getenv("OTP_ROUTER_CONTAINER_PREFIX", "otp-")
DOCKER_NETWORK = os.getenv("DOCKER_NETWORK", "gtfs-analysis-tool_app_net")
OTP_VERSION = "1.5.0"
OTP_JAR = Path(os.getenv("OTP_JAR", "/opt/otp.jar"))
if not OTP_JAR.exists():
    OTP_JAR = ROOT_DIR / f"otp-{OTP_VERSION}-shaded.jar"
CLEANUP_DYNAMIC_ROUTERS_ON_SHUTDOWN = _env_bool("CLEANUP_DYNAMIC_ROUTERS_ON_SHUTDOWN", True)

PBF_EXTENSION = os.getenv("PBF_EXTENSION", ".osm.pbf")
