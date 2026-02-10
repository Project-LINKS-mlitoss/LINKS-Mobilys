import json

import requests
from shapely.geometry import Polygon, MultiPolygon, shape, Point
from django.conf import settings
from django.db import connection

from visualization.constants import (
    DEFAULT_POI_QUERY_RADIUS_M,
    MLIT_QUERY_SIZE,
    MLIT_TIMEOUT_SECONDS,
    MLITDatasetLabel,
    MLITDataset,
)
from visualization.models import PointOfInterests, PoiBatch
from visualization.constants.messages import Messages


END_POINT = settings.MLIT_API_URL
API_KEY = settings.MLIT_API_KEY


def _normalize_title_address(dataset_id: str, rec: dict) -> dict:
    """
    Normalize MLIT title/address fields based on dataset metadata.

    Parameters:
    - dataset_id (str): MLIT dataset id.
    - rec (dict): Raw record.

    Returns:
    - dict: Updated record.
    """
    ds = (dataset_id or rec.get("dataset_id") or "").strip().lower()
    md = rec.get("metadata") or {}
    title, address = rec.get("title"), None
    if ds == "nlni_ksj-p04":
        md_title = md.get("NLNI:P04_002")
        if isinstance(md_title, str) and md_title.strip():
            title = md_title.strip()
        address = md.get("NLNI:P04_003")
    elif ds == "nlni_ksj-p29":
        address = md.get("DPF:address")
    if isinstance(address, str) and address.strip().lower() == "null":
        address = None
    rec["title"], rec["address"] = title, address
    return rec


def post_query(query: str):
    """
    Execute MLIT GraphQL query.

    Parameters:
    - query (str): GraphQL query string.

    Returns:
    - dict: MLIT response data.
    """
    resp = requests.post(
        END_POINT,
        headers={"Content-Type": "application/json", "apikey": API_KEY},
        json={"query": query},
        timeout=MLIT_TIMEOUT_SECONDS,
    )
    resp.raise_for_status()
    return resp.json()["data"]


def make_search_query(min_lat, min_lon, max_lat, max_lon, dataset_id, size=MLIT_QUERY_SIZE):
    """
    Build MLIT GraphQL search query.

    Parameters:
    - min_lat (float): Min latitude.
    - min_lon (float): Min longitude.
    - max_lat (float): Max latitude.
    - max_lon (float): Max longitude.
    - dataset_id (str): MLIT dataset id.
    - size (int): Query size.

    Returns:
    - str: GraphQL query string.
    """
    return (
        f"""query {{search(term: "" phraseMatch: false first: 0 size: {size} """
        f"""locationFilter: {{rectangle: {{topLeft: {{lat: {max_lat}, lon: {min_lon}}} """
        f"""bottomRight: {{lat: {min_lat}, lon: {max_lon}}}}}}} """
        f"""attributeFilter: {{attributeName: "DPF:dataset_id", is: "{dataset_id}"}}) """
        f"""{{totalNumber searchResults {{id title dataset_id lat lon metadata}}}}}}"""
    )


def get_poi_in_polygon(polygon_coords):
    """
    Fetch MLIT POIs within a polygon.

    Parameters:
    - polygon_coords (list): Polygon coordinates.

    Returns:
    - dict: FeatureCollection of POIs.
    """
    poly = Polygon(polygon_coords)
    minx, miny, maxx, maxy = poly.bounds
    features = []
    for dataset in MLITDataset:
        dataset_id = dataset.value
        res1 = post_query(make_search_query(miny, minx, maxy, maxx, dataset_id))
        raw = res1.get("search", {}).get("searchResults", []) or []
        inside = [feat for feat in raw if poly.contains(Point(feat["lon"], feat["lat"]))]
        for r in inside:
            r["dataset_id"] = dataset_id
            _normalize_title_address(dataset_id, r)
        features.extend(inside)
    return {"type": "FeatureCollection", "features": features}


