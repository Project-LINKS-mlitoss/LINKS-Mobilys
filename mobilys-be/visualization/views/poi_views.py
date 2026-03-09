# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
# visualization/views/poi_views.py
from typing import List, Tuple
import csv
import io
import math
from pathlib import Path

from django.conf import settings
from django.db import connection, transaction
from django.db.models import Q, Min, Max
from django.http import HttpResponse
from django.utils import timezone

from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

import geopandas as gpd
from shapely.geometry import Point

from gtfs.models import Scenario, Stops
from mobilys_BE.shared.response import BaseResponse
from visualization.constants import (
    POI_DB_LIMIT_MAX,
    POI_OPTIONAL_COLS,
    POI_PAGE_SIZE_DEFAULT,
    POI_PAGE_SIZE_MAX,
    POI_PAGE_SIZE_MIN,
    POI_PREFECTURE_GEOJSON,
    POI_RENDER_ZOOM_MIN,
    POI_REQUIRED_COLS,
    POI_STRICT_HEADER_ORDER,
    POI_TOTAL_LIMIT_DEFAULT,
    POI_TOTAL_LIMIT_MAX,
    POI_ZOOM_DEFAULT,
    POI_ZOOM_MAX,
    POI_ZOOM_MIN,
)
from visualization.constants.messages import Messages
from visualization.services.project_prefecture_service import get_effective_prefectures
from visualization.services.base import ServiceError, transactional
from visualization.services.poi_service import (
    fetch_POIs_by_bounding_box,  # MLIT (external)
    set_active_poi_batch,
    get_active_poi_batch_id,
)
from visualization.utils.share_util import normalize_project_id as _normalize_project_id
from visualization.serializers.request.poi_serializers import (
    POIByBBoxQuerySerializer,
    POIDBByBBoxQuerySerializer,
    POISetActiveBatchSerializer,
    POICheckRequestSerializer,
    POIBatchDownloadQuerySerializer,
    POIQuerySerializer,
    POIBatchUploadSerializer,
)
from visualization.serializers.response.poi_serializers import (
    POIGroupedResponseSerializer,
    POIListResponseSerializer,
)
from ..models import PointOfInterests, PoiBatch
from visualization.serializers.response.poi_serializers import PointOfInterestSerializer
from ..utils.poi_utils import parse_strict_float


ALLOWED_COLS = set(POI_REQUIRED_COLS) | set(POI_OPTIONAL_COLS)
_PREF_GDF = None  # cached GeoDataFrame (or False if load failed)


def _parse_decode(file_obj):
    raw = file_obj.read()
    try:
        return raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        return raw.decode("cp932", errors="ignore")


