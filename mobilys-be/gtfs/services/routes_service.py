from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Optional

from django.db.models import Count
from rest_framework import status

from gtfs.constants import ErrorMessages
from gtfs.models import (
    Routes,
    RouteKeywordMap,
    RouteKeywords,
    Scenario,
    Shape,
    StopIdKeyword,
    StopIdKeywordMap,
    StopNameKeywords,
    StopNameKeywordMap,
    Stops,
    StopTimes,
    Trips,
)
from gtfs.services.base import log_service_call, transactional
from gtfs.utils.route_data_utils import RouteDataUtils
from gtfs.utils.route_group_sorter import route_id_sort_key
from gtfs.utils.scenario_utils import update_scenario_edit_state
from mobilys_BE.shared.log_json import log_json

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RoutesServiceError(Exception):
    message: str
    error: Any
    status_code: int
    data: Optional[dict[str, Any]] = None


@log_service_call
class RoutesGroupingService:
    @staticmethod
    def build_grouping_data(*, scenario_id: str, kw_param: str) -> dict[str, Any]:
        kw_param = (kw_param or "").strip()
        query_tokens = {t for t in (kw_param.split(",") if kw_param else []) if t}

        try:
            scenario = Scenario.objects.get(id=scenario_id)
        except Scenario.DoesNotExist as e:
            raise RoutesServiceError(
                message=ErrorMessages.SCENARIO_NOT_FOUND_JA,
                error=ErrorMessages.SCENARIO_NOT_FOUND_JA,
                status_code=status.HTTP_404_NOT_FOUND,
            ) from e

        try:
            routes_qs = Routes.objects.filter(scenario_id=scenario_id)
            trips_qs = Trips.objects.filter(scenario_id=scenario_id)
            stop_times_qs = StopTimes.objects.filter(scenario_id=scenario_id)
            stops_qs = Stops.objects.filter(scenario_id=scenario_id)
            shapes_qs = Shape.objects.filter(scenario_id=scenario_id)
        except Exception as e:
            log_json(
                logger,
                logging.ERROR,
                "route_grouping_data_retrieval_failed",
                scenario_id=str(scenario_id),
                error=str(e),
            )
            raise RoutesServiceError(
                message=ErrorMessages.ROUTE_GROUP_FETCH_FAILED_JA,
                error=str(e),
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            ) from e

        try:
            route_entries = RouteDataUtils.get_route_pattern(routes_qs, trips_qs, stop_times_qs, stops_qs, shapes_qs)
        except Exception as e:
            log_json(
                logger,
                logging.ERROR,
                "route_pattern_construction_failed",
                scenario_id=str(scenario_id),
                error=str(e),
            )
            raise RoutesServiceError(
                message=ErrorMessages.ROUTE_PATTERN_BUILD_FAILED_JA,
                error=str(e),
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            ) from e

        if isinstance(route_entries, dict) and "routes" in route_entries:
            route_entries = route_entries["routes"]
        route_entry_by_id = {re["route_id"]: re for re in route_entries}

        try:
            keywords_qs = list(RouteKeywords.objects.filter(scenario_id=scenario_id))
            grouped: dict[str, dict[str, Any]] = {
                str(k.id): {
                    "keyword": k.keyword,
                    "keyword_id": str(k.id),
                    "keyword_color": k.keyword_color,
                    "routes": [],
                }
                for k in keywords_qs
            }
        except Exception as e:
            log_json(
                logger,
                logging.ERROR,
                "route_keywords_retrieval_failed",
                scenario_id=str(scenario_id),
                error=str(e),
            )
            raise RoutesServiceError(
                message=ErrorMessages.ROUTE_KEYWORDS_FETCH_FAILED_JA,
                error=str(e),
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            ) from e

        try:
            rk_maps = list(RouteKeywordMap.objects.filter(scenario_id=scenario_id))
            curated = {
                rkm.route_id: {
                    "keyword_id": rkm.keyword_id,
                    "keyword": rkm.keyword.keyword,
                    "keyword_color": rkm.keyword.keyword_color,
                }
                for rkm in rk_maps
            }
        except Exception as e:
            log_json(
                logger,
                logging.ERROR,
                "route_keyword_mapping_retrieval_failed",
                scenario_id=str(scenario_id),
                error=str(e),
            )
            raise RoutesServiceError(
                message=ErrorMessages.ROUTE_KEYWORD_MAPPING_FETCH_FAILED_JA,
                error=str(e),
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            ) from e

        routes_lookup = {r.route_id: r for r in routes_qs}

        for route_id, meta in curated.items():
            r_obj = routes_lookup.get(route_id)
            if not r_obj:
                continue

            re = route_entry_by_id.get(route_id, {})
            patterns = re.get("patterns", []) or []

            enriched_patterns = []
            for p in patterns:
                dir_id = p.get("direction_id")
                svc_id = p.get("service_id")

                p_out = dict(p)
                p_out.pop("trips", None)
                p_out.pop("trip_ids", None)
                p_out["keywords"] = RoutesGroupingService._build_pattern_keywords_no_trips(
                    base_route_keyword=meta["keyword"],
                    direction_id=dir_id,
                    service_id=svc_id,
                )
                enriched_patterns.append(p_out)

            if query_tokens:
                enriched_patterns = [
                    pp for pp in enriched_patterns if RoutesGroupingService._any_token_match(query_tokens, pp.get("keywords", []))
                ]

            route_payload = {
                "route_id": route_id,
                "route_short_name": re.get("route_short_name") if re else getattr(r_obj, "route_short_name", None),
                "route_long_name": re.get("route_long_name") if re else getattr(r_obj, "route_long_name", None),
                "route_desc": getattr(r_obj, "route_desc", None),
                "route_type": re.get("route_type") if re else getattr(r_obj, "route_type", None),
                "agency_id": re.get("agency_id") if re else getattr(r_obj, "agency_id", None),
                "color": getattr(r_obj, "route_color", None),
                "text_color": getattr(r_obj, "route_text_color", None),
                "geojson_data": RoutesGroupingService.get_geojson_by_route_id(scenario_id=scenario_id, route_id=route_id),
                "route_patterns": enriched_patterns,
            }

            kid = str(meta["keyword_id"])
            if kid not in grouped:
                grouped[kid] = {
                    "keyword": meta["keyword"],
                    "keyword_id": kid,
                    "keyword_color": meta["keyword_color"],
                    "routes": [],
                }
            grouped[kid]["routes"].append(route_payload)

        groups = list(grouped.values())
        groups.sort(key=lambda g: route_id_sort_key(g.get("keyword") or ""))

        filter_options = sorted(
            {
                pkw
                for group in groups
                for route in (group.get("routes") or [])
                for patt in (route.get("route_patterns") or [])
                for pkw in (patt.get("keywords") or [])
            }
        )

        try:
            stop_groups_geojson = RoutesGroupingService._build_stop_groups_geojson(scenario)
        except Exception as e:
            log_json(
                logger,
                logging.ERROR,
                "stop_groups_geojson_construction_failed",
                scenario_id=str(scenario_id),
                error=str(e),
            )
            raise RoutesServiceError(
                message=ErrorMessages.STOP_GROUP_GEOJSON_BUILD_FAILED_JA,
                error=str(e),
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            ) from e

        return {
            "routes_grouped_by_keyword": groups,
            "filter_options": filter_options,
            "geojson": stop_groups_geojson,
        }

    @staticmethod
    @transactional
    def apply_group_changes(
        *,
        scenario_id: str,
        group_changes: list[dict[str, Any]],
    ) -> tuple[list[str], list[dict[str, Any]]]:
        updated: list[str] = []
        errors: list[dict[str, Any]] = []

        try:
            Scenario.objects.get(id=scenario_id)
        except Scenario.DoesNotExist as e:
            raise RoutesServiceError(
                message=ErrorMessages.SCENARIO_NOT_FOUND_JA,
                error=ErrorMessages.SCENARIO_NOT_FOUND_JA,
                status_code=status.HTTP_404_NOT_FOUND,
            ) from e

        try:
            update_scenario_edit_state(scenario_id, "route_grouping_data")
            for change in group_changes:
                route_id = change.get("route_id")
                new_keyword_id = change.get("new_keyword_id")

                if not (route_id and new_keyword_id):
                    errors.append({"route_id": route_id, "error": "Data is not complete"})
                    continue

                try:
                    obj = RouteKeywordMap.objects.get(scenario_id=scenario_id, route_id=route_id)
                    obj.keyword_id = new_keyword_id
                    obj.can_automatically_update = False
                    obj.save()
                    updated.append(route_id)
                except RouteKeywordMap.DoesNotExist:
                    errors.append({"route_id": route_id, "error": "Mapping not found"})
                except Exception as e:
                    errors.append({"route_id": route_id, "error": str(e)})
        except Exception as e:
            log_json(
                logger,
                logging.ERROR,
                "route_grouping_data_update_failed_transaction",
                scenario_id=str(scenario_id),
                error=str(e),
            )
            raise RoutesServiceError(
                message=ErrorMessages.ROUTE_GROUP_UPDATE_FAILED_JA,
                error=str(e),
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            ) from e

        return updated, errors

    @staticmethod
    def _any_token_match(tokens, haystack) -> bool:
        if not tokens:
            return True
        hs = set(haystack or [])
        return any(t in hs for t in tokens)

    @staticmethod
    def _build_pattern_keywords_no_trips(*, base_route_keyword, direction_id, service_id=None) -> list[str]:
        toks: list[str] = []
        if base_route_keyword:
            toks.append(base_route_keyword)

        if service_id:
            toks.append(str(service_id).replace(" ", "_"))

        if direction_id == 0:
            toks.append("下り")
        elif direction_id == 1:
            toks.append("上り")

        return list(dict.fromkeys(toks))

    @staticmethod
    def get_geojson_by_route_id(*, scenario_id, route_id) -> list[dict[str, Any]]:
        shape_ids = (
            Trips.objects.filter(scenario_id=scenario_id, route_id=route_id)
            .values_list("shape_id", flat=True)
            .distinct()
        )
        shapes = (
            Shape.objects.filter(scenario_id=scenario_id, shape_id__in=shape_ids)
            .values("shape_id", "shape_pt_lat", "shape_pt_lon", "shape_pt_sequence")
            .order_by("shape_id", "shape_pt_sequence")
        )
        if not shapes:
            return []

        grouped_shapes: dict[str, list[list[float]]] = defaultdict(list)
        for s in shapes:
            grouped_shapes[s["shape_id"]].append([s["shape_pt_lon"], s["shape_pt_lat"]])

        return [{"coordinates": coords} for coords in grouped_shapes.values()]

    @staticmethod
    def _build_stop_groups_geojson(scenario) -> dict[str, Any]:
        method = (scenario.stops_grouping_method or "stop_name").strip()
        if method == "stop_id":
            return RoutesGroupingService._geojson_from_stop_id_groups(scenario)
        return RoutesGroupingService._geojson_from_stop_name_groups(scenario)

    @staticmethod
    def _geojson_from_stop_name_groups(scenario) -> dict[str, Any]:
        scenario_id = scenario.id
        counts = dict(
            StopNameKeywordMap.objects.filter(scenario_id=scenario_id)
            .values("stop_name_group_id")
            .annotate(cnt=Count("*"))
            .values_list("stop_name_group_id", "cnt")
        )

        features = []
        for g in StopNameKeywords.objects.filter(scenario_id=scenario_id).only(
            "stop_group_id",
            "stop_group_id_label",
            "stop_name_keyword",
            "stop_names_long",
            "stop_names_lat",
        ):
            gid_str = str(g.stop_group_id)
            props = {
                "group_id": gid_str,
                "group_label": g.stop_group_id_label or "",
                "keyword": g.stop_name_keyword or "",
                "grouping_method": "stop_name",
                "members_count": int(counts.get(gid_str, 0)),
            }
            geom = {
                "type": "Point",
                "coordinates": [float(g.stop_names_long or 0.0), float(g.stop_names_lat or 0.0)],
            }
            features.append({"type": "Feature", "geometry": geom, "properties": props})

        return {"type": "FeatureCollection", "features": features}

    @staticmethod
    def _geojson_from_stop_id_groups(scenario) -> dict[str, Any]:
        scenario_id = scenario.id
        counts_raw = (
            StopIdKeywordMap.objects.filter(scenario_id=scenario_id)
            .values("stop_id_group_id")
            .annotate(cnt=Count("*"))
            .values_list("stop_id_group_id", "cnt")
        )
        counts = {str(k): v for k, v in counts_raw}

        features = []
        for g in StopIdKeyword.objects.filter(scenario_id=scenario_id).only(
            "stop_group_id",
            "stop_group_name_label",
            "stop_id_keyword",
            "stop_id_long",
            "stop_id_lat",
        ):
            gid_str = str(g.stop_group_id)
            props = {
                "group_id": gid_str,
                "group_label": g.stop_group_name_label or "",
                "keyword": g.stop_id_keyword or "",
                "grouping_method": "stop_id",
                "members_count": int(counts.get(gid_str, 0)),
            }
            geom = {
                "type": "Point",
                "coordinates": [float(g.stop_id_long or 0.0), float(g.stop_id_lat or 0.0)],
            }
            features.append({"type": "Feature", "geometry": geom, "properties": props})

        return {"type": "FeatureCollection", "features": features}


