from collections import defaultdict

from gtfs.models import Scenario, Stops

from visualization.services.base import ServiceError
from visualization.utils.od_analysis_utils import (
    DATE_ALL_LABEL,
    build_stop_id_group_details,
    build_stop_id_group_maps,
    build_stop_name_group_details,
    build_stop_name_group_maps,
    split_valid_invalid,
    split_valid_invalid_upload,
    split_valid_invalid_usage,
)
from visualization.constants.messages import Messages


def build_upload_payload(scenario_id: str, od_data: list[dict]) -> dict:
    """
    Validate OD upload data and summarize stop availability.

    Parameters:
    - scenario_id (str): Scenario identifier.
    - od_data (list[dict]): Raw OD rows from client.

    Returns:
    - dict: Upload summary with availability and invalid row details.
    """
    scenario = Scenario.objects.filter(id=scenario_id).first()
    if not scenario:
        raise ServiceError(Messages.SCENARIO_NOT_FOUND_EN, status_code=404)

    _, invalid_data = split_valid_invalid_upload(od_data)

    stopid_geton_list = [od.get("stopid_geton") for od in od_data if od.get("stopid_geton")]
    stopid_getoff_list = [od.get("stopid_getoff") for od in od_data if od.get("stopid_getoff")]

    stopid_geton_set = set(stopid_geton_list)
    stopid_getoff_set = set(stopid_getoff_list)

    available_geton = set(
        Stops.objects
        .filter(stop_id__in=stopid_geton_set, scenario_id=scenario_id)
        .values_list("stop_id", flat=True)
    )
    available_getoff = set(
        Stops.objects
        .filter(stop_id__in=stopid_getoff_set, scenario_id=scenario_id)
        .values_list("stop_id", flat=True)
    )

    stopid_geton_result = [
        {"stop_id": stop_id, "is_available": stop_id in available_geton}
        for stop_id in stopid_geton_set
    ]
    stopid_getoff_result = [
        {"stop_id": stop_id, "is_available": stop_id in available_getoff}
        for stop_id in stopid_getoff_set
    ]

    total_data_stopid_geton_uploaded = len(stopid_geton_list)
    available_geton_data = sum(1 for stop_id in stopid_geton_list if stop_id in available_geton)
    not_available_geton_data = total_data_stopid_geton_uploaded - available_geton_data

    total_data_stopid_getoff_uploaded = len(stopid_getoff_list)
    available_getoff_data = sum(1 for stop_id in stopid_getoff_list if stop_id in available_getoff)
    not_available_getoff_data = total_data_stopid_getoff_uploaded - available_getoff_data

    return {
        "stopid_geton": stopid_geton_result,
        "stopid_getoff": stopid_getoff_result,
        "total_data_stopid_geton_uploaded": total_data_stopid_geton_uploaded,
        "available_geton_data": available_geton_data,
        "not_available_geton_data": not_available_geton_data,
        "total_data_stopid_getoff_uploaded": total_data_stopid_getoff_uploaded,
        "available_getoff_data": available_getoff_data,
        "not_available_getoff_data": not_available_getoff_data,
        "invalid_data": invalid_data,
    }