def _validate_rows(text, user):
    def _err(row_number, reason, typ, name, lat_s, lng_s):
        return {
            "row_number": row_number,
            "type": (typ or ""),
            "name": (name or ""),
            "lat": (lat_s or ""),
            "lng": (lng_s or ""),
            "reason": reason,
        }

    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader) if reader.fieldnames else []

    errors = []
    headers_raw = reader.fieldnames or []
    headers = [(h or "").strip() for h in headers_raw]

    # No headers or rows
    if not rows and not headers:
        return [], [_err(0, Messages.POI_HEADER_OR_ROWS_MISSING_JA, None, None, None, None)], {"total_rows": 0}

    # Template check
    missing = [c for c in POI_REQUIRED_COLS if c not in headers]
    extra = [h for h in headers if h not in ALLOWED_COLS]
    if missing or extra:
        reasons = []
        if missing:
            reasons.append(Messages.POI_REQUIRED_COLUMNS_MISSING_TEMPLATE_JA.format(missing=", ".join(missing)))
        if extra:
            reasons.append(Messages.POI_EXTRA_COLUMNS_TEMPLATE_JA.format(extra=", ".join(extra)))
        return [], [_err(0, " / ".join(reasons), None, None, None, None)], {"total_rows": len(rows)}

    if POI_STRICT_HEADER_ORDER:
        expected_prefix = list(POI_REQUIRED_COLS)
        if headers[: len(expected_prefix)] != expected_prefix:
            msg = Messages.POI_HEADER_ORDER_MISMATCH_TEMPLATE_JA.format(expected=", ".join(expected_prefix))
            return [], [_err(0, msg, None, None, None, None)], {"total_rows": len(rows)}

    seen_in_file = set()
    duplicate_in_file_count = 0
    valid_rows = []  # (idx, row, key)

    for idx, row in enumerate(rows, start=1):
        typ = (row.get("タイプ") or "").strip()
        name = (row.get("名前") or "").strip()
        lat_s = (row.get("緯度") or "").strip()
        lng_s = (row.get("経度") or "").strip()

        if not typ:
            errors.append(_err(idx, Messages.POI_TYPE_REQUIRED_JA, typ, name, lat_s, lng_s))
            continue
        if not name:
            errors.append(_err(idx, Messages.POI_NAME_REQUIRED_JA, typ, name, lat_s, lng_s))
            continue
        if not lat_s:
            errors.append(_err(idx, Messages.POI_LAT_REQUIRED_JA, typ, name, lat_s, lng_s))
            continue
        if not lng_s:
            errors.append(_err(idx, Messages.POI_LNG_REQUIRED_JA, typ, name, lat_s, lng_s))
            continue

        try:
            lat = parse_strict_float(lat_s)
            lng = parse_strict_float(lng_s)
        except ValueError:
            errors.append(
                _err(
                    idx,
                    Messages.POI_LAT_LON_NUMERIC_ONLY_JA,
                    typ,
                    name,
                    lat_s,
                    lng_s,
                )
            )
            continue

        if math.isfinite(lat) and float(int(lat)) == lat:
            errors.append(
                _err(
                    idx,
                    Messages.POI_LAT_DECIMAL_REQUIRED_JA,
                    typ,
                    name,
                    lat_s,
                    lng_s,
                )
            )
            continue

        if not (-90 <= lat <= 90):
            errors.append(_err(idx, Messages.POI_LAT_RANGE_JA, typ, name, lat_s, lng_s))
            continue
        if not (-180 <= lng <= 180):
            errors.append(_err(idx, Messages.POI_LNG_RANGE_JA, typ, name, lat_s, lng_s))
            continue

        key = (typ, name, f"{lat:.8f}", f"{lng:.8f}")
        if key in seen_in_file:
            duplicate_in_file_count += 1
            errors.append(_err(idx, Messages.POI_DUPLICATE_IN_UPLOAD_JA, typ, name, lat_s, lng_s))
            continue
        seen_in_file.add(key)

        valid_rows.append((idx, row, key))

    # Duplicate in DB (per user scope)
    existing_keys = set()
    duplicate_in_db_count = 0
    if valid_rows:
        unique_keys = list({k for _, _, k in valid_rows})
        q = Q()
        for (tp, nm, la, ln) in unique_keys:
            q |= Q(user=user, type=tp, name=nm, lat=la, lng=ln)
        if q:
            for p in PointOfInterests.objects.filter(q).values("type", "name", "lat", "lng"):
                existing_keys.add((p["type"], p["name"], p["lat"], p["lng"]))

    to_create_rows = []
    for idx, row, key in valid_rows:
        if key in existing_keys:
            duplicate_in_db_count += 1
            tp, nm, la, ln = key
            errors.append(_err(idx, Messages.POI_DUPLICATE_IN_DB_JA, tp, nm, la, ln))
        else:
            to_create_rows.append(row)

    stats = {
        "total_rows": len(rows),
        "valid_rows": len(to_create_rows),
        "invalid_rows": len(errors),
        "duplicate_in_file": duplicate_in_file_count,
        "duplicate_in_db": duplicate_in_db_count,
    }
    return to_create_rows, errors, stats


def _parse_bbox(bbox_str: str) -> Tuple[float, float, float, float]:
    try:
        minx, miny, maxx, maxy = [float(x) for x in bbox_str.split(",")]
        if minx >= maxx or miny >= maxy:
            raise ValueError(Messages.POI_INVALID_BBOX_EXTENTS_EN)
        return (minx, miny, maxx, maxy)
    except Exception:
        raise ValueError(Messages.POI_INVALID_BBOX_FORMAT_EN)


def _clamp_zoom(z):
    try:
        z = int(z)
    except Exception:
        z = POI_ZOOM_DEFAULT
    return max(POI_ZOOM_MIN, min(POI_ZOOM_MAX, z))


def _load_pref_gdf():
    """
    Load prefecture GeoJSON once and cache it.
    """
    global _PREF_GDF
    if _PREF_GDF is not None:
        return _PREF_GDF

    try:
        candidate_paths = [
            Path(POI_PREFECTURE_GEOJSON),
            Path(getattr(settings, "BASE_DIR", "")) / POI_PREFECTURE_GEOJSON,
        ]
        for path in candidate_paths:
            if path and path.exists():
                _PREF_GDF = gpd.read_file(path)
                return _PREF_GDF
        _PREF_GDF = False
        return _PREF_GDF
    except Exception:
        _PREF_GDF = False
        return _PREF_GDF


