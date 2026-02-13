# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import logging
from collections import defaultdict
from typing import Optional

from shapely.geometry import Point, shape

from mobilys_BE.shared.log_json import log_json
from visualization.services.base import log_service_call
from visualization.constants import (
    MEDICAL_INSTITUTION_DATASET_ID,
    SCHOOL_DATASET_ID,
    MLITDatasetLabel
)
from visualization.models import PointOfInterests, PoiBatch
from visualization.services.poi_service import (
    fetch_POIs_by_bounding_box,
    get_active_poi_batch_id,
)

logger = logging.getLogger(__name__)

def get_pois_for_stop_buffer(isochrone_fc: dict, user: Optional[object] = None, project_id=None, poi_batch_id=None):
    """
    Fetch POIs within each stop buffer polygon.

    Parameters:
    - isochrone_fc (dict): FeatureCollection of buffer polygons.
    - user (object|None): Request user for POI filtering.
    - project_id (str|None): Project identifier.
    - poi_batch_id (str|None): POI batch identifier or "default".

    Returns:
    - list[dict]: POIs grouped by stop group.
    """
    if not isochrone_fc or isochrone_fc.get("type") != "FeatureCollection":
        return []

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

    poi_graph = []

    for feature in isochrone_fc.get("features", []):
        props = feature.get("properties") or {}
        group_id = props.get("group_id")
        geom = feature.get("geometry")
        if not group_id or not geom:
            continue

        poly = shape(geom)
        min_lon, min_lat, max_lon, max_lat = poly.bounds

        base_filter = dict(
            lat__isnull=False, lng__isnull=False,
            lat__gte=min_lat, lat__lte=max_lat,
            lng__gte=min_lon, lng__lte=max_lon,
        )
        if poi_batch_id:
            base_filter["batch_id"] = poi_batch_id
        if project_id:
            base_filter["project_id"] = project_id
        else:
            base_filter["user"] = user
            base_filter["project_id__isnull"] = True

        qs = (
            PointOfInterests.objects
            .filter(**base_filter)
            .only("id", "type", "name", "lat", "lng")
        )

        grouped = defaultdict(list)
        for poi in qs:
            lat = float(poi.lat)
            lng = float(poi.lng)
            if poly.contains(Point(lng, lat)):
                grouped[poi.type or "Unknown"].append({
                    "poi_name": poi.name or "",
                    "lat": lat,
                    "lng": lng,
                })

        if not grouped:
            continue

        pois_list = [{"type": t, "data": items} for t, items in grouped.items()]
        poi_graph.append({"id": str(group_id), "pois": pois_list})

    return poi_graph


def _global_bbox_from_features(isochrone_fc: dict):
    """
    Build a global bounding box from FeatureCollection polygons.

    Parameters:
    - isochrone_fc (dict): FeatureCollection of polygons.

    Returns:
    - tuple: (bbox, poly_list) where bbox is dict or None.
    """
    min_lon = min_lat = float("inf")
    max_lon = max_lat = float("-inf")
    polys = []

    for f in isochrone_fc.get("features", []):
        geom = f.get("geometry")
        if not geom:
            continue
        poly = shape(geom)
        polys.append((f, poly))
        lon_min, lat_min, lon_max, lat_max = poly.bounds
        min_lon = min(min_lon, lon_min)
        min_lat = min(min_lat, lat_min)
        max_lon = max(max_lon, lon_max)
        max_lat = max(max_lat, lat_max)

    if not polys:
        return None, []

    bbox = {
        "top_left": {"lat": max_lat, "lon": min_lon},
        "bottom_right": {"lat": min_lat, "lon": max_lon},
    }
    return bbox, polys


def _fetch_internal_pois_global(bbox, user=None, project_id=None, batch_id=None):
    """
    Fetch internal (DB) POIs inside a bounding box.

    Parameters:
    - bbox (dict): Bounding box with top_left/bottom_right.
    - user (object|None): Request user for POI filtering.
    - project_id (str|None): Project identifier.
    - batch_id (str|None): POI batch identifier.

    Returns:
    - list[dict]: POIs from database.
    """
    min_lat = bbox["bottom_right"]["lat"]
    max_lat = bbox["top_left"]["lat"]
    min_lon = bbox["top_left"]["lon"]
    max_lon = bbox["bottom_right"]["lon"]

    filters = dict(
        lat__isnull=False, lng__isnull=False,
        lat__gte=min_lat, lat__lte=max_lat,
        lng__gte=min_lon, lng__lte=max_lon,
    )
    if batch_id is not None:
        filters["batch_id"] = batch_id
    if project_id is not None:
        filters["project_id"] = project_id
    elif user is not None:
        filters["user"] = user
        filters["project_id__isnull"] = True

    qs = (
        PointOfInterests.objects
        .filter(**filters)
        .only("id", "type", "name", "lat", "lng")
    )

    out = []
    for p in qs:
        out.append({
            "type": p.type or "Unknown",
            "poi_name": p.name or "",
            "lat": float(p.lat),
            "lng": float(p.lng),
            "_source": "db",
        })
    return out