def build_usage_distribution_payload(
    scenario_id: str,
    od_data: list[dict],
    selected_date: str | None,
) -> dict:
    """
    Build usage distribution GeoJSON grouped by stop grouping method.

    Parameters:
    - scenario_id (str): Scenario identifier.
    - od_data (list[dict]): Validated OD rows.
    - selected_date (str | None): Optional date filter.

    Returns:
    - dict: GeoJSON plus metadata for usage distribution.
    """
    if not scenario_id:
        raise ServiceError(Messages.OD_SCENARIO_ID_REQUIRED_EN, status_code=400)

    valid_od, invalid_data = split_valid_invalid_usage(od_data)

    scenario = Scenario.objects.filter(id=scenario_id).first()
    grouping_method = scenario.stops_grouping_method if scenario else None

    date_options = [DATE_ALL_LABEL] + sorted({row.get("date") for row in valid_od if row.get("date")})

    rows = valid_od
    if selected_date and selected_date != DATE_ALL_LABEL:
        rows = [row for row in valid_od if row.get("date") == selected_date]

    if grouping_method == "stop_name":
        stop_keywords, _, stopid_to_groups, _ = build_stop_name_group_maps(scenario_id)

        group_geton = defaultdict(int)
        group_getoff = defaultdict(int)

        for od in rows:
            geton_id = od.get("stopid_geton")
            getoff_id = od.get("stopid_getoff")
            cnt = int(od.get("count", 0))

            for gid in stopid_to_groups.get(geton_id, []):
                group_geton[gid] += cnt
            for gid in stopid_to_groups.get(getoff_id, []):
                group_getoff[gid] += cnt

        features = []
        for kw in stop_keywords:
            gid_key = str(kw.stop_group_id)
            has_any_count = (gid_key in group_geton) or (gid_key in group_getoff)
            if not has_any_count:
                continue

            total_geton = group_geton.get(gid_key, 0)
            total_getoff = group_getoff.get(gid_key, 0)
            total_geton_getoff = total_geton + total_getoff

            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [kw.stop_names_long, kw.stop_names_lat]
                },
                "properties": {
                    "stop_name": kw.stop_name_keyword,
                    "stop_group_id": kw.stop_group_id,
                    "total_geton": total_geton,
                    "total_getoff": total_getoff,
                    "total_geton_getoff": total_geton_getoff
                }
            })

        geojson = {"type": "FeatureCollection", "features": features}
        return {
            "geojson": geojson,
            "date_options": date_options,
            "table_data": None,
            "invalid_data": invalid_data,
            "valid_count": len(valid_od),
            "invalid_count": len(invalid_data),
        }

    if grouping_method == "stop_id":
        stop_keywords, _, stopid_to_groups, _ = build_stop_id_group_maps(scenario_id)

        group_geton = defaultdict(int)
        group_getoff = defaultdict(int)

        for od in rows:
            geton_id = od.get("stopid_geton")
            getoff_id = od.get("stopid_getoff")
            cnt = int(od.get("count", 0))

            for gid in stopid_to_groups.get(geton_id, []):
                group_geton[gid] += cnt
            for gid in stopid_to_groups.get(getoff_id, []):
                group_getoff[gid] += cnt

        features = []
        for kw in stop_keywords:
            gid = kw.stop_group_id
            has_any_count = (gid in group_geton) or (gid in group_getoff)
            if not has_any_count:
                continue

            total_geton = group_geton.get(gid, 0)
            total_getoff = group_getoff.get(gid, 0)
            total_geton_getoff = total_geton + total_getoff

            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [kw.stop_id_long, kw.stop_id_lat]
                },
                "properties": {
                    "stop_name": kw.stop_id_keyword,
                    "stop_group_id": gid,
                    "total_geton": total_geton,
                    "total_getoff": total_getoff,
                    "total_geton_getoff": total_geton_getoff
                }
            })

        geojson = {"type": "FeatureCollection", "features": features}
        return {
            "geojson": geojson,
            "date_options": date_options,
            "table_data": None,
            "invalid_data": invalid_data,
            "valid_count": len(valid_od),
            "invalid_count": len(invalid_data),
        }

    raise ServiceError(Messages.OD_UNKNOWN_GROUPING_METHOD_EN, status_code=400)