def _get_prefecture_geometry(pref_names):
    """
    Return shapely MultiPolygon (merged if multiple prefectures) for the given prefecture names.
    """
    gdf = _load_pref_gdf()
    if gdf is False or gdf is None or not hasattr(gdf, "empty") or gdf.empty:
        return None

    names = {str(p).strip().lower() for p in pref_names if isinstance(p, str) and str(p).strip()}
    if not names:
        return None

    if "NAME_1" not in gdf.columns:
        return None

    subset = gdf[gdf["NAME_1"].astype(str).str.lower().isin(names)]
    if subset.empty:
        return None

    # Merge multiple prefectures if needed
    return subset.geometry.unary_union


def _get_prefecture_bounds(pref_names):

    geom = _get_prefecture_geometry(pref_names)
    if not geom:
        return None
    minx, miny, maxx, maxy = geom.bounds
    return (float(minx), float(miny), float(maxx), float(maxy))


def _get_scenario_stop_bounds(scenario_id):
    """
    Return (minx, miny, maxx, maxy) across stops in the scenario.
    """
    agg = Stops.objects.filter(scenario_id=scenario_id).aggregate(
        min_lat=Min("stop_lat"),
        max_lat=Max("stop_lat"),
        min_lon=Min("stop_lon"),
        max_lon=Max("stop_lon"),
    )
    vals = [agg.get("min_lon"), agg.get("min_lat"), agg.get("max_lon"), agg.get("max_lat")]
    if any(v is None for v in vals):
        return None
    min_lon, min_lat, max_lon, max_lat = vals
    return (float(min_lon), float(min_lat), float(max_lon), float(max_lat))