@log_service_call
class RouteKeywordsService:
    @staticmethod
    def update_color(*, route_keyword, color: Any) -> dict[str, Any]:
        route_keyword.keyword_color = color
        try:
            route_keyword.save()
        except Exception as e:
            log_json(
                logger,
                logging.ERROR,
                "route_keyword_color_update_failed",
                route_group_keyword_id=str(route_keyword.id),
                error=str(e),
            )
            raise RoutesServiceError(
                message=ErrorMessages.ROUTE_KEYWORD_COLOR_UPDATE_FAILED_JA,
                error={"message": str(e)},
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            ) from e

        return {"route_group_keyword_id": str(route_keyword.id), "color": color}


@log_service_call
class RouteGroupKeywordsService:
    @staticmethod
    def create(*, scenario_id: Any, keyword: str, color: str) -> dict[str, Any]:
        keyword = (keyword or "").strip()
        color = (color or "").strip() or "cccccc"

        if not scenario_id or not keyword:
            raise RoutesServiceError(
                message=ErrorMessages.SCENARIO_ID_AND_KEYWORD_REQUIRED_JA,
                error="invalid_request",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if RouteKeywords.objects.filter(scenario_id=scenario_id, keyword__iexact=keyword).exists():
            log_json(
                logger,
                logging.WARNING,
                "route_group_keyword_creation_failed_duplicate",
                scenario_id=str(scenario_id),
                keyword=keyword,
            )
            raise RoutesServiceError(
                message=ErrorMessages.ROUTE_GROUP_NAME_IN_USE_JA,
                error="duplicate",
                status_code=status.HTTP_409_CONFLICT,
            )

        try:
            obj = RouteKeywords.objects.create(
                scenario_id=scenario_id,
                keyword=keyword,
                keyword_color=color,
            )
        except Exception as e:
            log_json(
                logger,
                logging.ERROR,
                "route_group_keyword_creation_failed",
                scenario_id=str(scenario_id),
                keyword=keyword,
                error=str(e),
            )
            raise RoutesServiceError(
                message=ErrorMessages.ROUTE_GROUP_CREATE_FAILED_JA,
                error={"message": str(e)},
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            ) from e

        return {
            "id": str(obj.id),
            "keyword": obj.keyword,
            "scenario_id": str(obj.scenario_id),
            "keyword_color": obj.keyword_color or "",
        }

    @staticmethod
    def delete_by_id(*, scenario_id: Any, route_group: Any) -> dict[str, Any]:
        if not scenario_id:
            log_json(
                logger,
                logging.ERROR,
                "route_group_keyword_deletion_failed_no_scenario_id",
                error="シナリオIDは必須です。",
            )
            raise RoutesServiceError(
                message=ErrorMessages.SCENARIO_ID_REQUIRED_VARIANT_JA,
                error=ErrorMessages.SCENARIO_ID_REQUIRED_VARIANT_JA,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if not route_group:
            log_json(
                logger,
                logging.ERROR,
                "route_group_keyword_deletion_failed_no_route_group",
                scenario_id=str(scenario_id),
                error="路線グループは必須です。",
            )
            raise RoutesServiceError(
                message=ErrorMessages.ROUTE_GROUP_REQUIRED_JA,
                error=ErrorMessages.ROUTE_GROUP_REQUIRED_JA,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        from gtfs.utils.route_data_utils import RouteDataUtils

        try:
            result = RouteDataUtils.delete_route_group_by_id(scenario_id, route_group)
        except Exception as e:
            log_json(
                logger,
                logging.ERROR,
                "route_group_keyword_deletion_failed_exception",
                scenario_id=str(scenario_id),
                route_group=route_group,
                error=str(e),
            )
            raise RoutesServiceError(
                message=str(e),
                error="ルートグループの削除中にエラーが発生しました。",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            ) from e

        status_code = status.HTTP_200_OK if not result.get("error") else status.HTTP_400_BAD_REQUEST
        return {
            "status_code": status_code,
            "data": {"related_route_ids": result.get("related_route_ids", [])},
            "message": result.get("message", ""),
            "error": result.get("error"),
        }

    @staticmethod
    def rename(*, pk: Any, new_name: str, allow_no_change: bool) -> dict[str, Any]:
        new_name = (new_name or "").strip()
        if not pk:
            log_json(logger, logging.ERROR, "route_group_keyword_rename_failed_no_id", error="IDは必須です。")
            raise RoutesServiceError(
                message=ErrorMessages.ID_REQUIRED_JA,
                error="missing_id",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        if not new_name:
            log_json(
                logger,
                logging.ERROR,
                "route_group_keyword_rename_failed_no_keyword",
                route_group_keyword_id=str(pk),
                error="グループ名は必須です。",
            )
            raise RoutesServiceError(
                message=ErrorMessages.GROUP_NAME_REQUIRED_JA,
                error="empty_keyword",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            obj = RouteKeywords.objects.get(pk=pk)
        except RouteKeywords.DoesNotExist as e:
            log_json(
                logger,
                logging.ERROR,
                "route_group_keyword_rename_failed_not_found",
                route_group_keyword_id=str(pk),
                error="指定された路線グループが見つかりません。",
            )
            raise RoutesServiceError(
                message=ErrorMessages.ROUTE_GROUP_NOT_FOUND_JA,
                error="not_found",
                status_code=status.HTTP_404_NOT_FOUND,
            ) from e

        try:
            if RouteKeywords.objects.filter(scenario_id=obj.scenario_id, keyword=new_name).exclude(pk=obj.pk).exists():
                raise RoutesServiceError(
                    message=ErrorMessages.ROUTE_GROUP_DUPLICATE_NAME_JA,
                    error="duplicate",
                    status_code=status.HTTP_409_CONFLICT,
                )

            if allow_no_change and obj.keyword == new_name:
                return {"id": str(obj.id), "keyword": obj.keyword, "message": "変更はありません。"}

            obj.keyword = new_name
            obj.save(update_fields=["keyword"])
            return {"id": str(obj.id), "keyword": obj.keyword, "message": "路線グループ名を更新しました。"}

        except RoutesServiceError:
            raise
        except Exception as e:
            log_json(
                logger,
                logging.ERROR,
                "route_group_keyword_rename_failed_exception",
                route_group_keyword_id=str(pk),
                error=str(e),
            )
            raise RoutesServiceError(
                message=ErrorMessages.ROUTE_GROUP_NAME_UPDATE_FAILED_JA,
                error={"message": str(e)},
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            ) from e