def build_last_first_stop_payload(
    scenario_id: str,
    od_data: list[dict],
    selected_date: str | None,
    stop_type: str | None,
) -> dict:
    """
    Build last/first stop GeoJSON with child features per parent stop.

    Parameters:
    - scenario_id (str): Scenario identifier.
    - od_data (list[dict]): Validated OD rows.
    - selected_date (str | None): Optional date filter.
    - stop_type (str | None): "first_stop" or "last_stop".

    Returns:
    - dict: GeoJSON plus metadata for last/first stop analysis.
    """
    valid_od, _ = split_valid_invalid(od_data)

    scenario = Scenario.objects.filter(id=scenario_id).first()
    grouping_method = (scenario.stops_grouping_method if scenario else None) or "stop_name"

    date_options = [DATE_ALL_LABEL] + sorted({od.get("date") for od in valid_od if od.get("date")})

    if selected_date and selected_date != DATE_ALL_LABEL:
        valid_od = [od for od in valid_od if od.get("date") == selected_date]

    od_rows = valid_od
    features = []

    if grouping_method == "stop_name":
        stop_keywords, group_to_keyword, stopid_to_groups, group_to_stopids_set = build_stop_name_group_maps(scenario_id)

        for kw in stop_keywords:
            kw_group_id_str = str(kw.stop_group_id)
            parent_stop_ids = group_to_stopids_set.get(kw_group_id_str, set())

            child_features = []
            if stop_type == "first_stop":
                filtered_od = [od for od in od_rows if od.get("stopid_geton") in parent_stop_ids]
                dest_counter = defaultdict(int)
                for od in filtered_od:
                    dest_stopid = od.get("stopid_getoff")
                    dest_counter[dest_stopid] += int(od.get("count", 0))

                for dest_stopid, total in dest_counter.items():
                    dest_group_ids = stopid_to_groups.get(dest_stopid, set())
                    for dest_group_id in dest_group_ids:
                        dest_kw = group_to_keyword.get(dest_group_id)
                        if dest_kw:
                            child_features.append({
                                "type": "Feature",
                                "geometry": {
                                    "type": "Point",
                                    "coordinates": [dest_kw.stop_names_long, dest_kw.stop_names_lat]
                                },
                                "properties": {
                                    "stop_name": dest_kw.stop_name_keyword,
                                    "stop_group_id": dest_kw.stop_group_id,
                                    "total": total
                                }
                            })
            elif stop_type == "last_stop":
                filtered_od = [od for od in od_rows if od.get("stopid_getoff") in parent_stop_ids]
                origin_counter = defaultdict(int)
                for od in filtered_od:
                    origin_stopid = od.get("stopid_geton")
                    origin_counter[origin_stopid] += int(od.get("count", 0))

                for origin_stopid, total in origin_counter.items():
                    origin_group_ids = stopid_to_groups.get(origin_stopid, set())
                    for origin_group_id in origin_group_ids:
                        origin_kw = group_to_keyword.get(origin_group_id)
                        if origin_kw:
                            child_features.append({
                                "type": "Feature",
                                "geometry": {
                                    "type": "Point",
                                    "coordinates": [origin_kw.stop_names_long, origin_kw.stop_names_lat]
                                },
                                "properties": {
                                    "stop_name": origin_kw.stop_name_keyword,
                                    "stop_group_id": origin_kw.stop_group_id,
                                    "total": total
                                }
                            })

            total_child = sum(cf["properties"]["total"] for cf in child_features) if child_features else 0

            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [kw.stop_names_long, kw.stop_names_lat]
                },
                "properties": {
                    "stop_name": kw.stop_name_keyword,
                    "stop_group_id": kw.stop_group_id,
                    "total": total_child,
                    "child_features": child_features
                }
            })

    elif grouping_method == "stop_id":
        stop_keywords, group_to_keyword, stopid_to_groups, group_to_stopids_set = build_stop_id_group_maps(scenario_id)

        for kw in stop_keywords:
            parent_stop_ids = group_to_stopids_set.get(kw.stop_group_id, set())

            child_features = []
            if stop_type == "first_stop":
                filtered_od = [od for od in od_rows if od.get("stopid_geton") in parent_stop_ids]
                dest_counter = defaultdict(int)
                for od in filtered_od:
                    dest_stopid = od.get("stopid_getoff")
                    dest_counter[dest_stopid] += int(od.get("count", 0))

                for dest_stopid, total in dest_counter.items():
                    dest_group_ids = stopid_to_groups.get(dest_stopid, set())
                    for dest_group_id in dest_group_ids:
                        dest_kw = group_to_keyword.get(dest_group_id)
                        if dest_kw:
                            child_features.append({
                                "type": "Feature",
                                "geometry": {
                                    "type": "Point",
                                    "coordinates": [dest_kw.stop_id_long, dest_kw.stop_id_lat]
                                },
                                "properties": {
                                    "stop_name": dest_kw.stop_id_keyword,
                                    "stop_group_id": dest_kw.stop_group_id,
                                    "total": total
                                }
                            })

            elif stop_type == "last_stop":
                filtered_od = [od for od in od_rows if od.get("stopid_getoff") in parent_stop_ids]
                origin_counter = defaultdict(int)
                for od in filtered_od:
                    origin_stopid = od.get("stopid_geton")
                    origin_counter[origin_stopid] += int(od.get("count", 0))

                for origin_stopid, total in origin_counter.items():
                    origin_group_ids = stopid_to_groups.get(origin_stopid, set())
                    for origin_group_id in origin_group_ids:
                        origin_kw = group_to_keyword.get(origin_group_id)
                        if origin_kw:
                            child_features.append({
                                "type": "Feature",
                                "geometry": {
                                    "type": "Point",
                                    "coordinates": [origin_kw.stop_id_long, origin_kw.stop_id_lat]
                                },
                                "properties": {
                                    "stop_name": origin_kw.stop_id_keyword,
                                    "stop_group_id": origin_kw.stop_group_id,
                                    "total": total
                                }
                            })

            total_child = sum(cf["properties"]["total"] for cf in child_features) if child_features else 0

            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [kw.stop_id_long, kw.stop_id_lat]
                },
                "properties": {
                    "stop_name": kw.stop_id_keyword,
                    "stop_group_id": kw.stop_group_id,
                    "total": total_child,
                    "child_features": child_features
                }
            })

    geojson = {
        "type": "FeatureCollection",
        "features": features,
    }

    return {
        "geojson": geojson,
        "date_options": date_options,
        "table_data": None,
    }