class POIByBBoxAPIView(APIView):
    """
    MLIT (external) POIs by scenario-derived bounds.
    IMPORTANT: MLIT fetch uses bbox (API limitation), then we filter by prefecture polygon.

    Query params:
      - scenario_id (required)
      - project_id (optional)
      - zoom=0..22 (optional)
      - dataset_id=... (optional)
      - categories=... (optional, pass-through if you support it)
      - limit=integer (optional; clamped)
      - batch=... (optional)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = POIByBBoxQuerySerializer(data=request.query_params)
        if not serializer.is_valid():
            return Response({"detail": Messages.INVALID_QUERY_PARAMETERS_EN}, status=status.HTTP_400_BAD_REQUEST)

        params = serializer.validated_data
        scenario_id = params.get("scenario_id")
        if not scenario_id:
            return Response({"detail": Messages.POI_MISSING_SCENARIO_ID_QUERY_PARAM_EN}, status=status.HTTP_400_BAD_REQUEST)

        scenario = Scenario.objects.filter(id=scenario_id).first()
        if not scenario:
            return Response({"detail": Messages.SCENARIO_NOT_FOUND_EN}, status=status.HTTP_404_NOT_FOUND)

        project_id = _normalize_project_id(params.get("project_id"))
        pref_names, pref_status = get_effective_prefectures(
            project_id,
            scenario.prefecture_info or [],
            user_id=request.user.id,
            return_status=True,
        )

        if pref_status == "mismatch":
            payload = {
                "items": [],
                "meta": {
                    "count": 0,
                    "note": "selected prefecture not in scenario.prefecture_info",
                    "project_id": project_id,
                },
            }
            return Response(payload, status=200)

        # 1) Try polygon first
        pref_geom = _get_prefecture_geometry(pref_names)

        # 2) Derive bbox for MLIT from polygon bounds (best) or fallback to stop bounds
        bbox = None
        if pref_geom:
            bbox = pref_geom.bounds
        if not bbox:
            bbox = _get_scenario_stop_bounds(scenario_id)
        if not bbox:
            return Response({"detail": Messages.POI_COULD_NOT_DERIVE_BOUNDS_EN}, status=status.HTTP_404_NOT_FOUND)

        minx, miny, maxx, maxy = bbox

        zoom = _clamp_zoom(params.get("zoom", POI_ZOOM_DEFAULT))
        dataset_id = params.get("dataset_id")
        categories = params.get("categories")
        raw_limit = params.get("limit")
        try:
            total_limit = max(1, min(POI_TOTAL_LIMIT_MAX, int(raw_limit))) if raw_limit else POI_TOTAL_LIMIT_DEFAULT
        except Exception:
            total_limit = POI_TOTAL_LIMIT_DEFAULT

        raw_page_size = params.get("page_size")
        try:
            page_size = int(raw_page_size) if raw_page_size is not None else POI_PAGE_SIZE_DEFAULT
        except Exception:
            page_size = POI_PAGE_SIZE_DEFAULT
        page_size = max(POI_PAGE_SIZE_MIN, min(POI_PAGE_SIZE_MAX, page_size))
        page_size = min(page_size, total_limit)

        if zoom < POI_RENDER_ZOOM_MIN:
            payload = {"items": [], "meta": {"note": "zoom too low for point rendering", "bbox": bbox}}
            return Response(payload, status=200)

        batch_id = params.get("batch")
        if batch_id == "default":
            batch_id = None

        # Resolve active batch if not provided
        if batch_id is None:
            if project_id:
                batch_id = get_active_poi_batch_id(project_id)
            else:
                active = (
                    PoiBatch.objects.filter(
                        user=request.user,
                        project_id__isnull=True,
                        is_active=True
                    )
                    .order_by("-created_at")
                    .first()
                )
                batch_id = str(active.id) if active else None

        # Only suppress MLIT when the batch is actually active for the project
        if batch_id and project_id:
            is_active = PoiBatch.objects.filter(id=batch_id, project_id=project_id, is_active=True).exists()
            if not is_active:
                batch_id = None

        # If an active batch is found, suppress MLIT and return empty (custom mode)
        if batch_id:
            payload = {
                "items": [],
                "meta": {
                    "bbox": bbox,
                    "zoom": zoom,
                    "dataset_id": dataset_id,
                    "categories": categories,
                    "note": "MLIT POIs suppressed because a custom batch is active",
                    "batch_id": batch_id,
                    "project_id": project_id,
                },
            }
            return Response(payload, status=200)

        # No active batch: fetch MLIT by bbox, then filter by polygon (if available)
        items: List[dict] = []
        try:
            raw_items = fetch_POIs_by_bounding_box(
                top_left={"lat": maxy, "lon": minx},
                bottom_right={"lat": miny, "lon": maxx},
                dataset_id=dataset_id,
                page_size=page_size,
                total_limit=total_limit,
            )
        except ServiceError as exc:
            return Response({"detail": exc.message}, status=exc.status_code)
        except Exception as exc:
            return Response({"detail": Messages.POI_FAILED_TO_FETCH_MLIT_POIS_EN}, status=status.HTTP_502_BAD_GATEWAY)

        # Normalize and polygon-filter
        if raw_items is None:
            raw_items = []

        if pref_geom:
            filtered = []
            for i in raw_items:
                if not isinstance(i, dict):
                    continue
                try:
                    i.setdefault("dataset_id", dataset_id)
                    i.setdefault("source", "mlit")
                    pt = Point(float(i["lon"]), float(i["lat"]))
                    if pref_geom.contains(pt):
                        filtered.append(i)
                except Exception:
                    continue
            items = filtered
        else:
            # No polygon: return bbox results as-is
            items = raw_items
            for i in items:
                if isinstance(i, dict):
                    i.setdefault("dataset_id", dataset_id)
                    i.setdefault("source", "mlit")

        payload = {
            "items": items,
            "meta": {
                "count": len(items),
                "dataset_id": dataset_id,
                "zoom": zoom,
                "bbox": (float(minx), float(miny), float(maxx), float(maxy)),
                "filtered_by_polygon": bool(pref_geom),
            },
        }
        return Response(payload, status=200)


class POIDBByBBoxAPIView(APIView):
    """
    Custom (user/project) POIs for the active batch.

    Behavior: resolve the active batch (project-scoped when project_id is provided,
    otherwise user-scoped). Return all POIs from that batch; no prefecture filtering.
    If no active batch is found, returns empty.

    Query params:
      - scenario_id (required)
      - project_id (optional; if present, uses project-scoped active batch)
      - batch=... (optional; overrides active batch; "default" clears)
      - limit=integer (optional; caps result size)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = POIDBByBBoxQuerySerializer(data=request.query_params)
        if not serializer.is_valid():
            return Response({"detail": Messages.INVALID_QUERY_PARAMETERS_EN}, status=status.HTTP_400_BAD_REQUEST)

        params = serializer.validated_data
        scenario_id = params.get("scenario_id")
        if not scenario_id:
            return Response({"detail": Messages.POI_MISSING_SCENARIO_ID_QUERY_PARAM_EN}, status=status.HTTP_400_BAD_REQUEST)

        scenario = Scenario.objects.filter(id=scenario_id).first()
        if not scenario:
            return Response({"detail": Messages.SCENARIO_NOT_FOUND_EN}, status=status.HTTP_404_NOT_FOUND)

        project_id = _normalize_project_id(params.get("project_id"))

        batch_id = params.get("batch")
        if batch_id == "default":
            batch_id = None

        # Determine active batch if not explicitly provided
        if batch_id is None:
            if project_id:
                batch_id = get_active_poi_batch_id(project_id)
            else:
                active = (
                    PoiBatch.objects.filter(
                        user=request.user,
                        project_id__isnull=True,
                        is_active=True
                    )
                    .order_by("-created_at")
                    .first()
                )
                batch_id = str(active.id) if active else None

        # Validate active batch scope
        if project_id:
            if batch_id:
                is_active = PoiBatch.objects.filter(id=batch_id, project_id=project_id, is_active=True).exists()
                if not is_active:
                    payload = {"items": [], "meta": {"note": "batch is not active", "batch_id": batch_id}}
                    return Response(payload, status=200)
            else:
                payload = {"items": [], "meta": {"note": "no active batch"}}
                return Response(payload, status=200)
        else:
            if batch_id:
                is_active = PoiBatch.objects.filter(
                    id=batch_id, user=request.user, project_id__isnull=True, is_active=True
                ).exists()
                if not is_active:
                    payload = {"items": [], "meta": {"note": "batch is not active", "batch_id": batch_id}}
                    return Response(payload, status=200)
            else:
                payload = {"items": [], "meta": {"note": "no active batch"}}
                return Response(payload, status=200)

        raw_limit = params.get("limit")
        try:
            limit = max(1, min(POI_DB_LIMIT_MAX, int(raw_limit))) if raw_limit else None
        except Exception:
            limit = None

        if batch_id:
            qs = PointOfInterests.objects.filter(batch_id=batch_id)
        elif project_id:
            qs = PointOfInterests.objects.filter(project_id=project_id, batch__isnull=True)
        else:
            qs = PointOfInterests.objects.filter(user=request.user, project_id__isnull=True, batch__isnull=True)

        if limit:
            qs = qs[:limit]

        items = [
            {
                "id": str(p.id),
                "dataset_id": "custom",
                "title": p.name,
                "category": p.type,
                "lat": float(p.lat),
                "lon": float(p.lng),
                "remark": p.remark,
                "source": "custom",
                "batch_id": batch_id,
                "project_id": project_id,
            }
            for p in qs
        ]

        payload = {
            "items": items,
            "meta": {
                "count": len(items),
                "filtered_by_polygon": False,
                "batch_id": batch_id,
                "project_id": project_id,
            },
        }
        return Response(payload, status=200)


