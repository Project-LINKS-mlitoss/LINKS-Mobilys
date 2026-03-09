# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
# Configuration constants for number of buses running visualization
EDGE_OFFSET_M = 5
EDGE_OFFSET_SIDE = "left"

# Configuration constants for buffer analysis visualization
DEFAULT_MAX_TRANSFERS = 2
DEFAULT_MAX_WALK_DISTANCE_M = 500
DEFAULT_TRANSFER_BUFFER_SECONDS = 300
DEFAULT_POI_QUERY_RADIUS_M = 500

MLIT_QUERY_SIZE = 200
MLIT_TIMEOUT_SECONDS = 3000

# POI config
POI_ZOOM_MIN = 0
POI_ZOOM_MAX = 22
POI_ZOOM_DEFAULT = 12
POI_RENDER_ZOOM_MIN = 9
POI_TOTAL_LIMIT_DEFAULT = 10000
POI_TOTAL_LIMIT_MAX = 20000
POI_PAGE_SIZE_DEFAULT = 2000
POI_PAGE_SIZE_MIN = 50
POI_PAGE_SIZE_MAX = 2000
POI_DB_LIMIT_MAX = 20000
POI_MLIT_PAGE_SIZE_DEFAULT = 200
POI_ISOCHRONE_TOTAL_LIMIT = 500

# Configuration constants for boarding/alighting visualization
BOARDING_ALIGHTING_PATHS_CAP_PER_SEGMENT = 8
BOARDING_ALIGHTING_LABEL_EAST_OFFSET_M = 100.0
BOARDING_ALIGHTING_LABEL_NORTH_OFFSET_M = 0.0

# Configuration constants for tile proxy
TILE_PROXY_ALLOWED_HOSTS = {
    "cyberjapandata.gsi.go.jp",  # GSI tiles
    "tile.openstreetmap.org",    # OSM
}
TILE_PROXY_TIMEOUT_SECONDS = 10
TILE_PROXY_USER_AGENT = "PCKK-TNeco Map Exporter"
TILE_PROXY_DEFAULT_CACHE_CONTROL = "public, max-age=86400"

# Configuration constants for OTP service
OTP_DEFAULT_URL = "http://host.docker.internal"
OTP_ROUTER_DEFAULT_URL = "http://nginx:80"
OTP_DEFAULT_GRAPHS_BUCKET = "mobilys-osm-files"
OTP_BUILD_GRAPH_TIMEOUT_SECONDS = 3000
OTP_DELETE_GRAPH_TIMEOUT_SECONDS = 3000
OTP_ISOCHRONE_PATH_TEMPLATE = "/routers/{graph_id}/otp/routers/{graph_id}/isochrone"
OTP_BUILD_GRAPH_PATH = "/build_graph"
OTP_DELETE_GRAPH_PATH = "/delete_graph"
OTP_PBF_FILES_PATH = "/s3/pbf_files"
OTP_PBF_EXISTS_PATH = "/pbf_exists"
