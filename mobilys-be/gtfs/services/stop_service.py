from gtfs.services.base import chunked_transactional, log_service_call, transactional
from rest_framework import status
from collections import defaultdict, Counter
from django.db import connection
from gtfs.models import Scenario, StopNameKeywordMap, StopIdKeywordMap, Stops, StopNameKeywords, StopIdKeyword, Translation, Trips
from gtfs.serializers.request.stop_request import StopEditRequestSerializer
from gtfs.serializers.response.scenario_response import ScenarioLocalSerializer
from gtfs.serializers.response.stop_response import StopSerializer
from gtfs.utils.stop_data_utils import StopDataUtils
from mobilys_BE.shared.response import BaseResponse
from django.forms.models import model_to_dict
from gtfs.utils.translation_utils import upsert_translations
from django.db.models import Q
from gtfs.utils.scenario_utils import update_scenario_edit_state
from gtfs.utils.route_data_utils import RouteDataUtils
from gtfs.constants import ErrorMessages, StopsGroupingMethod

import logging
from mobilys_BE.shared.log_json import log_json

logger = logging.getLogger(__name__)


@log_service_call
class StopsGroupingDataService:
    """
    ViewSet for handling stop data.
    """
    queryset = Scenario.objects.all()
    serializer_class = ScenarioLocalSerializer

    @staticmethod
    def retrieve(*, scenario_id):
        scenario = Scenario.objects.filter(pk=scenario_id).first()

        # Check if the scenario is imported
        if not scenario:
            return BaseResponse(
                data=None,
                message=ErrorMessages.SCENARIO_NOT_FOUND_JA,
                error=ErrorMessages.SCENARIO_NOT_FOUND_JA,
                status_code=status.HTTP_400_BAD_REQUEST
            )
  
        return BaseResponse(
            data={
                "grouping_method": scenario.stops_grouping_method,
                "stops_groups_by_name": StopsGroupingDataService.getGroupStopsByName(scenario.id),
                "stops_groups_by_id": StopsGroupingDataService.getGroupStopsByStopId(scenario.id)
            },
            message="リクエストが正常に完了しました。",
            error=None,
            status_code=status.HTTP_200_OK
        )

    @staticmethod
    @chunked_transactional(chunk_size=500)
    def _apply_group_changes_chunked(*, scenario, stop_grouping_method: str, group_changes: list):
        # Ensure edit-state update is part of the first chunk transaction
        yield lambda: update_scenario_edit_state(scenario.id, "stops_grouping_data")

        for change in group_changes or []:
            stop_id = change.get("stop_id")

            if stop_grouping_method == "stop_names":
                new_group_id = change.get("new_stop_names_group_id")

                def op(_stop_id=stop_id, _new_group_id=new_group_id):
                    if not (_stop_id and _new_group_id):
                        return {"stop_id": _stop_id, "ok": False, "error": "Data is not complete"}
                    try:
                        obj = StopNameKeywordMap.objects.get(scenario=scenario, stop_id=_stop_id)
                        obj.stop_name_group_id = _new_group_id
                        obj.save()
                        return {"stop_id": _stop_id, "ok": True}
                    except StopNameKeywordMap.DoesNotExist:
                        log_json(
                            logger,
                            logging.ERROR,
                            {"message": "StopNameKeywordMap not found", "scenario_id": str(scenario.id), "stop_id": _stop_id},
                        )
                        return {"stop_id": _stop_id, "ok": False, "error": "Mapping not found"}
                    except Exception as e:
                        log_json(
                            logger,
                            logging.ERROR,
                            {"message": "Error updating StopNameKeywordMap", "scenario_id": str(scenario.id), "stop_id": _stop_id, "error": str(e)},
                        )
                        return {"stop_id": _stop_id, "ok": False, "error": str(e)}

                yield op

            elif stop_grouping_method == "stop_id":
                new_group_id = change.get("new_stop_id_group_id")

                def op(_stop_id=stop_id, _new_group_id=new_group_id):
                    if not (_stop_id and _new_group_id):
                        return {"stop_id": _stop_id, "ok": False, "error": "Data is not complete"}
                    try:
                        obj = StopIdKeywordMap.objects.get(scenario=scenario, stop_id=_stop_id)
                        obj.stop_id_group_id = _new_group_id
                        obj.can_automatically_update = False
                        obj.save()
                        return {"stop_id": _stop_id, "ok": True}
                    except StopIdKeywordMap.DoesNotExist:
                        log_json(
                            logger,
                            logging.ERROR,
                            {"message": "StopIdKeywordMap not found", "scenario_id": str(scenario.id), "stop_id": _stop_id},
                        )
                        return {"stop_id": _stop_id, "ok": False, "error": "Mapping not found"}
                    except Exception as e:
                        log_json(
                            logger,
                            logging.ERROR,
                            {"message": "Error updating StopIdKeywordMap", "scenario_id": str(scenario.id), "stop_id": _stop_id, "error": str(e)},
                        )
                        return {"stop_id": _stop_id, "ok": False, "error": str(e)}

                yield op

    @staticmethod
    def update(*, scenario_id, payload):
        scenario = Scenario.objects.filter(pk=scenario_id).first()
        if not scenario:
            return BaseResponse(
                data=None,
                message=ErrorMessages.SCENARIO_NOT_FOUND_JA,
                error=ErrorMessages.SCENARIO_NOT_FOUND_JA,
                status_code=status.HTTP_400_BAD_REQUEST
            )
          
        stop_grouping_method = payload.get("stop_grouping_method")
        group_changes = payload.get("group_changes", [])

        if stop_grouping_method not in ["stop_names", "stop_id"]:
            return BaseResponse(
                data=None,
                message=ErrorMessages.INVALID_STOP_GROUPING_METHOD_JA,
                error=ErrorMessages.INVALID_STOP_GROUPING_METHOD_JA,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        results = StopsGroupingDataService._apply_group_changes_chunked(
            scenario=scenario,
            stop_grouping_method=stop_grouping_method,
            group_changes=group_changes,
        )

        updated = [r.get("stop_id") for r in results if isinstance(r, dict) and r.get("ok")]
        errors = [{"stop_id": r.get("stop_id"), "error": r.get("error")} for r in results if isinstance(r, dict) and not r.get("ok")]

        return BaseResponse(
            message="ストップグループの更新が完了しました。",
            data={
                "updated_count": len(updated),
                "updated_stops": updated,
            },
            error=errors,
            status_code=status.HTTP_200_OK
        )
    
    @staticmethod
    def getGroupStopsByStopId(scenario_id):

        # grouping by stop_id
        stop_maps = (
            StopIdKeywordMap.objects
            .filter(scenario_id=scenario_id)
            .select_related(None)
            .values(
                'stop_id_group_id',  # group id
                'stop_id',           # stop_id (child)
            )
        )

        # Get all required stops
        stop_ids = [m['stop_id'] for m in stop_maps]
        stops_lookup = {
            s.stop_id: s for s in Stops.objects.filter(stop_id__in=stop_ids, scenario_id=scenario_id)
        }
        translations_map = StopsGroupingDataService._build_translations_for_stops(scenario_id, stops_lookup)


        #Get translations
        translations_by_stop = StopsGroupingDataService._fetch_translations_by_stop(scenario_id, stop_ids)

        # Get mapping group_id to stop_id_keyword
        group_ids = set(m['stop_id_group_id'] for m in stop_maps)
        groupid_to_keyword_obj = {
            k.stop_group_id: k for k in StopIdKeyword.objects.filter(stop_group_id__in=group_ids, scenario_id=scenario_id)
        }

        # Grouping
        grouped = defaultdict(list)
        for m in stop_maps:
            group_id = m['stop_id_group_id']
            stop = stops_lookup.get(m['stop_id'])
            if stop:
                d = model_to_dict(stop)
                d['translations'] = translations_map.get(stop.stop_id, [])
                grouped[group_id].append(d)

        # Build final result
        resultGroupedStopId = []
        for group_id, stops in grouped.items():
            keyword_obj = groupid_to_keyword_obj.get(group_id)
            resultGroupedStopId.append({
                "stop_id_group": keyword_obj.stop_id_keyword if keyword_obj else "",
                "stop_id_group_id": str(group_id),
                "stop_group_name_label": keyword_obj.stop_group_name_label if keyword_obj else "",
                "stop_id_lon": StopsGroupingDataService.generateCenterLatLonByStopsData(stops, scenario_id)[1],
                "stop_id_lat": StopsGroupingDataService.generateCenterLatLonByStopsData(stops, scenario_id)[0],
                "stops": stops
            })

        return resultGroupedStopId
    
    @staticmethod
    def getGroupStopsByName(scenario_id):

        # Get all keyword group for this scenario
        stop_name_keywords = StopNameKeywords.objects.filter(scenario_id=scenario_id)

        # Get all mapping stop <-> group
        stop_name_maps = StopNameKeywordMap.objects.filter(scenario_id=scenario_id)

        # Get all stop_id used
        stop_ids = [m.stop_id for m in stop_name_maps]
        stops_lookup = {
            s.stop_id: s for s in Stops.objects.filter(stop_id__in=stop_ids, scenario_id=scenario_id)
        }

        translations_map = StopsGroupingDataService._build_translations_for_stops(scenario_id, stops_lookup)


        translations_by_stop = StopsGroupingDataService._fetch_translations_by_stop(scenario_id, stop_ids)

        # Create mapping group_id to StopNameKeywords object
        groupid_to_keyword = {
            str(k.stop_group_id): k for k in stop_name_keywords
        }

        # Grouping: key = stop_name_group_id (group name), value = list of stops
        from collections import defaultdict
        grouped = defaultdict(list)
        for m in stop_name_maps:
            group_id = m.stop_name_group_id
            stop = stops_lookup.get(m.stop_id)
            if stop:
                d = model_to_dict(stop)
                d['translations'] = translations_map.get(stop.stop_id, [])
                grouped[group_id].append(d)
        
        # Build final result
        resultGroupedStopName = []
        for group_id, stops in grouped.items():
            keyword_obj = groupid_to_keyword.get(str(group_id))
            resultGroupedStopName.append({
                "stop_name_group": keyword_obj.stop_name_keyword if keyword_obj else "",
                "group_id": group_id,
                "stop_group_id_label": keyword_obj.stop_group_id_label if keyword_obj else "",
                "stop_names_lon": StopsGroupingDataService.generateCenterLatLonByStopsData(stops, scenario_id)[1],
                "stop_names_lat": StopsGroupingDataService.generateCenterLatLonByStopsData(stops, scenario_id)[0],
                "stops": stops
            })

        return resultGroupedStopName
    
    @staticmethod
    def _build_translations_for_stops(scenario_id, stops_lookup):
        """
        Return mapping: stop_id -> [translations...]
        Includes both stop_id-linked rows and fallback rows matched by field_value == stop_name.
        """
        stop_ids = list(stops_lookup.keys())
        stop_names = [s.stop_name for s in stops_lookup.values() if s.stop_name]

        # 1) Direct: rows tied to stop_id
        direct = list(
            Translation.objects.filter(
                scenario_id=scenario_id,
                table_name='stops',
                stop_id__in=stop_ids
            ).values('id', 'field_name', 'field_value', 'language', 'translation', 'stop_id')
        )

        # 2) Fallback: rows with no stop_id, matched by stop_name
        fallback = list(
            Translation.objects.filter(
                scenario_id=scenario_id,
                table_name='stops',
            )
            .filter(Q(stop_id__isnull=True) | Q(stop_id__exact=''))  # catch NULL or ''
            .filter(field_name='stop_name', field_value__in=stop_names)
            .values('id', 'field_name', 'field_value', 'language', 'translation')
        )


        # Map name -> stop_ids (avoid O(N*M))
        name_to_stop_ids = defaultdict(list)
        for s in stops_lookup.values():
            if s.stop_name:
                name_to_stop_ids[s.stop_name].append(s.stop_id)

        out = defaultdict(list)
        for t in direct:
            out[t['stop_id']].append({
                'id': t['id'],
                'field_name': t['field_name'],
                'field_value': t['field_value'],
                'language': t['language'],
                'translation': t['translation'],
            })

        for t in fallback:
            for sid in name_to_stop_ids.get(t['field_value'], []):
                out[sid].append({
                    'id': t['id'],
                    'field_name': t['field_name'],
                    'field_value': t['field_value'],
                    'language': t['language'],
                    'translation': t['translation'],
                })

        return out
    
    @staticmethod
    def generateCenterLatLonByStopsData(stops_data, scenario_id):
        """
        Generate center latitude and longitude from a list of stop data using PostGIS centroid.
        """
        if not stops_data:
            return None, None

        stop_ids = [stop.get('stop_id') for stop in stops_data if stop.get('stop_id')]
        if not stop_ids:
            return None, None

        # Query centroid using PostGIS
        sql = """
            SELECT 
                ST_Y(ST_Centroid(ST_Collect(ST_SetSRID(ST_MakePoint(stop_lon, stop_lat), 4326)))) AS centroid_lat,
                ST_X(ST_Centroid(ST_Collect(ST_SetSRID(ST_MakePoint(stop_lon, stop_lat), 4326)))) AS centroid_lon
            FROM stops
            WHERE stop_id IN %s AND scenario_id = %s
        """

        with connection.cursor() as cursor:
            cursor.execute(sql, [tuple(stop_ids), scenario_id])
            row = cursor.fetchone()
            if row and row[0] is not None and row[1] is not None:
                return float(row[0]), float(row[1])
            else:
                return None, None
            
    @staticmethod
    def _fetch_translations_by_stop(scenario_id, stop_ids):
        """
        Return { stop_id: [{field_name, field_value, language, translation}, ...]}
        """

        if not stop_ids:
            return defaultdict(list)
        
        qs = (
            Translation.objects
            .filter(scenario_id = scenario_id, stop_id__in = stop_ids)
            .values('stop_id', 'field_name', 'field_value', 'language', 'translation')
        )

        by_stop = defaultdict(list)
        for t in qs:
            by_stop[t['stop_id']].append({
                'field_name': t['field_name'],
                'field_value': t['field_value'],
                'language': t['language'],
                'translation': t['translation'],
            })
        return by_stop
    
@log_service_call
class StopsGroupingMethodService:
    """
    ViewSet for edit stop method grouping.
    """
    queryset = Scenario.objects.all()
    serializer_class = ScenarioLocalSerializer

    @staticmethod
    def update(*, scenario_id, payload):
        scenario = Scenario.objects.filter(pk=scenario_id).first()
        grouping_method = payload.get("grouping_method")

        # Validate input
        if grouping_method not in dict(StopsGroupingMethod.choices()):
            log_json(
                logger,
                logging.ERROR,
                {"message": "Invalid grouping_method value", "scenario_id": str(scenario.id), "grouping_method": grouping_method}
            )
            return BaseResponse(
                data=None,
                message=ErrorMessages.INVALID_GROUPING_METHOD_JA,
                error=ErrorMessages.INVALID_GROUPING_METHOD_JA,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        scenario.stops_grouping_method = grouping_method
        try:
            scenario.save(update_fields=["stops_grouping_method"])
        except Exception as e:
            log_json(
                logger,
                logging.ERROR,
                {"message": "Error saving scenario grouping_method", "scenario_id": str(scenario.id), "error": str(e)}
            )
            return BaseResponse(
                data=None,
                message=ErrorMessages.SCENARIO_UPDATE_ERROR_JA,
                error=ErrorMessages.SCENARIO_UPDATE_ERROR_TEMPLATE_JA.format(error=str(e)),
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return BaseResponse(
            data={
                "scenario_id": str(scenario.id),
                "stops_grouping_method": scenario.stops_grouping_method
            },
            message="グルーピング方法が正常に更新されました。",
            status_code=status.HTTP_200_OK
        )


@log_service_call
class StopEditService:
    queryset = Stops.objects.all()
    serializer_class = StopEditRequestSerializer

    @staticmethod
    def get_queryset(scenario_id=None):
        if scenario_id:
            return Stops.objects.filter(scenario_id=scenario_id)
        return Stops.objects.all()
    
    @staticmethod
    def create(*, payload):
        data = payload

        scenario_id = data.get("scenario_id")
        parent_stop_id = data.get("parent_stop_id")

        # required stop fields
        stop_id   = data.get("stop_id")
        stop_name = data.get("stop_name")
        stop_lat  = data.get("stop_lat")
        stop_lon  = data.get("stop_lon")
        stop_code = data.get("stop_code", "")

        translations_payload = data.get("translations", [])

        if not scenario_id or not stop_id or not stop_name or stop_lat is None or stop_lon is None:
            log_json(
                logger,
                logging.ERROR,
                {"message": "Missing required fields for Stop creation", "scenario_id": str(scenario_id), "stop_id": str(stop_id)}
            )
            return BaseResponse(
                message=ErrorMessages.STOP_REQUIRED_FIELDS_JA,
                data=None,
                error=ErrorMessages.STOP_REQUIRED_FIELDS_JA,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        if Stops.objects.filter(scenario_id=scenario_id, stop_id=stop_id).exists():
            log_json(
                logger,
                logging.ERROR,
                {"message": "Stop with given stop_id already exists", "scenario_id": str(scenario_id), "stop_id": str(stop_id)}
            )
            return BaseResponse(
                message=ErrorMessages.STOP_ID_ALREADY_EXISTS_TEMPLATE_JA.format(stop_id=stop_id),
                data=None,
                error=ErrorMessages.STOP_ID_ALREADY_EXISTS_TEMPLATE_JA.format(stop_id=stop_id),
                status_code=status.HTTP_400_BAD_REQUEST
            )

        # helper: next SG label
        def next_sg_label(sid):
            labels = StopNameKeywords.objects.filter(scenario_id=sid).values_list("stop_group_id_label", flat=True)
            max_num = 0
            for lab in labels:
                if isinstance(lab, str) and lab.startswith("SG"):
                    try:
                        max_num = max(max_num, int(lab[2:]))
                    except ValueError:
                        pass
            return f"SG{max_num + 1:05d}"

        try:
            def _do():
                scenario = Scenario.objects.get(id=scenario_id)
                
                # --------- pick groups from parent or auto-discover ----------
                if parent_stop_id:
                    # legacy behavior: follow parent's groups
                    sn_map = StopNameKeywordMap.objects.filter(scenario_id=scenario_id, stop_id=parent_stop_id).first()
                    si_map = StopIdKeywordMap.objects.filter(scenario_id=scenario_id, stop_id=parent_stop_id).first()
                    if not sn_map or not si_map:
                        return BaseResponse(
                            message=ErrorMessages.PARENT_STOP_GROUP_INFO_NOT_FOUND_JA,
                            data=None,
                            error=ErrorMessages.PARENT_STOP_GROUP_INFO_NOT_FOUND_JA,
                            status_code=status.HTTP_400_BAD_REQUEST
                        )
                    stop_name_group_id = sn_map.stop_name_group_id
                    stop_id_group_id   = si_map.stop_id_group_id
                
                else:
                    # === AUTO: StopNameKeywords by stop_name (exact match) ===
                    name_kw = StopNameKeywords.objects.filter(
                        scenario_id=scenario_id, stop_name_keyword=stop_name
                    ).first()
                
                    if not name_kw:
                        name_kw = StopNameKeywords.objects.create(
                            stop_name_keyword=stop_name,
                            stop_group_id_label=next_sg_label(scenario_id),
                            scenario=scenario,
                            stop_names_lat=float(stop_lat) if stop_lat is not None else 0.0,
                            stop_names_long=float(stop_lon) if stop_lon is not None else 0.0,
                        )
                
                    stop_name_group_id = name_kw.stop_group_id
                
                    # === AUTO: StopIdKeyword by stop_id prefix ===
                    if "_" in stop_id:
                        prefix = stop_id.split("_", 1)[0]
                    else:
                        prefix = stop_id
                
                    id_kw = StopIdKeyword.objects.filter(
                        scenario_id=scenario_id, stop_id_keyword=prefix
                    ).first()
                
                    if not id_kw:
                        id_kw = StopIdKeyword.objects.create(
                            stop_id_keyword=prefix,
                            scenario=scenario,
                            stop_group_name_label=stop_name
                        )
                
                    stop_id_group_id = id_kw.stop_group_id
                
                # --------- create Stops ----------
                any_stop = Stops.objects.filter(scenario=scenario).first()
                location_type_default = data.get("location_type", any_stop.location_type if any_stop else 0)
                stop_code_default = stop_code if stop_code else (any_stop.stop_code if any_stop else "")
                
                stop_obj = Stops.objects.create(
                    stop_id = stop_id,
                    stop_name = stop_name,
                    stop_lat = stop_lat,
                    stop_lon = stop_lon,
                    scenario = scenario,
                    location_type = location_type_default,
                    stop_code = stop_code_default,
                )
                
                # --------- create mappings ----------
                StopNameKeywordMap.objects.create(
                    stop_id=stop_obj.stop_id,
                    stop_name_group_id=stop_name_group_id,
                    scenario=scenario
                )
                StopIdKeywordMap.objects.create(
                    stop_id=stop_obj.stop_id,
                    stop_id_group_id=stop_id_group_id,
                    scenario=scenario
                )
                
                # --------- translations ----------
                created_cnt = updated_cnt = 0
                if translations_payload:
                    created_cnt, updated_cnt = upsert_translations(
                        scenario_id = scenario_id,
                        table_name = "stops",
                        entity_ids = {"stop_id": stop_obj.stop_id},
                        items = translations_payload,
                    )
                
                update_scenario_edit_state(scenario_id, "stops_data")
                
                return BaseResponse(
                message="ストップ、StopNameKeywordMap、StopIdKeywordMapが正常に作成されました。",
                data={
                    "stop_id": stop_obj.stop_id,
                    "stop_name_group_id": stop_name_group_id,
                    "stop_id_group_id": stop_id_group_id,
                    "translations_created": created_cnt,
                    "translations_updated": updated_cnt,
                },
                error=None,
                status_code=status.HTTP_201_CREATED
                )
                
            return transactional(_do)()
        except Exception as e:
            log_json(
                logger,
                logging.ERROR,
                {"message": "Error creating Stop", "scenario_id": str(scenario_id), "stop_id": str(stop_id), "error": str(e)}
            )
            return BaseResponse(
                message=ErrorMessages.ERROR_OCCURRED_TEMPLATE_JA.format(error=str(e)),
                data=None,
                error=ErrorMessages.ERROR_OCCURRED_TEMPLATE_JA.format(error=str(e)),
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    
    @staticmethod
    def update(*, scenario_id, stop_id, payload):

        stop_lat = payload.get('stop_lat')
        stop_lon = payload.get('stop_lon')
        stop_code = payload.get('stop_code')
        translations_payload = payload.get('translations', [])

        if stop_lat is None or stop_lon is None:
            return BaseResponse(
                message=ErrorMessages.STOP_LAT_LON_REQUIRED_JA,
                data=None,
                error=ErrorMessages.STOP_LAT_LON_REQUIRED_JA,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        try:
            stop = Stops.objects.get(scenario_id=scenario_id, stop_id=stop_id)
        except Stops.DoesNotExist:
            log_json(
                logger,
                logging.ERROR,
                {"message": "Stop not found for update", "scenario_id": str(scenario_id), "stop_id": str(stop_id)}
            )
            return BaseResponse(
                message=ErrorMessages.STOP_NOT_FOUND_JA,
                data=None,
                error=ErrorMessages.STOP_NOT_FOUND_JA,
                status_code=status.HTTP_404_NOT_FOUND
            )

        try:
            def _do():
                stop.stop_lat = stop_lat
                stop.stop_lon = stop_lon
                stop.stop_code = stop_code if stop_code is not None else stop.stop_code
                stop.save(update_fields=['stop_lat', 'stop_lon', 'stop_code'])
                
                update_scenario_edit_state(scenario_id, "stops_data")
                
                created_cnt = updated_cnt = 0
                if translations_payload:
                    created_cnt, updated_cnt = upsert_translations(
                        scenario_id=scenario_id,
                        table_name="stops",
                        entity_ids={"stop_id": stop_id},
                        items=translations_payload,
                    )
                
                return BaseResponse(
                    message="Stopが正常に更新されました。",
                    data={
                        "stop_id": stop_id,
                        "stop_lat": stop_lat,
                        "stop_lon": stop_lon,
                        "stop_code": stop.stop_code,
                        "translations_created": created_cnt,
                        "translations_updated": updated_cnt,
                    },
                    error=None,
                    status_code=status.HTTP_200_OK
                )
            return transactional(_do)()
        except Exception as e:
            log_json(
                logger,
                logging.ERROR,
                {"message": "Error updating Stop", "scenario_id": str(scenario_id), "stop_id": str(stop_id), "error": str(e)}
            )
            return BaseResponse(
                message=ErrorMessages.ERROR_OCCURRED_TEMPLATE_JA.format(error=str(e)),
                data=None,
                error=ErrorMessages.ERROR_OCCURRED_TEMPLATE_JA.format(error=str(e)),
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
           

    @staticmethod
    def destroy(*, scenario_id, stop_id):
        """
        Delete a stop if and only if it is not referenced by any StopTimes rows
        within the same scenario. If referenced, return a JP validation message
        listing the trip_ids that use this stop.
        """
        # Local import to avoid changing module-level imports
        from gtfs.models import StopTimes

        if not scenario_id or not stop_id:
            return BaseResponse(
                message=ErrorMessages.SCENARIO_ID_AND_STOP_ID_REQUIRED_VARIANT_JA,
                data=None,
                error=ErrorMessages.SCENARIO_ID_AND_STOP_ID_REQUIRED_VARIANT_JA,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        # Ensure the stop exists
        try:
            stop = Stops.objects.get(scenario_id=scenario_id, stop_id=stop_id)
        except Stops.DoesNotExist:
            log_json(
                logger,
                logging.ERROR,
                {"message": "Stop not found for deletion", "scenario_id": str(scenario_id), "stop_id": str(stop_id)}
            )
            return BaseResponse(
                message=ErrorMessages.STOP_NOT_FOUND_JA,
                data=None,
                error=ErrorMessages.STOP_NOT_FOUND_JA,
                status_code=status.HTTP_404_NOT_FOUND
            )

        # Check references in StopTimes
        trip_ids_qs = (
            StopTimes.objects
            .filter(scenario_id=scenario_id, stop_id=stop_id)
            .values_list('trip_id', flat=True)
            .distinct()
        )
        trip_ids = list(trip_ids_qs)

        # If referenced, compute pattern details (pattern_id, direction_id, service_id, first_and_last_stop_name)
        if trip_ids:
            trips = list(
                Trips.objects
                .filter(scenario_id=scenario_id, trip_id__in=trip_ids)
                .values('trip_id', 'route_id', 'direction_id', 'service_id', 'shape_id')
            )

            # Fetch stop sequences to derive first/last stop for each trip
            sts = list(
                StopTimes.objects
                .filter(scenario_id=scenario_id, trip_id__in=trip_ids)
                .order_by('trip_id', 'stop_sequence')
                .values('trip_id', 'stop_id')
            )

            first_last_by_trip = {}
            for row in sts:
                tid = row['trip_id']
                sid = row['stop_id']
                if tid not in first_last_by_trip:
                    first_last_by_trip[tid] = [sid, sid]
                else:
                    first_last_by_trip[tid][1] = sid

            needed_stop_ids = set()
            for first_sid, last_sid in first_last_by_trip.values():
                if first_sid:
                    needed_stop_ids.add(first_sid)
                if last_sid:
                    needed_stop_ids.add(last_sid)

            stop_name_map = {
                s.stop_id: s.stop_name
                for s in Stops.objects.filter(scenario_id=scenario_id, stop_id__in=needed_stop_ids)
            }

            pattern_meta = {}
            pair_counter = {}
            for t in trips:
                key = (t['route_id'], t['direction_id'], t['service_id'], t['shape_id'])
                if key not in pattern_meta:
                    pid = RouteDataUtils.make_pattern_id(t['route_id'], t['shape_id'], t['direction_id'], t['service_id'])
                    pattern_meta[key] = {
                        'pattern_id': pid,
                        'direction_id': t['direction_id'],
                        'service_id': t['service_id'],
                    }
                    pair_counter[key] = Counter()

                bounds = first_last_by_trip.get(t['trip_id'])
                if bounds:
                    first_name = stop_name_map.get(bounds[0], '')
                    last_name = stop_name_map.get(bounds[1], '')
                    pair = f"{first_name} - {last_name}" if (first_name or last_name) else ''
                    if pair:
                        pair_counter[key][pair] += 1

            # Build human-readable lines
            lines = []
            for key, meta in pattern_meta.items():
                pair = ''
                if pair_counter.get(key):
                    pair = pair_counter[key].most_common(1)[0][0]
                lines.append(
                    f"- pattern_id: {meta['pattern_id']}, direction_id: {meta['direction_id']}, service_id: {meta['service_id']}, first_and_last_stop_name: {pair}"
                )

            lines.sort()
            jp_msg = "この標柱は以下の運行パターンで使用されているため削除できません。\n" + "\n".join(lines)
            return BaseResponse(
                message=jp_msg,
                data=None,
                error=jp_msg,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        # Proceed with deletion if not referenced
        try:
            def _do():
                # Remember current group ids for recalculation/removal
                stop_name_map = StopNameKeywordMap.objects.filter(stop_id=stop_id, scenario_id=scenario_id).first()
                stop_name_group_id = stop_name_map.stop_name_group_id if stop_name_map else None
                
                stop_id_map = StopIdKeywordMap.objects.filter(stop_id=stop_id, scenario_id=scenario_id).first()
                stop_id_group_id = stop_id_map.stop_id_group_id if stop_id_map else None
                
                # Delete mappings first
                StopNameKeywordMap.objects.filter(stop_id=stop_id, scenario_id=scenario_id).delete()
                StopIdKeywordMap.objects.filter(stop_id=stop_id, scenario_id=scenario_id).delete()
                
                # Delete the stop itself
                stop.delete()
                
                # Recalculate or cleanup StopNameKeywords
                if stop_name_group_id:
                    mapped_stop_ids = list(
                        StopNameKeywordMap.objects.filter(
                            scenario_id=scenario_id,
                            stop_name_group_id=stop_name_group_id
                        ).values_list('stop_id', flat=True)
                    )
                    if mapped_stop_ids:
                        stops_data = list(
                            Stops.objects.filter(scenario_id=scenario_id, stop_id__in=mapped_stop_ids)
                            .values('stop_id', 'stop_lat', 'stop_lon')
                        )
                        center_lat, center_lon = StopDataUtils.generateCenterLatLonByStopsData(stops_data, scenario_id)
                        keyword = StopNameKeywords.objects.filter(
                            scenario_id=scenario_id, stop_group_id=stop_name_group_id
                        ).first()
                        if keyword:
                            keyword.stop_names_lat = center_lat if center_lat is not None else 0.0
                            keyword.stop_names_long = center_lon if center_lon is not None else 0.0
                            keyword.save(update_fields=['stop_names_lat', 'stop_names_long'])
                    else:
                        # No more members → remove the keyword group
                        StopNameKeywords.objects.filter(
                            scenario_id=scenario_id, stop_group_id=stop_name_group_id
                        ).delete()
                
                # Recalculate or cleanup StopIdKeyword
                if stop_id_group_id:
                    mapped_stop_ids = list(
                        StopIdKeywordMap.objects.filter(
                            scenario_id=scenario_id,
                            stop_id_group_id=stop_id_group_id
                        ).values_list('stop_id', flat=True)
                    )
                    if mapped_stop_ids:
                        stops_data = list(
                            Stops.objects.filter(scenario_id=scenario_id, stop_id__in=mapped_stop_ids)
                            .values('stop_id', 'stop_lat', 'stop_lon')
                        )
                        center_lat, center_lon = StopDataUtils.generateCenterLatLonByStopsData(stops_data, scenario_id)
                        keyword = StopIdKeyword.objects.filter(
                            scenario_id=scenario_id, stop_group_id=stop_id_group_id
                        ).first()
                        if keyword:
                            keyword.stop_id_lat = center_lat if center_lat is not None else 0.0
                            keyword.stop_id_long = center_lon if center_lon is not None else 0.0
                            keyword.save(update_fields=['stop_id_lat', 'stop_id_long'])
                    else:
                        # No more members → remove the keyword group
                        StopIdKeyword.objects.filter(
                            scenario_id=scenario_id, stop_group_id=stop_id_group_id
                        ).delete()
                
                update_scenario_edit_state(scenario_id, "stops_data")
            transactional(_do)()
        except Exception as e:
            log_json(
                logger,
                logging.ERROR,
                {"message": "Error deleting Stop", "scenario_id": str(scenario_id), "stop_id": str(stop_id), "error": str(e)}
            )
            return BaseResponse(
                message=ErrorMessages.ERROR_OCCURRED_TEMPLATE_JA.format(error=str(e)),
                data=None,
                error=ErrorMessages.ERROR_OCCURRED_TEMPLATE_JA.format(error=str(e)),
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return BaseResponse(
            message="Stopが正常に削除されました。",
            data=None,
            error=None,
            status_code=status.HTTP_204_NO_CONTENT
        )


    @staticmethod
    def list(*, scenario_id):
        if not scenario_id:
            return BaseResponse(
                message=ErrorMessages.SCENARIO_ID_REQUIRED_JA_PERIOD,
                data=None,
                error=ErrorMessages.SCENARIO_ID_REQUIRED_JA_PERIOD,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        # Get all stops for the given scenario
        stops = Stops.objects.filter(scenario_id=scenario_id).values(
            'stop_id', 'stop_name', 'stop_lat', 'stop_lon', 'location_type', 'parent_station', "stop_code"
        )

        # Group by parent_station
        grouped_stops = defaultdict(list)
        for stop in stops:
            grouped_stops[stop['parent_station']].append(stop)

        # Format the response
        result = []
        for parent_station, stops in grouped_stops.items():
            result.append({
                "parent_station": parent_station,
                "stops": stops
            })

        return BaseResponse(
            message="Stops retrieved successfully.",
            data=result,
            error=None,
            status_code=status.HTTP_200_OK
        )

@log_service_call
class StopsGroupDataService:
    """
    ViewSet for handling stop grouping data.
    """
    queryset = Scenario.objects.all()
    serializer_class = ScenarioLocalSerializer

    @staticmethod
    def create(*, payload):
        data = payload
        raw_stop_id = (data.get("stop_id") or "").strip()  # user enters GROUP id here
        stop_name   = (data.get("stop_name") or "").strip()
        stop_lat    = data.get("stop_lat")
        stop_lon    = data.get("stop_lon")
        scenario_id = data.get("scenario_id")
        stop_code   = data.get("stop_code", "")

        if not raw_stop_id or not stop_name or stop_lat is None or stop_lon is None:
            return BaseResponse(
                message="stop_id、stop_name、stop_lat、stop_lonは必須です。",
                data=None,
                error="stop_id、stop_name、stop_lat、stop_lonは必須です。",
                status_code=status.HTTP_400_BAD_REQUEST
            )

        # Treat input as group/prefix
        prefix = raw_stop_id.split("_")[0]

        # Must be a brand-new parent: name group and id group must not exist yet
        if StopNameKeywords.objects.filter(stop_name_keyword=stop_name, scenario_id=scenario_id).exists():
            return BaseResponse(
                message=ErrorMessages.STOP_NAME_KEYWORDS_ALREADY_EXISTS_TEMPLATE_JA.format(stop_name=stop_name),
                data=None,
                error=ErrorMessages.STOP_NAME_KEYWORDS_ALREADY_EXISTS_TEMPLATE_JA.format(stop_name=stop_name),
                status_code=status.HTTP_400_BAD_REQUEST
            )
        if StopIdKeyword.objects.filter(stop_id_keyword=prefix, scenario_id=scenario_id).exists():
            return BaseResponse(
                message=ErrorMessages.STOP_ID_KEYWORD_ALREADY_EXISTS_TEMPLATE_JA.format(prefix=prefix),
                data=None,
                error=ErrorMessages.STOP_ID_KEYWORD_ALREADY_EXISTS_TEMPLATE_JA.format(prefix=prefix),
                status_code=status.HTTP_400_BAD_REQUEST
            )

        # Generate actual stop_id: prefix_{n+1}
        existing_ids = list(
            Stops.objects.filter(scenario_id=scenario_id, stop_id__startswith=f"{prefix}_")
                        .values_list("stop_id", flat=True)
        )
        max_suffix = 0
        for sid in existing_ids:
            parts = sid.split("_", 1)
            if len(parts) == 2 and parts[1].isdigit():
                max_suffix = max(max_suffix, int(parts[1]))
        new_stop_id = f"{prefix}_{max_suffix + 1}"

        # Next SGxxxxx label for StopNameKeywords
        def next_sg_label(sid):
            labels = StopNameKeywords.objects.filter(scenario_id=sid).values_list("stop_group_id_label", flat=True)
            max_num = 0
            for lab in labels:
                if isinstance(lab, str) and lab.startswith("SG"):
                    try:
                        max_num = max(max_num, int(lab[2:]))
                    except ValueError:
                        pass
            return f"SG{max_num + 1:05d}"

        try:
            def _do():
                # 1) Name group
                name_label = next_sg_label(scenario_id)
                snk = StopNameKeywords.objects.create(
                    stop_name_keyword=stop_name,
                    scenario_id=scenario_id,
                    stop_group_id_label=name_label,
                )
                
                # 2) ID group (store readable name for the group header)
                sik = StopIdKeyword.objects.create(
                    stop_id_keyword=prefix,
                    scenario_id=scenario_id,
                    stop_group_name_label=stop_name,
                )
                
                any_stop = Stops.objects.filter(scenario_id=scenario_id).first()
                location_type_default = any_stop.location_type if any_stop else 0
                stop_code_default = stop_code or (any_stop.stop_code if any_stop else "")
                
                # 3) Create the actual stop with generated id
                stop_obj = Stops.objects.create(
                    stop_id=new_stop_id,
                    stop_name=stop_name,
                    stop_lat=stop_lat,
                    stop_lon=stop_lon,
                    scenario_id=scenario_id,
                    stop_code=stop_code_default,
                    location_type=location_type_default,
                )
                
                # 4) Mappings
                StopNameKeywordMap.objects.create(
                    stop_id=new_stop_id,
                    stop_name_group_id=snk.stop_group_id,
                    scenario_id=scenario_id
                )
                StopIdKeywordMap.objects.create(
                    stop_id=new_stop_id,
                    stop_id_group_id=sik.stop_group_id,
                    scenario_id=scenario_id
                )
                
                # 5) Translations (optional)
                translations_payload = data.get("translations", [])
                if translations_payload:
                    from gtfs.utils.translation_utils import upsert_translations
                    upsert_translations(
                        scenario_id=scenario_id,
                        table_name="stops",
                        entity_ids={"stop_id": stop_obj.stop_id},
                        items=translations_payload,
                    )
                
                return BaseResponse(
                data={
                    "stop_id": stop_obj.stop_id,
                    "stop_name_group_id": snk.stop_group_id,
                    "stop_id_group_id": sik.stop_group_id,
                    "stop_name_group_label": name_label,
                },
                message="ストップ、StopNameKeywords/Map、StopIdKeyword/Map を作成しました。",
                error=None,
                status_code=status.HTTP_201_CREATED
                )
            return transactional(_do)()
        except Exception as e:
            log_json(
                logger,
                logging.ERROR,
                {"message": "Error creating StopsGroupData", "scenario_id": str(scenario_id), "error": str(e)}
            )
            return BaseResponse(
                message=ErrorMessages.ERROR_OCCURRED_TEMPLATE_JA.format(error=str(e)),
                data=None,
                error=ErrorMessages.ERROR_OCCURRED_TEMPLATE_JA.format(error=str(e)),
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    

@log_service_call
class StopService:
    serializer_class = StopSerializer

    @staticmethod
    def get_queryset(scenario_id=None):
        if scenario_id:
            return Stops.objects.filter(scenario_id=scenario_id)
        return Stops.objects.none() 
    
    @staticmethod
    def list(*, scenario_id):
        if not scenario_id:
            return BaseResponse(
                data=None,
                message=ErrorMessages.SCENARIO_ID_REQUIRED_JA,
                error=ErrorMessages.SCENARIO_ID_REQUIRED_JA,
                status_code=status.HTTP_400_BAD_REQUEST
            )
        
        qs = StopService.get_queryset(scenario_id=scenario_id)
        if not qs.exists():
            return BaseResponse(
                data=None,
                message=ErrorMessages.CALENDAR_NOT_FOUND_JA,
                error=ErrorMessages.CALENDAR_NOT_FOUND_JA,
                status_code=status.HTTP_404_NOT_FOUND
            )
        serializer = StopSerializer(qs, many=True)

        return BaseResponse(
            message='カレンダーリストを読むことが完了しました',
            data=serializer.data,
            error=None,
            status_code=status.HTTP_200_OK
        )


# -------------------------------
# Update/Patch APIs for Keywords
# -------------------------------

@log_service_call
class StopNameKeywordsService:
    """
    PUT/PATCH:
      /api/gtfs/data/edit/stop-name-keywords/<int:stop_group_id>/
      /api/gtfs/data/edit/stop-name-keywords/<uuid:scenario_id>/<int:stop_group_id>/
    """
    queryset = Scenario.objects.all()
    serializer_class = ScenarioLocalSerializer
    lookup_url_kwarg = "stop_group_id"  # clarify intent (we do manual fetch anyway)

    # helpers
    @staticmethod
    def _get_scenario_id(*, scenario_id=None, payload=None, **kwargs):
        return scenario_id or kwargs.get("scenario_id") or (payload or {}).get("scenario_id")

    @staticmethod
    def _get_instance(scenario_id, stop_group_id):
        try:
            return StopNameKeywords.objects.get(scenario_id=scenario_id, stop_group_id=stop_group_id)
        except StopNameKeywords.DoesNotExist:
            return None

    @staticmethod
    def _validate_unique_keyword(scenario_id, instance, new_keyword):
        if not new_keyword:
            return None
        qs = StopNameKeywords.objects.filter(scenario_id=scenario_id, stop_name_keyword=new_keyword)
        if instance:
            qs = qs.exclude(pk=instance.pk)
        if qs.exists():
            return "このキーワードは既に存在します。"
        return None

    @staticmethod
    @transactional
    def update(*, scenario_id, stop_group_id, payload):
        if not scenario_id:
            return BaseResponse(
                data=None, message=ErrorMessages.SCENARIO_ID_REQUIRED_JA_PERIOD, error=ErrorMessages.SCENARIO_ID_REQUIRED_JA_PERIOD,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        required = ["stop_name_keyword", "stop_group_id_label", "stop_names_lat", "stop_names_long"]
        missing = [f for f in required if f not in payload]
        if missing:
            return BaseResponse(
                data=None,
                message=ErrorMessages.REQUIRED_FIELDS_MISSING_TEMPLATE_JA.format(fields=", ".join(missing)),
                error=ErrorMessages.REQUIRED_FIELDS_MISSING_TEMPLATE_JA.format(fields=", ".join(missing)),
                status_code=status.HTTP_400_BAD_REQUEST
            )

        instance = StopNameKeywordsService._get_instance(scenario_id, stop_group_id)
        if not instance:
            return BaseResponse(
                data=None, message=ErrorMessages.STOP_NAME_KEYWORDS_NOT_FOUND_JA, error=ErrorMessages.STOP_NAME_KEYWORDS_NOT_FOUND_JA,
                status_code=status.HTTP_404_NOT_FOUND
            )

        msg = StopNameKeywordsService._validate_unique_keyword(scenario_id, instance, payload.get("stop_name_keyword"))
        if msg:
            return BaseResponse(data=None, message=msg, error=msg, status_code=status.HTTP_400_BAD_REQUEST)

        instance.stop_name_keyword = payload.get("stop_name_keyword")
        instance.stop_group_id_label = payload.get("stop_group_id_label")
        instance.stop_names_lat = float(payload.get("stop_names_lat"))
        instance.stop_names_long = float(payload.get("stop_names_long"))
        instance.save()
        update_scenario_edit_state(scenario_id, "stops_grouping_data")

        return BaseResponse(
            data={
                "stop_group_id": instance.stop_group_id,
                "stop_name_keyword": instance.stop_name_keyword,
                "stop_group_id_label": instance.stop_group_id_label,
                "stop_names_lat": instance.stop_names_lat,
                "stop_names_long": instance.stop_names_long,
            },
            message="StopNameKeywordsを更新しました。",
            error=None,
            status_code=status.HTTP_200_OK
        )

    @staticmethod
    def partial_update(*, scenario_id, stop_group_id, payload):
        if not scenario_id:
            return BaseResponse(
                data=None, message=ErrorMessages.SCENARIO_ID_REQUIRED_JA_PERIOD, error=ErrorMessages.SCENARIO_ID_REQUIRED_JA_PERIOD,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        instance = StopNameKeywordsService._get_instance(scenario_id, stop_group_id)
        if not instance:
            return BaseResponse(
                data=None, message=ErrorMessages.STOP_NAME_KEYWORDS_NOT_FOUND_JA, error=ErrorMessages.STOP_NAME_KEYWORDS_NOT_FOUND_JA,
                status_code=status.HTTP_404_NOT_FOUND
            )

        if "stop_name_keyword" in payload:
            msg = StopNameKeywordsService._validate_unique_keyword(scenario_id, instance, payload.get("stop_name_keyword"))
            if msg:
                return BaseResponse(data=None, message=msg, error=msg, status_code=status.HTTP_400_BAD_REQUEST)

        if "stop_name_keyword" in payload:
            instance.stop_name_keyword = payload.get("stop_name_keyword")
        if "stop_group_id_label" in payload:
            instance.stop_group_id_label = payload.get("stop_group_id_label")
        if "stop_names_lat" in payload:
            try:
                instance.stop_names_lat = float(payload.get("stop_names_lat"))
            except (TypeError, ValueError):
                pass
        if "stop_names_long" in payload:
            try:
                instance.stop_names_long = float(payload.get("stop_names_long"))
            except (TypeError, ValueError):
                pass
        instance.save()
        update_scenario_edit_state(scenario_id, "stops_grouping_data")

        return BaseResponse(
            data={
                "stop_group_id": instance.stop_group_id,
                "stop_name_keyword": instance.stop_name_keyword,
                "stop_group_id_label": instance.stop_group_id_label,
                "stop_names_lat": instance.stop_names_lat,
                "stop_names_long": instance.stop_names_long,
            },
            message="StopNameKeywordsを部分更新しました。",
            error=None,
            status_code=status.HTTP_200_OK
        )


@log_service_call
class StopIdKeywordService:
    """
    PUT/PATCH:
      /api/gtfs/data/edit/stop-id-keywords/<int:stop_group_id>/
      /api/gtfs/data/edit/stop-id-keywords/<uuid:scenario_id>/<int:stop_group_id>/
    """
    queryset = Scenario.objects.all()
    serializer_class = ScenarioLocalSerializer
    lookup_url_kwarg = "stop_group_id"

    @staticmethod
    def _get_scenario_id(*, scenario_id=None, payload=None, **kwargs):
        return scenario_id or kwargs.get("scenario_id") or (payload or {}).get("scenario_id")

    @staticmethod
    def _get_instance(scenario_id, stop_group_id):
        try:
            return StopIdKeyword.objects.get(scenario_id=scenario_id, stop_group_id=stop_group_id)
        except StopIdKeyword.DoesNotExist:
            return None

    @staticmethod
    def _validate_unique_keyword(scenario_id, instance, new_keyword):
        if not new_keyword:
            return None
        qs = StopIdKeyword.objects.filter(scenario_id=scenario_id, stop_id_keyword=new_keyword)
        if instance:
            qs = qs.exclude(pk=instance.pk)
        if qs.exists():
            return "このキーワードは既に存在します。"
        return None

    @staticmethod
    def update(*, scenario_id, stop_group_id, payload):
        if not scenario_id:
            return BaseResponse(
                data=None, message=ErrorMessages.SCENARIO_ID_REQUIRED_JA_PERIOD, error=ErrorMessages.SCENARIO_ID_REQUIRED_JA_PERIOD,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        required = ["stop_id_keyword", "stop_group_name_label", "stop_id_lat", "stop_id_long"]
        missing = [f for f in required if f not in payload]
        if missing:
            return BaseResponse(
                data=None,
                message=ErrorMessages.REQUIRED_FIELDS_MISSING_TEMPLATE_JA.format(fields=", ".join(missing)),
                error=ErrorMessages.REQUIRED_FIELDS_MISSING_TEMPLATE_JA.format(fields=", ".join(missing)),
                status_code=status.HTTP_400_BAD_REQUEST
            )

        instance = StopIdKeywordService._get_instance(scenario_id, stop_group_id)
        if not instance:
            return BaseResponse(
                data=None, message=ErrorMessages.STOP_ID_KEYWORD_NOT_FOUND_JA, error=ErrorMessages.STOP_ID_KEYWORD_NOT_FOUND_JA,
                status_code=status.HTTP_404_NOT_FOUND
            )

        msg = StopIdKeywordService._validate_unique_keyword(scenario_id, instance, payload.get("stop_id_keyword"))
        if msg:
            return BaseResponse(data=None, message=msg, error=msg, status_code=status.HTTP_400_BAD_REQUEST)

        instance.stop_id_keyword = payload.get("stop_id_keyword")
        instance.stop_group_name_label = payload.get("stop_group_name_label")
        instance.stop_id_lat = float(payload.get("stop_id_lat"))
        instance.stop_id_long = float(payload.get("stop_id_long"))
        instance.save()
        update_scenario_edit_state(scenario_id, "stops_grouping_data")

        return BaseResponse(
            data={
                "stop_group_id": instance.stop_group_id,
                "stop_id_keyword": instance.stop_id_keyword,
                "stop_group_name_label": instance.stop_group_name_label,
                "stop_id_lat": instance.stop_id_lat,
                "stop_id_long": instance.stop_id_long,
            },
            message="StopIdKeywordを更新しました。",
            error=None,
            status_code=status.HTTP_200_OK
        )

    @staticmethod
    def partial_update(*, scenario_id, stop_group_id, payload):
        if not scenario_id:
            return BaseResponse(
                data=None, message=ErrorMessages.SCENARIO_ID_REQUIRED_JA_PERIOD, error=ErrorMessages.SCENARIO_ID_REQUIRED_JA_PERIOD,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        instance = StopIdKeywordService._get_instance(scenario_id, stop_group_id)
        if not instance:
            return BaseResponse(
                data=None, message=ErrorMessages.STOP_ID_KEYWORD_NOT_FOUND_JA, error=ErrorMessages.STOP_ID_KEYWORD_NOT_FOUND_JA,
                status_code=status.HTTP_404_NOT_FOUND
            )

        if "stop_id_keyword" in payload:
            msg = StopIdKeywordService._validate_unique_keyword(scenario_id, instance, payload.get("stop_id_keyword"))
            if msg:
                return BaseResponse(data=None, message=msg, error=msg, status_code=status.HTTP_400_BAD_REQUEST)

        if "stop_id_keyword" in payload:
            instance.stop_id_keyword = payload.get("stop_id_keyword")
        if "stop_group_name_label" in payload:
            instance.stop_group_name_label = payload.get("stop_group_name_label")
        if "stop_id_lat" in payload:
            try:
                instance.stop_id_lat = float(payload.get("stop_id_lat"))
            except (TypeError, ValueError):
                pass
        if "stop_id_long" in payload:
            try:
                instance.stop_id_long = float(payload.get("stop_id_long"))
            except (TypeError, ValueError):
                pass
        instance.save()
        update_scenario_edit_state(scenario_id, "stops_grouping_data")

        return BaseResponse(
            data={
                "stop_group_id": instance.stop_group_id,
                "stop_id_keyword": instance.stop_id_keyword,
                "stop_group_name_label": instance.stop_group_name_label,
                "stop_id_lat": instance.stop_id_lat,
                "stop_id_long": instance.stop_id_long,
            },
            message="StopIdKeywordを部分更新しました。",
            error=None,
            status_code=status.HTTP_200_OK
        )