class SetActivePOIBatchAPIView(APIView):
    """
    Set the active POI batch for a project (or user-scoped when project_id is null).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = POISetActiveBatchSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"message": Messages.INVALID_REQUEST_PAYLOAD_EN, "error": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        batch_id = serializer.validated_data.get("batch_id")
        project_id = _normalize_project_id(serializer.validated_data.get("project_id"))

        if not batch_id:
            return Response({"message": Messages.POI_BATCH_ID_REQUIRED_EN}, status=status.HTTP_400_BAD_REQUEST)

        # Project-scoped
        if project_id:
            if batch_id != "default" and not PoiBatch.objects.filter(id=batch_id, project_id=project_id).exists():
                return Response({"message": Messages.POI_BATCH_NOT_FOUND_FOR_PROJECT_EN}, status=status.HTTP_404_NOT_FOUND)
            try:
                set_active_poi_batch(project_id, batch_id)
            except ServiceError as exc:
                return Response({"message": exc.message, "error": exc.error}, status=exc.status_code)
            except Exception as e:
                return Response({"message": Messages.POI_FAILED_TO_SET_ACTIVE_BATCH_EN, "error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            payload = {"message": Messages.POI_ACTIVE_BATCH_UPDATED_EN, "project_id": project_id, "batch_id": batch_id}
            return Response(payload, status=200)

        # User-scoped (project_id is null)
        if batch_id == "default":
            PoiBatch.objects.filter(user=request.user, project_id__isnull=True, is_active=True).update(is_active=False)
            payload = {"message": Messages.POI_ACTIVE_BATCH_CLEARED_EN, "project_id": None, "batch_id": "default"}
            return Response(payload, status=200)

        if not PoiBatch.objects.filter(id=batch_id, user=request.user, project_id__isnull=True).exists():
            return Response({"message": Messages.POI_BATCH_NOT_FOUND_FOR_USER_EN}, status=status.HTTP_404_NOT_FOUND)

        try:
            with transaction.atomic():
                PoiBatch.objects.filter(user=request.user, project_id__isnull=True, is_active=True).update(is_active=False)
                PoiBatch.objects.filter(id=batch_id, user=request.user, project_id__isnull=True).update(is_active=True)
        except Exception as e:
            return Response({"message": Messages.POI_FAILED_TO_SET_ACTIVE_BATCH_EN, "error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        payload = {"message": Messages.POI_ACTIVE_BATCH_UPDATED_EN, "project_id": None, "batch_id": batch_id}
        return Response(payload, status=200)


class POICheckAPIView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        files = request.FILES.getlist("files") or request.FILES.getlist("file")
        if not files:
            f = request.FILES.get("file")
            if f:
                files = [f]
        if not files:
            return Response(
                {"message": Messages.POI_CSV_NOT_PROVIDED_JA, "data": {}, "error": []},
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        raw_project_id = request.data.get("project_id") or request.query_params.get("project_id")
        project_serializer = POICheckRequestSerializer(data={"project_id": raw_project_id})
        if not project_serializer.is_valid():
            return BaseResponse(data={}, message=Messages.INVALID_REQUEST_PAYLOAD_EN, error=project_serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

        project_id = _normalize_project_id(project_serializer.validated_data.get("project_id"))
        scope_filter = {"project_id": project_id} if project_id else {"project_id__isnull": True}

        batches = []
        total_ok = 0
        global_seen = {}

        for file_idx, file_obj in enumerate(files):
            text = _parse_decode(file_obj)
            to_create_rows, errors, stats = _validate_rows(text, request.user)

            valid_rows = [{"row_number": i + 1, "row": r} for i, r in enumerate(to_create_rows)]

            cross_dup_count = 0
            filtered_valid_rows = []
            for v in valid_rows:
                r = v["row"]
                key = (
                    str(r["タイプ"]).strip(),
                    str(r["名前"]).strip(),
                    str(r["緯度"]).strip(),
                    str(r["経度"]).strip(),
                )
                if key in global_seen:
                    cross_dup_count += 1
                    prev = global_seen[key]
                    errors.append(
                        {
                            "row_number": v["row_number"],
                            "type": key[0],
                            "name": key[1],
                            "lat": key[2],
                            "lng": key[3],
                            "reason": f"同一データが別ファイルに存在します（{prev['file']} の行 {prev['row_number']}）",
                        }
                    )
                else:
                    global_seen[key] = {
                        "file": file_obj.name,
                        "row_number": v["row_number"],
                        "file_index": file_idx,
                    }
                    filtered_valid_rows.append(v)

            stats["duplicate_in_request"] = cross_dup_count
            stats["invalid_rows"] = stats.get("invalid_rows", 0) + cross_dup_count
            stats["valid_rows"] = len(filtered_valid_rows)

            exists = PoiBatch.objects.filter(user=request.user, file_name=file_obj.name, **scope_filter).exists()
            batches.append(
                {
                    "file": file_obj.name,
                    "proposed_batch_name": file_obj.name,
                    "file_name_taken": exists,
                    "can_commit": stats["valid_rows"] > 0 and not exists,
                    "stats": stats,
                    "valid_rows": filtered_valid_rows,
                    "invalid_rows": errors,
                }
            )
            total_ok += stats["valid_rows"]

        payload = {
            "total_files": len(files),
            "total_valid_rows": total_ok,
            "batches": batches,
            "checked_at": timezone.now().isoformat(),
        }
        return Response(
            {"message": Messages.POI_CHECK_COMPLETED_JA, "data": payload, "error": ""},
            status_code=status.HTTP_200_OK,
        )


class POIBatchDownloadAPIView(APIView):

    """
    Download a POI batch as CSV.
    Query param: batch_id (required)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = POIBatchDownloadQuerySerializer(data=request.query_params)
        if not serializer.is_valid():
            return Response({"detail": Messages.INVALID_QUERY_PARAMETERS_EN}, status=status.HTTP_400_BAD_REQUEST)

        batch_id = serializer.validated_data.get("batch_id")
        if not batch_id:
            return Response({"detail": Messages.POI_BATCH_ID_REQUIRED_EN}, status=status.HTTP_400_BAD_REQUEST)

        batch = PoiBatch.objects.filter(id=batch_id, user=request.user).first()
        if not batch:
            return Response({"detail": Messages.POI_BATCH_NOT_FOUND_EN}, status=status.HTTP_404_NOT_FOUND)

        rows = PointOfInterests.objects.filter(batch_id=batch_id).values("type", "name", "lat", "lng", "remark")

        headers = ["施設データタイプ", "施設データ名称", "緯度", "経度", "備考"]
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(headers)
        for r in rows:
            writer.writerow([r.get("type") or "", r.get("name") or "", r.get("lat") or "", r.get("lng") or "", r.get("remark") or ""])

        resp = HttpResponse(buffer.getvalue().encode("utf-8-sig"), content_type="text/csv")
        resp["Content-Disposition"] = f'attachment; filename="poi_batch_{batch_id}.csv"'
        return resp