def get_poi_in_multi_polygon(geom_or_coords):
    """
    Fetch MLIT POIs within a multipolygon.

    Parameters:
    - geom_or_coords (dict|list): GeoJSON geometry or coordinates.

    Returns:
    - dict: FeatureCollection of POIs.
    """
    if isinstance(geom_or_coords, dict) and "type" in geom_or_coords:
        g = shape(geom_or_coords)
        if g.is_empty:
            raise ValueError(Messages.BUFFER_ANALYSIS_EMPTY_GEOMETRY_EN)
        multi = MultiPolygon([g]) if g.geom_type == "Polygon" else g
    else:
        multi = _multipolygon_from_coordinates(geom_or_coords)
    minx, miny, maxx, maxy = multi.bounds
    features = []
    for dataset in MLITDataset:
        dataset_id = dataset.value
        res1 = post_query(make_search_query(miny, minx, maxy, maxx, dataset_id))
        raw = res1.get("search", {}).get("searchResults", []) or []
        inside = [r for r in raw if multi.contains(Point(r["lon"], r["lat"]))]
        for r in inside:
            r["dataset_id"] = dataset_id
            _normalize_title_address(dataset_id, r)
        features.extend(inside)
    return {"type": "FeatureCollection", "features": features}


def _multipolygon_from_coordinates(coords):
    """
    Convert coordinate arrays to a MultiPolygon.

    Parameters:
    - coords (list): Polygon or multipolygon coordinates.

    Returns:
    - MultiPolygon: Shapely MultiPolygon.
    """
    def _close_and_cast(ring):
        if not ring or len(ring) < 3:
            return None
        clean = [(float(p[0]), float(p[1])) for p in ring]
        if clean[0] != clean[-1]:
            clean = clean + [clean[0]]
        return clean if len(clean) >= 4 else None

    is_polygon_like = (
        isinstance(coords, (list, tuple))
        and coords
        and isinstance(coords[0], (list, tuple))
        and coords[0]
        and isinstance(coords[0][0], (list, tuple))
        and len(coords) >= 1
        and isinstance(coords[0][0][0], (int, float))
    )
    polygons_raw = [coords] if is_polygon_like else coords
    polys = []
    for poly in polygons_raw or []:
        if not poly:
            continue
        shell = _close_and_cast(poly[0])
        if not shell:
            continue
        holes = []
        for h in poly[1:] if len(poly) > 1 else []:
            if h and isinstance(h[0], (list, tuple)) and h and isinstance(h[0][0], (list, tuple)):
                h = h[0]
            h_clean = _close_and_cast(h)
            if h_clean:
                holes.append(h_clean)
        polys.append(Polygon(shell, holes if holes else None))
    if not polys:
        raise ValueError(Messages.BUFFER_ANALYSIS_INVALID_DATA_EN)
    return MultiPolygon(polys)


def get_POI_on_buffer_area_with_MLIT(input_geojson):
    """
    Fetch MLIT POIs within buffer area polygons.

    Parameters:
    - input_geojson (dict): Buffer GeoJSON.

    Returns:
    - dict: FeatureCollection of MLIT POIs.
    """
    all_features = []
    for feature in input_geojson.get("features", []):
        geom = feature.get("geometry", {})
        if geom.get("type") == "Polygon":
            all_features.extend(get_poi_in_polygon(geom["coordinates"][0]).get("features", []))
        elif geom.get("type") == "MultiPolygon":
            all_features.extend(get_poi_in_multi_polygon(geom["coordinates"]).get("features", []))
    return {"type": "FeatureCollection", "features": all_features}


