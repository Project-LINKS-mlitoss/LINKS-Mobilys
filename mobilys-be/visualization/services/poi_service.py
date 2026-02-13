# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import requests
import time
from shapely.geometry import shape, Point
from django.conf import settings
from django.db import connection
import logging
from mobilys_BE.shared.log_json import log_json
from visualization.constants import (
    MEDICAL_INSTITUTION_DATASET_ID,
    POI_ISOCHRONE_TOTAL_LIMIT,
    POI_MLIT_PAGE_SIZE_DEFAULT,
    POI_PAGE_SIZE_DEFAULT,
    POI_PAGE_SIZE_MAX,
    POI_PAGE_SIZE_MIN,
    SCHOOL_DATASET_ID,
)
from visualization.models import PointOfInterests, PoiBatch
from visualization.services.base import ServiceError, log_service_call, transactional
from visualization.constants.messages import Messages

logger = logging.getLogger(__name__)

@log_service_call
def fetch_POIs_by_bounding_box(
    top_left,
    bottom_right,
    dataset_id,
    *,
    page_size=POI_MLIT_PAGE_SIZE_DEFAULT,
    total_limit=None,
    **kwargs,
):
    """
    Fetch POIs within bounding box from MLIT API using pagination.
    - page_size: per-request size (capped to avoid oversized calls)
    - total_limit: max records to return across pages (None = no cap)
    - batch_size: legacy alias for page_size (kwarg)
    """
    if not hasattr(settings, 'MLIT_API_KEY') or not settings.MLIT_API_KEY:
        raise ServiceError(Messages.POI_MLIT_API_KEY_MISSING_EN, status_code=500)

    if not hasattr(settings, 'MLIT_API_URL') or not settings.MLIT_API_URL:
        raise ServiceError(Messages.POI_MLIT_API_URL_MISSING_EN, status_code=500)

    timeout = getattr(settings, "MLIT_API_TIMEOUT", 5)
    max_retries = max(1, int(getattr(settings, "MLIT_API_MAX_RETRIES", 1)))

    if "batch_size" in kwargs:
        page_size = kwargs["batch_size"]
    try:
        page_size = int(page_size)
    except Exception:
        page_size = POI_PAGE_SIZE_DEFAULT
    page_size = max(POI_PAGE_SIZE_MIN, min(POI_PAGE_SIZE_MAX, page_size))

    total_cap = None
    if total_limit is not None:
        try:
            total_cap = max(1, int(total_limit))
        except Exception:
            total_cap = None

    headers = {
        "Content-Type": "application/json",
        "apikey": settings.MLIT_API_KEY,
    }

    all_results = []
    offset = 0

    ds = (dataset_id or "").strip().lower()
    is_p04 = ds == MEDICAL_INSTITUTION_DATASET_ID
    is_p29 = ds == SCHOOL_DATASET_ID

    while True:
        effective_size = page_size
        if total_cap is not None:
            remaining = total_cap - len(all_results)
            if remaining <= 0:
                break
            effective_size = min(effective_size, remaining)

        base_fields = """
                  id
                  title
                  lat
                  lon
        """
        metadata_field = "\n                  metadata\n" if (is_p04 or is_p29) else ""

        query = {
            "query": f"""
            {{
              search(
                term: "",
                first: {offset},
                size: {effective_size},
                locationFilter: {{
                  rectangle: {{
                    topLeft: {{ lat: {top_left['lat']}, lon: {top_left['lon']} }},
                    bottomRight: {{ lat: {bottom_right['lat']}, lon: {bottom_right['lon']} }}
                  }}
                }},
                attributeFilter: {{
                  AND: [
                    {{ attributeName: "DPF:dataset_id", is: "{dataset_id}" }}
                  ]
                }}
              ) {{
                totalNumber
                searchResults {{
                  {base_fields}{metadata_field}
                }}
              }}
            }}
            """
        }

        for attempt in range(max_retries):
            try:
                response = requests.post(settings.MLIT_API_URL, json=query, headers=headers, timeout=timeout)
                response.raise_for_status()
                break
            except requests.RequestException as e:
                log_json(
                    logger,
                    logging.WARNING,
                    "mlit_poi_api_request_failed",
                    dataset_id=str(dataset_id),
                    error=str(e),
                    attempt=attempt + 1,
                    max_retries=max_retries,
                )
                if attempt + 1 >= max_retries:
                    raise ServiceError(
                        Messages.POI_FAILED_TO_FETCH_MLIT_POIS_EN,
                        error=str(e),
                        status_code=502,
                    ) from e
                time.sleep(min(1.5 * (attempt + 1), 5))

        data = response.json()
        search_data = data.get("data", {}).get("search", {})
        total_number = search_data.get("totalNumber")
        try:
            total_number = int(total_number)
        except Exception:
            total_number = None

        results = search_data.get("searchResults", [])

        for r in results:
            rid = r.get("id")
            title = r.get("title")
            lat = r.get("lat")
            lon = r.get("lon")

            md = (r.get("metadata") or {}) if (is_p04 or is_p29) else {}
            if is_p04:
                md_title = md.get("NLNI:P04_002")
                if isinstance(md_title, str) and md_title.strip():
                    title = md_title.strip()
            if is_p04:
                address = md.get("NLNI:P04_003")
            elif is_p29:
                address = md.get("DPF:address")
            else:
                address = None

            if isinstance(address, str) and address.strip().lower() == "null":
                address = None

            all_results.append({
                "id": rid,
                "title": title,
                "lat": lat,
                "lon": lon,
                "address": address,
            })

        total_so_far = len(all_results)
        if total_cap is not None and total_so_far >= total_cap:
            break
        if total_number is not None and total_so_far >= total_number:
            break
        if len(results) < effective_size:
            break

        offset += effective_size

    return all_results