def build_bus_stop_payload(
    scenario_id: str,
    od_data: list[dict],
    selected_date: str | None,
) -> dict:
    """
    Build bus-stop OD pairs grouped by parent stops.

    Parameters:
    - scenario_id (str): Scenario identifier.
    - od_data (list[dict]): Validated OD rows.
    - selected_date (str | None): Optional date filter.

    Returns:
    - dict: Bus stop pairs and date options.
    """
    valid_od, _ = split_valid_invalid(od_data)

    date_options = [DATE_ALL_LABEL] + sorted({od.get("date") for od in valid_od if od.get("date")})

    scenario = Scenario.objects.filter(id=scenario_id).first()
    grouping_method = (scenario.stops_grouping_method if scenario else None) or "stop_name"

    if selected_date and selected_date != DATE_ALL_LABEL:
        valid_od = [od for od in valid_od if od.get("date") == selected_date]

    od_rows = valid_od

    if grouping_method == "stop_name":
        stopid_to_group, stop_groups = build_stop_name_group_details(scenario_id)

        processed_od = []
        for od in od_rows:
            geton_id = od.get("stopid_geton")
            getoff_id = od.get("stopid_getoff")
            geton_group_id = stopid_to_group.get(geton_id)
            getoff_group_id = stopid_to_group.get(getoff_id)

            if geton_group_id is not None and getoff_group_id is not None:
                geton_obj = {
                    "stop_id": geton_id,
                    "stop_group_id": geton_group_id,
                    **stop_groups.get(str(geton_group_id), {})
                }
                getoff_obj = {
                    "stop_id": getoff_id,
                    "stop_group_id": getoff_group_id,
                    **stop_groups.get(str(getoff_group_id), {})
                }
                processed_od.append({
                    "date": od.get("date"),
                    "agency_id": od.get("agency_id"),
                    "route_id": od.get("route_id"),
                    "stopid_geton": geton_obj,
                    "stopid_getoff": getoff_obj,
                    "count": int(od.get("count", 0))
                })

        merged = {}
        for od in processed_od:
            key = (
                od["stopid_geton"]["stop_group_id"],
                od["stopid_getoff"]["stop_group_id"]
            )
            if key not in merged:
                merged[key] = {
                    "stopid_geton": od["stopid_geton"],
                    "stopid_getoff": od["stopid_getoff"],
                    "count": 0
                }
            merged[key]["count"] += od["count"]

        result = list(merged.values())
        return {
            "bus_stop_data": result,
            "date_options": date_options,
        }

    if grouping_method == "stop_id":
        stopid_to_group, stop_groups = build_stop_id_group_details(scenario_id)

        processed_od = []
        for od in od_rows:
            geton_id = od.get("stopid_geton")
            getoff_id = od.get("stopid_getoff")
            geton_group_id = stopid_to_group.get(geton_id)
            getoff_group_id = stopid_to_group.get(getoff_id)

            if geton_group_id is not None and getoff_group_id is not None:
                geton_obj = {
                    "stop_id": geton_id,
                    "stop_group_id": geton_group_id,
                    **stop_groups.get(str(geton_group_id), {})
                }
                getoff_obj = {
                    "stop_id": getoff_id,
                    "stop_group_id": getoff_group_id,
                    **stop_groups.get(str(getoff_group_id), {})
                }
                processed_od.append({
                    "date": od.get("date"),
                    "agency_id": od.get("agency_id"),
                    "route_id": od.get("route_id"),
                    "stopid_geton": geton_obj,
                    "stopid_getoff": getoff_obj,
                    "count": int(od.get("count", 0))
                })

        merged = {}
        for od in processed_od:
            key = (
                od["stopid_geton"]["stop_group_id"],
                od["stopid_getoff"]["stop_group_id"]
            )
            if key not in merged:
                merged[key] = {
                    "stopid_geton": od["stopid_geton"],
                    "stopid_getoff": od["stopid_getoff"],
                    "count": 0
                }
            merged[key]["count"] += od["count"]

        result = list(merged.values())
        return {
            "bus_stop_data": result,
            "date_options": date_options,
        }

    return {
        "bus_stop_data": [],
        "date_options": date_options,
    }