@log_service_call
def _fetch_mlit_pois_global(bbox, dataset_ids, batch_size=200):
    """
    Fetch MLIT POIs inside a bounding box for datasets.

    Parameters:
    - bbox (dict): Bounding box with top_left/bottom_right.
    - dataset_ids (list[str]): MLIT dataset ids.
    - batch_size (int): Query batch size.

    Returns:
    - list[dict]: POIs from MLIT.
    """
    results = []
    tl = bbox["top_left"]
    br = bbox["bottom_right"]

    for ds in dataset_ids or []:
        try:
            mlit_items = fetch_POIs_by_bounding_box(
                top_left=tl,
                bottom_right=br,
                dataset_id=ds,
                batch_size=batch_size,
            )
        except Exception as exc:
            log_json(
                logger,
                logging.WARNING,
                "mlit_poi_fetch_failed",
                dataset_id=str(ds),
                error=str(exc),
                top_left=tl,
                bottom_right=br,
                batch_size=batch_size,
            )
            mlit_items = []

        label_enum = MLITDatasetLabel.from_dataset_id(ds)
        label = label_enum.value if label_enum else f"MLIT:{ds}"
        for it in mlit_items:
            lat = float(it.get("lat"))
            lon = float(it.get("lon"))
            results.append({
                "type": label,
                "poi_name": it.get("title") or "",
                "address": it.get("address") or "",
                "lat": lat,
                "lng": lon,
                "_source": "mlit",
            })
    return results


def get_pois_for_stop_buffer_combined(isochrone_fc: dict, dataset_ids=None, user=None, project_id=None, poi_batch_id=None):
    """
    Fetch POIs for stop buffers from DB or MLIT.

    Parameters:
    - isochrone_fc (dict): FeatureCollection of buffer polygons.
    - dataset_ids (list[str]|None): MLIT dataset ids.
    - user (object|None): Request user for POI filtering.
    - project_id (str|None): Project identifier.
    - poi_batch_id (str|None): POI batch identifier or "default".

    Returns:
    - list[dict]: POIs grouped by stop group.
    """
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

    if not isochrone_fc or isochrone_fc.get("type") != "FeatureCollection":
        return []

    bbox, poly_list = _global_bbox_from_features(isochrone_fc)
    if not bbox:
        return []

    if poi_batch_id:
        internal_pois = _fetch_internal_pois_global(
            bbox, user=user, project_id=project_id, batch_id=poi_batch_id
        )
        mlit_pois = []
    else:
        internal_pois = []
        mlit_pois = _fetch_mlit_pois_global(
            bbox,
            dataset_ids=dataset_ids or [SCHOOL_DATASET_ID, MEDICAL_INSTITUTION_DATASET_ID],
            batch_size=200,
        )

    all_pois = internal_pois + mlit_pois

    logger.info(
        "[StopRadius POI] user=%s batch_id=%s internal_count=%d mlit_count=%d total=%d",
        getattr(user, "id", None),
        poi_batch_id,
        len(internal_pois),
        len(mlit_pois),
        len(all_pois),
    )

    all_points = [(poi, Point(poi["lng"], poi["lat"])) for poi in all_pois]

    poi_graph = []
    for f, poly in poly_list:
        props = f.get("properties") or {}
        group_id = props.get("group_id")
        if not group_id:
            continue

        grouped = defaultdict(list)

        lon_min, lat_min, lon_max, lat_max = poly.bounds

        for poi, pt in all_points:
            if not (lat_min <= poi["lat"] <= lat_max and lon_min <= poi["lng"] <= lon_max):
                continue
            if not poly.contains(pt):
                continue
            grouped[poi["type"]].append({
                "poi_name": poi["poi_name"],
                "lat": poi["lat"],
                "lng": poi["lng"],
                "address": poi.get("address") or "",
            })

        if not grouped:
            poi_graph.append({"id": str(group_id), "pois": []})
            continue

        pois_list = [{"type": t, "data": items} for t, items in grouped.items()]
        poi_graph.append({
            "id": str(group_id),
            "pois": pois_list,
        })

    return poi_graph


def summarize_pois_for_union(poi_graph):
    """
    Summarize POIs across all stop groups.

    Parameters:
    - poi_graph (list[dict]): POI graph grouped by stop group.

    Returns:
    - tuple: (poi_summary, poi_for_map).
    """
    bucket = defaultdict(list)
    for g in poi_graph or []:
        for cat in g.get("pois", []):
            t = cat.get("type") or "Unknown"
            for p in (cat.get("data") or []):
                bucket[t].append({
                    "type": t,
                    "poi_name": p.get("poi_name") or "",
                    "lat": float(p.get("lat")),
                    "lng": float(p.get("lng")),
                    "address": p.get("address") or "",
                })

    poi_summary = [{"type": t, "count": len(items)} for t, items in bucket.items()]
    poi_for_map = [pt for items in bucket.values() for pt in items]
    poi_summary.sort(key=lambda x: (-x["count"], x["type"]))
    return poi_summary, poi_for_map