def get_POI_graph_on_buffer_area_MLIT(amenity_geojson):
    """
    Group MLIT POIs by dataset for graph display.

    Parameters:
    - amenity_geojson (dict): FeatureCollection of MLIT POIs.

    Returns:
    - list[dict]: Grouped POI payload.
    """
    poi_dict = {}
    for feature in amenity_geojson.get("features", []):
        dataset_id = feature.get("dataset_id")
        label_enum = MLITDatasetLabel.from_dataset_id(dataset_id)
        if not label_enum:
            continue
        poi_type = label_enum.value
        name = feature.get("title")
        if not name:
            continue
        if poi_type not in poi_dict:
            poi_dict[poi_type] = []
        poi_dict[poi_type].append({
            "poi_name": name,
            "lat": feature.get("lat"),
            "lon": feature.get("lon"),
            "address": feature.get("address"),
        })
    return [{"poi_type": pt, "details": d} for pt, d in poi_dict.items()]


def get_poi_from_db_buffer(mlit_poi_data, geojson, user_id=None, project_id=None, poi_batch_id=None):
    """
    Merge MLIT POIs with database POIs within buffer area.

    Parameters:
    - mlit_poi_data (list[dict]): MLIT POI data.
    - geojson (dict): Buffer GeoJSON.
    - user_id (int|None): User id.
    - project_id (str|None): Project id.
    - poi_batch_id (str|None): Batch id.

    Returns:
    - list[dict]: Merged POI payload.
    """
    if poi_batch_id == "default":
        poi_batch_id = None
    if not poi_batch_id and project_id:
        from visualization.services.poi_service import get_active_poi_batch_id
        poi_batch_id = get_active_poi_batch_id(project_id)
    elif not poi_batch_id and user_id and not project_id:
        active = (
            PoiBatch.objects.filter(
                user_id=user_id,
                project_id__isnull=True,
                is_active=True,
            )
            .order_by("-created_at")
            .first()
        )
        poi_batch_id = str(active.id) if active else None

    if project_id:
        if poi_batch_id:
            is_active = PoiBatch.objects.filter(
                id=poi_batch_id, project_id=project_id, is_active=True
            ).exists()
            if not is_active:
                poi_batch_id = None
        if not poi_batch_id:
            return mlit_poi_data
    else:
        if poi_batch_id:
            is_active = PoiBatch.objects.filter(
                id=poi_batch_id,
                user_id=user_id,
                project_id__isnull=True,
                is_active=True,
            ).exists()
            if not is_active:
                poi_batch_id = None
        if not poi_batch_id:
            return mlit_poi_data

    base_filter = {}
    if poi_batch_id:
        base_filter["batch_id"] = poi_batch_id
    if project_id:
        base_filter["project_id"] = project_id
    else:
        base_filter["user_id"] = user_id
        base_filter["project_id__isnull"] = True

    if not PointOfInterests.objects.filter(**base_filter).exists():
        return [] if project_id else mlit_poi_data

    poly_feat = next(
        (f for f in geojson["features"] if f["geometry"]["type"] in ("Polygon", "MultiPolygon")),
        None,
    )
    if not poly_feat:
        raise ValueError(Messages.BUFFER_ANALYSIS_NO_POLYGON_FOUND_EN)
    user_clause = "batch_id = %s" if poi_batch_id else ("project_id = %s" if project_id else "user_id = %s")
    sql = (
        f"SELECT DISTINCT id, type, name, lat, lng "
        f"FROM point_of_interests "
        f"WHERE {user_clause} "
        f"AND ST_DWithin("
        f"  ST_SetSRID(ST_MakePoint(lng::float, lat::float), 4326)::geography, "
        f"  ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)::geography, %s"
        f");"
    )
    with connection.cursor() as cur:
        cur.execute(sql, [poi_batch_id or project_id or user_id, json.dumps(poly_feat["geometry"]), DEFAULT_POI_QUERY_RADIUS_M])
        pois = [dict(zip([c[0] for c in cur.description], row)) for row in cur.fetchall()]
    type_map = {}
    for poi in pois:
        t = poi["type"]
        if t not in type_map:
            type_map[t] = []
        type_map[t].append({
            "poi_name": poi["name"],
            "lat": poi["lat"],
            "lon": poi["lng"],
        })
    return [{"poi_type": pt, "details": d} for pt, d in type_map.items()]
