from pathlib import Path
import os

ROOT_DIR = Path(__file__).resolve().parents[1]

GRAPH_DIR = ROOT_DIR / "graphs"
OSM_DIR = ROOT_DIR / "preloaded_osm_files"
DRM_DIR = ROOT_DIR / "preloaded_drm_files"
ROUTER_MAP_FILE = ROOT_DIR / "router_map.json"
NGINX_CONFIG_DIR = ROOT_DIR / "nginx" / "router_configs"
OTP_JAR = ROOT_DIR / "otp-1.5.0-shaded.jar"

OTP_PORT_START = int(os.getenv("OTP_PORT_START", "8800"))
OTP_PORT_END = int(os.getenv("OTP_PORT_END", "9000"))
OTP_BUILD_HEAP = os.getenv("OTP_BUILD_HEAP", "8G")
OTP_ROUTER_IMAGE = os.getenv("OTP_ROUTER_IMAGE", "otp-router-image")
OTP_ROUTER_CONTAINER_PREFIX = os.getenv("OTP_ROUTER_CONTAINER_PREFIX", "otp-")
DOCKER_NETWORK = os.getenv("DOCKER_NETWORK", "gtfs-analysis-tool_app_net")

PBF_EXTENSION = os.getenv("PBF_EXTENSION", ".osm.pbf")
