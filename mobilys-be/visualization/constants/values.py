# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
# Constants for number of buses running visualization
DATE_FORMAT = "%Y-%m-%d"
TIME_FORMAT = "%H:%M:%S"

EPSG_WGS84 = "EPSG:4326"
EPSG_WEB_MERCATOR = "EPSG:3857"

# Constants for buffer analysis visualization
METERS_PER_DEGREE_APPROX = 111000.0
METERS_PER_DEGREE_LAT = 110540.0
METERS_PER_DEGREE_LON = 111320.0

RADIUS_HEATMAP_FILL_COLOR = "#FF0000"
RADIUS_HEATMAP_STROKE_COLOR = "#FF0000"
RADIUS_HEATMAP_FILL_OPACITY = 0.2

WALKING_SPEED_KMH_TO_MPS = 3.6
DEFAULT_CIRCLE_POINTS = 32

# Constants for OD analysis visualization
DATE_FMTS = ("%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d", "%Y%m%d")
DATE_ALL_LABEL = "全て"

# Constants for road network reachability
SCHOOL_DATASET_ID = "nlni_ksj-p29"
MEDICAL_INSTITUTION_DATASET_ID = "nlni_ksj-p04"
DEFAULT_MAX_TRAVEL_TIME_MIN = 90
DEFAULT_WALKING_SPEED_KMH = 4.8
DEFAULT_GRAPH_TYPE = "osm"
ALLOWED_GRAPH_TYPES = {"osm", "drm"}
ALLOWED_DRM_PREFECTURES = {"kagawa", "toyama"}

# Graph type labels
GRAPH_TYPE_OSM = "osm"
GRAPH_TYPE_DRM = "drm"

# POI CSV / view constants
POI_REQUIRED_COLS = ("タイプ", "名前", "緯度", "経度")
POI_OPTIONAL_COLS = ("備考",)
POI_STRICT_HEADER_ORDER = True
POI_PREFECTURE_GEOJSON = "data/prefectures_geojson/japan_prefectures.geojson"

# OTP PBF availability (capitalized romaji)
OTP_PBF_PREFECTURES_DRM = ("Kagawa", "Toyama")
OTP_PBF_PREFECTURES_OSM = (
    "Hokkaido",
    "Aomori",
    "Iwate",
    "Miyagi",
    "Akita",
    "Yamagata",
    "Fukushima",
    "Ibaraki",
    "Tochigi",
    "Gunma",
    "Saitama",
    "Chiba",
    "Tokyo",
    "Kanagawa",
    "Niigata",
    "Toyama",
    "Ishikawa",
    "Fukui",
    "Yamanashi",
    "Nagano",
    "Gifu",
    "Shizuoka",
    "Aichi",
    "Mie",
    "Shiga",
    "Kyoto",
    "Osaka",
    "Hyogo",
    "Nara",
    "Wakayama",
    "Tottori",
    "Shimane",
    "Okayama",
    "Hiroshima",
    "Yamaguchi",
    "Tokushima",
    "Kagawa",
    "Ehime",
    "Kochi",
    "Fukuoka",
    "Saga",
    "Nagasaki",
    "Kumamoto",
    "Oita",
    "Miyazaki",
    "Kagoshima",
    "Okinawa",
)