def user_has_custom_poi(user, project_id=None) -> bool:
    """
    Return True if this project (or user fallback) has at least one custom POI in DB.
    Anonymous users are treated as no custom POIs.
    """
    if project_id:
        return PointOfInterests.objects.filter(project_id=project_id).exists()
    if not user or getattr(user, "is_anonymous", False):
        return False
    return PointOfInterests.objects.filter(user=user).exists()


@transactional
def set_active_poi_batch(project_id, batch_id):
    """
    Mark a batch as active for a project (single active per project).
    batch_id="default" (or falsy) clears any active batch so MLIT defaults are used.
    """
    if not project_id:
        return
    if batch_id == "default":
        batch_id = None
    PoiBatch.objects.filter(project_id=project_id, is_active=True).update(is_active=False)
    if batch_id and batch_id != "default":
        PoiBatch.objects.filter(id=batch_id, project_id=project_id).update(is_active=True)


def get_active_poi_batch_id(project_id):
    """
    Return the active poi_batch_id for a project, or None.
    """
    if not project_id:
        return None
    batch = (
        PoiBatch.objects.filter(project_id=project_id, is_active=True)
        .order_by("-created_at")
        .first()
    )
    return str(batch.id) if batch else None


def POIs_within_isochrone(isochrone_geojson, dataset_id):
    if not isochrone_geojson or isochrone_geojson.get("type") != "FeatureCollection":
        raise ServiceError(Messages.POI_INVALID_ISOCHRONE_GEOJSON_EN, status_code=400)

    results = []

    for feature in isochrone_geojson.get('features', []):
        try:
            cutoff_time = feature['properties'].get('time')
            isochrone_polygon = shape(feature['geometry'])
        except Exception as exc:
            raise ServiceError(Messages.POI_INVALID_ISOCHRONE_FEATURE_GEOMETRY_EN, error=str(exc), status_code=400) from exc

        min_lon, min_lat, max_lon, max_lat = isochrone_polygon.bounds
        top_left = {"lat": max_lat, "lon": min_lon}
        bottom_right = {"lat": min_lat, "lon": max_lon}

        # Fetch POIs within bounding box from MLIT API
        POIs = fetch_POIs_by_bounding_box(
            top_left,
            bottom_right,
            dataset_id,
            total_limit=POI_ISOCHRONE_TOTAL_LIMIT,
        )

        filtered_POIs = []
        for POI in POIs:
            try:
                lat = float(POI.get('lat'))
                lon = float(POI.get('lon'))
            except Exception:
                continue

            point = Point(lon, lat)

            if isochrone_polygon.contains(point):
                filtered_POIs.append(POI)

        results.append({
            "cutoff_time": cutoff_time,
            "pois": filtered_POIs
        })

    return results

def get_user_point_of_interest_based_on_road_network_analysis(isochrone_geojson, *, user_id=None, project_id=None, poi_batch_id=None):
    if not isochrone_geojson or isochrone_geojson.get("type") != "FeatureCollection":
        raise ServiceError(Messages.POI_INVALID_ISOCHRONE_GEOJSON_EN, status_code=400)

    if poi_batch_id == "default":
        poi_batch_id = None
    if not poi_batch_id and project_id:
        poi_batch_id = get_active_poi_batch_id(project_id)
    if project_id and poi_batch_id:
        is_active = PoiBatch.objects.filter(
            id=poi_batch_id, project_id=project_id, is_active=True
        ).exists()
        if not is_active:
            poi_batch_id = None
    if project_id and not poi_batch_id:
        return []
    features = [f for f in isochrone_geojson.get('features', []) if 'time' in f.get('properties', {})]
    features.sort(key=lambda f: f['properties']['time'])

    results = []

    if poi_batch_id:
        user_clause = "batch_id = %s"
    elif project_id:
        user_clause = "project_id = %s"
    else:
        user_clause = "user_id = %s AND project_id IS NULL"
    sql = f"""
        SELECT id, type, name, lat, lng
        FROM point_of_interests
        WHERE ({user_clause})
          AND (lat::double precision BETWEEN %s AND %s)
          AND (lng::double precision BETWEEN %s AND %s)
    """
    id_param = poi_batch_id or project_id or user_id

    for feature in features:
        cutoff_time = feature['properties']['time']
        try:
            poly = shape(feature['geometry'])
        except Exception as exc:
            raise ServiceError(Messages.POI_INVALID_ISOCHRONE_FEATURE_GEOMETRY_EN, error=str(exc), status_code=400) from exc
        min_lon, min_lat, max_lon, max_lat = poly.bounds

        params = [id_param, min_lat, max_lat, min_lon, max_lon]
        with connection.cursor() as cursor:
            try:
                cursor.execute(sql, params)
                cols = [c[0] for c in cursor.description]
                candidates = [dict(zip(cols, row)) for row in cursor.fetchall()]
            except Exception as exc:
                raise ServiceError(Messages.POI_FAILED_TO_QUERY_POIS_EN, error=str(exc), status_code=500) from exc

        local_seen = set()
        pois_this_cutoff = []
        for poi in candidates:
            pid = poi['id']
            if pid in local_seen:
                continue
            p = Point(float(poi['lng']), float(poi['lat']))
            if poly.covers(p):
                pois_this_cutoff.append(poi)
                local_seen.add(pid)

        results.append({"cutoff_time": cutoff_time, "pois": pois_this_cutoff})

    return results