class POIAPIView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        serializer = POIQuerySerializer(data=request.query_params)
        if not serializer.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_QUERY_PARAMETERS_EN,
                error=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        params = serializer.validated_data
        poi_type = params.get("type")
        batch_id = params.get("batch")
        grouped = (params.get("grouped") or "").lower() in ("1", "true", "yes")
        if not grouped:
            grouped = (params.get("group_by") or "").lower() == "batch"

        project_id = _normalize_project_id(params.get("project_id"))
        # Project-scoped POIs are shared across users; otherwise fallback to user-owned, no-project POIs
        if project_id:
            qs = PointOfInterests.objects.filter(project_id=project_id)
        else:
            qs = PointOfInterests.objects.filter(user=request.user, project_id__isnull=True)

        if poi_type:
            qs = qs.filter(type=poi_type)
        if batch_id:
            qs = qs.filter(batch_id=batch_id)

        if project_id:
            active_batch_id = get_active_poi_batch_id(project_id)
        else:
            active_batch = (
                PoiBatch.objects.filter(user=request.user, project_id__isnull=True, is_active=True)
                .order_by("-created_at")
                .first()
            )
            active_batch_id = str(active_batch.id) if active_batch else None

        if not grouped:
            serializer = PointOfInterestSerializer(qs, many=True)
            payload = {"items": serializer.data, "active_batch_id": active_batch_id}
            response_serializer = POIListResponseSerializer(data=payload)
            if not response_serializer.is_valid():
                return BaseResponse.error(
                    message=Messages.INVALID_RESPONSE_PAYLOAD_EN,
                    error=response_serializer.errors,
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            return BaseResponse.success(
                data=payload,
                message=Messages.POI_LIST_RETRIEVED_JA,
                status_code=status.HTTP_200_OK,
            )

        qs = qs.select_related("batch").order_by("-batch__created_at", "name")

        groups = []
        index_by_batch = {}

        for poi in qs:
            b = poi.batch  # can be None (unbatched)
            key = str(b.id) if b else None
            if key not in index_by_batch:
                groups.append(
                    {
                        "batch_id": key,
                        "file_name": b.file_name if b else None,
                        "remark": b.remark if b else None,
                        "created_at": b.created_at.isoformat() if b else None,
                        "count": 0,
                        "items": [],
                    }
                )
                index_by_batch[key] = len(groups) - 1

            item = PointOfInterestSerializer(poi).data
            groups[index_by_batch[key]]["items"].append(item)
            groups[index_by_batch[key]]["count"] += 1

        data = {
            "total": qs.count(),
            "group_count": len(groups),
            "groups": groups,
            "generated_at": timezone.now().isoformat(),
            "active_batch_id": active_batch_id,
        }
        response_serializer = POIGroupedResponseSerializer(data=data)
        if not response_serializer.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_RESPONSE_PAYLOAD_EN,
                error=response_serializer.errors,
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return BaseResponse.success(
            data=data,
            message=Messages.POI_BATCH_LIST_RETRIEVED_JA,
            status_code=status.HTTP_200_OK,
        )

    def post(self, request):
        payload = request.data or {}
        upload_serializer = POIBatchUploadSerializer(data=payload)
        if not upload_serializer.is_valid():
            return BaseResponse(data={}, message=Messages.INVALID_REQUEST_PAYLOAD_EN, error=upload_serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)
        batches_in = payload.get("batches", [])
        if not isinstance(batches_in, list) or not batches_in:
            return Response(
                {"message": Messages.POI_BATCHES_REQUIRED_JA, "data": {}, "error": []},
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        overall_created = 0
        results = []

        for i, b in enumerate(batches_in, start=1):
            file_name = b.get("file") or b.get("file_name") or f"batch_{i}"
            remark = b.get("remark") or payload.get("remark")
            project_id = _normalize_project_id(payload.get("project_id"))
            rows = b.get("rows", [])

            if not isinstance(rows, list) or not rows:
                results.append(
                    {
                        "file": file_name,
                        "batch_id": None,
                        "record_count": 0,
                        "errors": [{"row_number": 0, "reason": Messages.POI_ROWS_EMPTY_JA}],
                        "stats": {"total_rows": 0, "valid_rows": 0, "invalid_rows": 0, "duplicate_in_db": 0},
                    }
                )
                continue

            filtered_rows = []
            errors = []
            for idx, r in enumerate(rows, start=1):
                if not all(k in r and str(r[k]).strip() != "" for k in POI_REQUIRED_COLS):
                    errors.append({"row_number": idx, "reason": Messages.POI_REQUIRED_FIELDS_MISSING_JA})
                    continue
                filtered_rows.append(r)

            if not filtered_rows:
                results.append(
                    {
                        "file": file_name,
                        "batch_id": None,
                        "record_count": 0,
                        "errors": errors if errors else [{"row_number": 0, "reason": Messages.POI_NO_REGISTERABLE_ROWS_JA}],
                        "stats": {"total_rows": len(rows), "valid_rows": 0, "invalid_rows": len(errors), "duplicate_in_db": 0},
                    }
                )
                continue

            existing_keys = set()
            objs = []
            dup_count = 0

            for idx, r in enumerate(filtered_rows, start=1):
                key = (
                    str(r["タイプ"]).strip(),
                    str(r["名前"]).strip(),
                    str(r["緯度"]).strip(),
                    str(r["経度"]).strip(),
                )

                if key in existing_keys:
                    dup_count += 1
                    errors.append(
                        {
                            "row_number": idx,
                            "type": key[0],
                            "name": key[1],
                            "lat": key[2],
                            "lng": key[3],
                            "reason": "同じタイプ/名前、緯度、経度のPOIが既に存在します",
                        }
                    )
                    continue

                existing_keys.add(key)

                objs.append(
                    PointOfInterests(
                        user=request.user,
                        type=r["タイプ"],
                        name=r["名前"],
                        lat=r["緯度"],
                        lng=r["経度"],
                        remark=r.get("備考"),
                    )
                )

            if not objs:
                results.append(
                    {
                        "file": file_name,
                        "batch_id": None,
                        "record_count": 0,
                        "errors": errors if errors else [{"row_number": 0, "reason": Messages.POI_NO_REGISTERABLE_ROWS_JA}],
                        "stats": {"total_rows": len(rows), "valid_rows": 0, "invalid_rows": len(errors), "duplicate_in_db": dup_count},
                    }
                )
                continue

            if PoiBatch.objects.filter(user=request.user, project_id=project_id, file_name=file_name).exists():
                results.append(
                    {
                        "file": file_name,
                        "batch_id": None,
                        "record_count": 0,
                        "errors": errors
                        + [
                            {
                                "row_number": 0,
                                "reason": "同じファイル名のバッチが既に存在します（ユーザー内で一意である必要があります）",
                            }
                        ],
                        "stats": {"total_rows": len(rows), "valid_rows": 0, "invalid_rows": len(errors), "duplicate_in_db": dup_count},
                    }
                )
                continue

            try:
                with transaction.atomic():
                    batch = PoiBatch.objects.create(
                        user=request.user,
                        project_id=project_id,
                        file_name=file_name,
                        remark=remark,
                    )
                    for o in objs:
                        o.batch = batch
                        o.project_id = project_id
                    PointOfInterests.objects.bulk_create(objs)
            except Exception:
                results.append(
                    {
                        "file": file_name,
                        "batch_id": None,
                        "record_count": 0,
                        "errors": errors
                        + [
                            {
                                "row_number": 0,
                                "reason": "同じファイル名のバッチが既に存在します（ユーザー内で一意である必要があります）",
                            }
                        ],
                        "stats": {"total_rows": len(rows), "valid_rows": 0, "invalid_rows": len(errors), "duplicate_in_db": dup_count},
                    }
                )
                continue

            overall_created += len(objs)
            results.append(
                {
                    "file": file_name,
                    "batch_id": str(batch.id),
                    "record_count": len(objs),
                    "errors": errors,
                    "stats": {"total_rows": len(rows), "valid_rows": len(objs), "invalid_rows": len(errors), "duplicate_in_db": dup_count},
                }
            )

        payload = {
            "total_created": overall_created,
            "batches": results,
            "uploaded_at": timezone.now().isoformat(),
        }
        return Response(
            {"message": Messages.POI_JSON_REGISTERED_JA, "data": payload, "error": ""},
            status_code=status.HTTP_200_OK,
        )

    @transactional
    def delete(self, request):
        poi_id = request.query_params.get("id")
        batch_id = request.query_params.get("batch")

        if poi_id:
            deleted, _ = PointOfInterests.objects.filter(id=poi_id, user=request.user).delete()
            if deleted == 0:
                return Response(
                    {"message": Messages.POI_TARGET_NOT_FOUND_JA, "data": {}, "error": []},
                    status_code=status.HTTP_404_NOT_FOUND,
                )
            return Response(
                {"message": Messages.POI_DELETED_JA, "data": {"deleted": deleted}, "error": ""},
                status_code=status.HTTP_200_OK,
            )

        if batch_id:
            poi_qs = PointOfInterests.objects.filter(user=request.user, batch_id=batch_id)
            poi_count = poi_qs.count()

            deleted = PoiBatch.objects.filter(id=batch_id, user=request.user).delete()
            if deleted[0] == 0:
                return Response(
                    {"message": Messages.POI_BATCH_TARGET_NOT_FOUND_JA, "data": {}, "error": []},
                    status_code=status.HTTP_404_NOT_FOUND,
                )
            return Response(
                {"message": Messages.POI_BATCH_AND_POI_DELETED_JA, "data": {"deleted_poi": poi_count}, "error": ""},
                status_code=status.HTTP_200_OK,
            )

        return Response(
            {"message": Messages.POI_ID_OR_BATCH_REQUIRED_JA, "data": {}, "error": []},
            status_code=status.HTTP_400_BAD_REQUEST,
        )
