# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import logging
import threading
from urllib.parse import quote

import requests
from django.utils import timezone
from django.db import transaction, IntegrityError
from django.core.files.base import ContentFile
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import OuterRef, Subquery, Prefetch
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import ValidationError as DRFValidationError
from gtfs.services.base import log_service_call, transactional
from gtfs.models import (
    Scenario,
    FeedInfo,
    Routes,
    Stops,
    Trips,
    StopTimes,
    Agency,
    Shape,
    Calendar,
    CalendarDates,
    FareAttribute,
    FareRule,
    Translation,
    Notification,
    Frequencies,
    Transfers,
    Pathway,
    Level,
    LocationGroup,
    LocationGroupStop,
    BookingRule,
    Attribution,
    GtfsImportedFile,
    AgencyJP,
    OfficeJP,
    PatternJP,
    Timeframe,
    RiderCategory,
    FareMedia,
    FareProduct,
    FareLegRule,
    FareLegJoinRule,
    FareTransferRule,
    Area,
    StopArea,
    Network,
    RouteNetwork,

)
from gtfs.serializers.request.scenario_request import (
    CloneScenarioSerializer,
    ScenarioAPICreateRequestSerializer,
    ScenarioLocalCreateRequestSerializer,
    ScenarioUpdateSerializer,
)
from gtfs.serializers.response.scenario_response import ScenarioAPISerializer, ScenarioLocalSerializer
from gtfs.utils.scenario_utils import clone_scenario_models, generate_gtfs_zip_export, update_scenario_and_feed_and_calendar
from mobilys_BE.shared.response import BaseResponse
from user.models import ProjectUserMap
from ..utils.gtfs_importer import GTFSImporter, GTFSImportError
from gtfs.services.gtfs_validator import GtfsValidatorService
from visualization.tasks import delete_router_task
from gtfs.serializers.translation_serializers import TranslationSerializer
from gtfs.utils.translation_utils import upsert_translations
from gtfs.utils.scenario_utils import update_scenario_edit_state, _norm_project_id
from gtfs.constants import ALL_EXPORT_FILES, ErrorMessages, GraphStatus, ScenarioDeletionState, SourceType

from mobilys_BE.shared.log_json import log_json

logger = logging.getLogger(__name__)


@log_service_call
class ScenarioService:
    @staticmethod
    def validate_gtfs_with_external_validator(zip_file):
        """
        Validate GTFS ZIP file using external validator.
        
        Args:
            zip_file: Uploaded ZIP file (InMemoryUploadedFile or ContentFile)
            
        Returns:
            tuple: (is_valid, error_response)
                - is_valid: True if no blocking errors (ERROR severity, excluding translations.txt)
                - error_response: Dict to store in Notification.error_response if error, None otherwise
        """
        try:
            validation_result = GtfsValidatorService.validate_zip_file(zip_file)
            
            if validation_result['has_blocking_errors']:
                error_response = GtfsValidatorService.format_error_response(validation_result)
                return False, error_response
            
            return True, None
            
        except requests.exceptions.RequestException as e:
            # Validator API connection error
            log_json(
                logger,
                logging.ERROR,
                "gtfs_validator_connection_error",
                error=str(e)
            )
            error_response = {
                'error': 'GTFS Validator service connection error',
                'message': str(e),
            }
            return False, error_response
        except Exception as e:
            # Other unexpected errors
            log_json(
                logger,
                logging.ERROR,
                "gtfs_validator_unexpected_error",
                error=str(e)
            )
            error_response = {
                'error': 'GTFS Validator service error',
                'message': str(e),
            }
            return False, error_response
    
    @staticmethod
    @transactional
    def handle_scenario_import(scenario_name, gtfs_zip, user, source_type, start_date, end_date):
        """
        Handle scenario import after validation.
        
        Flow:
        1. Validate with external GTFS Validator
        2. If validation fails (ERROR severity, excluding translations.txt) -> return 400
        3. If validation passes -> import data to database
        """
        def rollback(resp):
            transaction.set_rollback(True)
            return resp

        # Keep existing date validation
        if end_date and start_date and start_date > end_date:
            log_json(
                logger,
                logging.WARNING,
                "handle_scenario_import_invalid_date_range",
                scenario_name=scenario_name,
                user_id=str(user.id),
                start_date=str(start_date),
                end_date=str(end_date)
            )
            return rollback(BaseResponse(
                data=None,
                message=ErrorMessages.START_DATE_AFTER_END_DATE_JA,
                error={"source": "internal", "code": "date_range_invalid", "message": ErrorMessages.START_DATE_AFTER_END_DATE_JA},
                status_code=status.HTTP_400_BAD_REQUEST
            ))

        # NEW: Validate with external GTFS Validator BEFORE creating scenario
        is_valid, validation_error = ScenarioService.validate_gtfs_with_external_validator(gtfs_zip)
        
        if not is_valid:
            log_json(
                logger,
                logging.WARNING,
                "handle_scenario_import_validation_failed",
                scenario_name=scenario_name,
                user_id=str(user.id),
                error=str(validation_error)
            )
            return rollback(BaseResponse(
                data=None,
                message=ErrorMessages.GTFS_VALIDATION_ERROR_JA,
                error=validation_error,
                status_code=status.HTTP_400_BAD_REQUEST
            ))
        
        # Reset file pointer after validation
        if hasattr(gtfs_zip, 'seek'):
            gtfs_zip.seek(0)

        # Create scenario
        try:
            scenario = Scenario.objects.create(
                scenario_name=scenario_name,
                user=user,
                source_type=source_type,
                gtfs_filename=gtfs_zip.name,
                start_date=start_date,
                end_date=end_date
            )
        except IntegrityError:
            log_json(
                logger,
                logging.WARNING,
                "handle_scenario_import_duplicate_name",
                scenario_name=scenario_name,
                user_id=str(user.id),
            )
            return rollback(BaseResponse(
                data=None,
                message=ErrorMessages.SCENARIO_NAME_ALREADY_EXISTS_JA,
                error={
                    "source": "internal",
                    "code": "duplicate_scenario_name",
                    "message": ErrorMessages.SCENARIO_NAME_ALREADY_EXISTS_VARIANT_JA,
                },
                status_code=status.HTTP_400_BAD_REQUEST
            ))
        except Exception as e:
            log_json(
                logger,
                logging.ERROR,
                "handle_scenario_import_creation_failed",
                scenario_name=scenario_name,
                user_id=str(user.id),
                error=str(e)
            )
            return rollback(BaseResponse(
                data=None,
                message=ErrorMessages.SCENARIO_CREATE_INTERNAL_ERROR_JA,
                error={"source": "internal", "code": "db_error", "message": str(e)},
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            ))

        # Import GTFS data (simplified - no validation, validation already done above)
        try:
            import_result = GTFSImporter(scenario=scenario, zip_file=gtfs_zip).process()
        except GTFSImportError as e:
            log_json(
                logger,
                logging.WARNING,
                "gtfs_import_failed",
                scenario_id=str(scenario.id),
                error_count=len(e.errors),
            )
            return rollback(BaseResponse(
                data=None,
                message=ErrorMessages.GTFS_IMPORT_FAILED_JA,
                error=e.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            ))
        except Exception as e:
            log_json(
                logger,
                logging.ERROR,
                "gtfs_import_failed_unexpectedly",
                scenario_id=str(scenario.id),
                error=str(e),
                import_result=str(import_result)
            )
            return rollback(BaseResponse(
                data=None,
                message=ErrorMessages.GTFS_IMPORT_INTERNAL_ERROR_JA,
                error={"source": "internal", "code": "import_crash", "message": str(e)},
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            ))

        # Save validation result to GtfsValidationResult table
        # This validates the imported data and stores the result for future reference
        try:
            GtfsValidatorService.validate_scenario(scenario)
        except Exception as e:
            # Log but don't fail the import - validation result is optional
            logger.warning(f"Failed to save validation result for scenario {scenario.id}: {e}")

        # Import always succeeds now (validation is done before)
        # import_result should be None for success
        return BaseResponse(
            message="アップロードが成功しました。",
            data={
                "filename": gtfs_zip.name,
                "scenario_id": str(scenario.id)
            },
            error=None,
            status_code=status.HTTP_201_CREATED
        )

@log_service_call
class ScenarioLocalService:

    @staticmethod
    def get_queryset(*, user):

        project_ids = (
            ProjectUserMap.objects
            .filter(user=user)
            .values_list("project_id", flat=True)
        )

        if not project_ids:
            return Scenario.objects.filter(
                user=user,
                deletion_state=ScenarioDeletionState.ACTIVE.value,
            )

        shared_user_ids = (
            ProjectUserMap.objects
            .filter(project_id__in=project_ids)
            .values_list("user_id", flat=True)
            .distinct()
        )

        return Scenario.objects.filter(
            user_id__in=shared_user_ids,
            deletion_state=ScenarioDeletionState.ACTIVE.value,
        )

    @staticmethod
    @transactional
    def destroy(*, user, pk):
        scenario = get_object_or_404(ScenarioLocalService.get_queryset(user=user), pk=pk)
        if not scenario:
            log_json(
                logger,
                logging.ERROR,
                "remove_scenario_not_found",
                scenario_id=str(scenario.id),
            )
            return BaseResponse(
                data=None,
                message=ErrorMessages.SCENARIO_NOT_FOUND_JA,
                error=ErrorMessages.SCENARIO_NOT_FOUND_JA,
                status_code=status.HTTP_400_BAD_REQUEST
            )
        try:
            update_scenario_edit_state(scenario.id, "feed_and_calendar_data")
        except Exception as e:
            log_json(
                logger,
                logging.WARNING,
                "remove_scenario_update_edit_state_failed",
                scenario_id=str(scenario.id),
                error=str(e)
            )
        # If the scenario still building, give err
        if scenario.osm_graph_status == GraphStatus.BUILDING.value or scenario.drm_graph_status == GraphStatus.BUILDING.value:
            log_json(
                logger,
                logging.WARNING,
                "remove_scenario_still_building",
                scenario_id=str(scenario.id),
            )
            return BaseResponse(
                data=None,
                message=ErrorMessages.SCENARIO_BUILD_IN_PROGRESS_DELETE_BLOCKED_JA,
                error=ErrorMessages.SCENARIO_BUILD_IN_PROGRESS_DELETE_BLOCKED_JA,
                status_code=status.HTTP_400_BAD_REQUEST
            )
        # If the scenario havent created graph
        if scenario.osm_graph_status == GraphStatus.PENDING.value and scenario.drm_graph_status == GraphStatus.PENDING.value:
            # Delete the scenario directly
            try:
                def _do():
                    Notification.objects.filter(scenario_id=scenario.id, description="success").exclude(notification_path="").update(
                        notification_path="",             
                        screen_menu="snackbar",            
                        error_response={
                            "message": "このシナリオは削除されています"  
                        },
                    )
                    scenario.delete()
                    return BaseResponse(
                        data=None,
                        message="シナリオが削除されました",
                        error=None,
                        status_code=status.HTTP_200_OK
                    )
                return transactional(_do)()
            except Exception as e:
                log_json(
                    logger,
                    logging.ERROR,
                    "remove_scenario_direct_delete_failed",
                    scenario_id=str(scenario.id),
                    error=str(e)
                )
                return BaseResponse(
                    data=None,
                    message=ErrorMessages.SCENARIO_DELETE_ERROR_JA,
                    error=str(e),
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
    
        scenario.deletion_state = ScenarioDeletionState.DELETION_PENDING.value
        scenario.save()
        transaction.on_commit(lambda: threading.Thread(
            target=delete_router_task,
            args=(str(scenario.id),),
            daemon=True
        ).start())

        return BaseResponse(
            data=None,
            message="シナリオの削除がスケジュールされました。エラーが発生した場合は通知されます。",
            error=None,
            status_code=status.HTTP_200_OK
        )


    @staticmethod
    def _perform_update(*, user, pk, payload):
        scenario = get_object_or_404(ScenarioLocalService.get_queryset(user=user), pk=pk)
        if not scenario:
            log_json(
                logger,
                logging.ERROR,
                "update_scenario_not_found",
                scenario_id=str(scenario.id),
            )
            return BaseResponse(
                data=None,
                message=ErrorMessages.SCENARIO_NOT_FOUND_JA,
                error=ErrorMessages.SCENARIO_NOT_FOUND_JA,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        serializer = ScenarioUpdateSerializer(data=payload, partial=True)
        try:
            serializer.is_valid(raise_exception=True)

            result = update_scenario_and_feed_and_calendar(
                scenario_id=scenario.id,
                user=user,
                payload=serializer.validated_data,
                keep_calendar_if_only_date_change=False,
            )

            update_scenario_edit_state(scenario.id, "feed_and_calendar_data")

            return BaseResponse(
                data={
                    "id": str(scenario.id),
                    "gtfs_filename": scenario.gtfs_filename,
                    "created_datetime": scenario.created_datetime,
                    "updated_datetime": scenario.updated_datetime,
                    "scenario_name": scenario.scenario_name,
                    "source_type": scenario.get_source_type_display(),
                    "start_date": scenario.start_date,
                    "end_date": scenario.end_date,
                },
                message="シナリオが更新されました。",
                error=None,
                status_code=status.HTTP_200_OK,
            )

        except (DRFValidationError, DjangoValidationError) as e:
            log_json(
                logger,
                logging.WARNING,
                "update_scenario_validation_error",
                scenario_id=str(scenario.id),
                error=str(e)
            )
            msg = str(getattr(e, "detail", e))
            error_payload = msg 

            if isinstance(e, DjangoValidationError):
                try:
                    marker = "この運行カレンダーは以下の運行パターンで使用されているため削除できません。"
                    if marker in msg and hasattr(serializer, "validated_data"):
                        cal_payload = serializer.validated_data.get("calendar")

                        removed_service_ids = []
                        if isinstance(cal_payload, list):
                            existing_ids = set(
                                Calendar.objects.filter(scenario_id=scenario.id)
                                .values_list("service_id", flat=True)
                            )
                            incoming_ids = {
                                row.get("service_id")
                                for row in cal_payload
                                if row.get("service_id") is not None
                            }
                            removed_service_ids = list(existing_ids - incoming_ids)

                        if removed_service_ids:
                            trips = list(
                                Trips.objects.filter(
                                    scenario_id=scenario.id,
                                    service_id__in=removed_service_ids,
                                ).values(
                                    "trip_id",
                                    "route_id",
                                    "direction_id",
                                    "service_id",
                                    "shape_id",
                                )
                            )

                            if trips:
                                trip_ids = [t["trip_id"] for t in trips]

                                sts = list(
                                    StopTimes.objects.filter(
                                        scenario_id=scenario.id,
                                        trip_id__in=trip_ids,
                                    )
                                    .order_by("trip_id", "stop_sequence")
                                    .values("trip_id", "stop_id")
                                )

                                first_last_by_trip: dict[str, list[str]] = {}
                                for row in sts:
                                    tid = row["trip_id"]
                                    sid = row["stop_id"]
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
                                    for s in Stops.objects.filter(
                                        scenario_id=scenario.id,
                                        stop_id__in=needed_stop_ids,
                                    )
                                }

                                trip_details = []
                                for t in trips:
                                    bounds = first_last_by_trip.get(t["trip_id"])
                                    first_name = ""
                                    last_name = ""
                                    if bounds:
                                        first_name = stop_name_map.get(bounds[0], "")
                                        last_name = stop_name_map.get(bounds[1], "")

                                    trip_details.append(
                                        {
                                            "trip_id": t["trip_id"],
                                            "route_id": t["route_id"],
                                            "direction_id": t["direction_id"],
                                            "service_id": t["service_id"],
                                            "shape_id": t["shape_id"],
                                            "first_stop_name": first_name,
                                            "last_stop_name": last_name,
                                        }
                                    )

                                # This is what FE can consume
                                error_payload = {
                                    "message": msg,
                                    "service_ids": removed_service_ids,
                                    "trips": trip_details,
                                }

                except Exception as build_err:
                    # Do not break the API if debug info building fails
                    log_json(
                        logger,
                        logging.WARNING,
                        "update_scenario_build_validation_debug_failed",
                        scenario_id=str(scenario.id),
                        error=str(build_err)
                    )

            return BaseResponse(
                data=None,
                message=ErrorMessages.INVALID_UPDATE_CONTENT_JA,
                error=error_payload,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as e:
            log_json(
                logger,
                logging.ERROR,
                "update_scenario_unexpected_error",
                scenario_id=str(scenario.id),
                error=str(e)
            )
            return BaseResponse(
                data=None,
                message=ErrorMessages.SYSTEM_ERROR_RETRY_JA,
                error=str(e),
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @staticmethod
    def update(*, user, pk, payload):
        try:
            def _do():
                return ScenarioLocalService._perform_update(user=user, pk=pk, payload=payload)
            return transactional(_do)()
        except Exception as e:
            log_json(
                logger,
                logging.ERROR,
                "update_scenario_transaction_error",
                error=str(e)
            )
            return BaseResponse(
                data=None,
                message=ErrorMessages.SYSTEM_ERROR_RETRY_JA,
                error=str(e),
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
            
    
    @staticmethod
    def partial_update(*, user, pk, payload):
        return ScenarioLocalService._perform_update(user=user, pk=pk, payload=payload)

    @staticmethod
    def list(*, user, params):
        # user is passed in
        if not user.is_authenticated:
            return BaseResponse(
                data=None,
                message=ErrorMessages.AUTHENTICATION_REQUIRED_JA,
                error=ErrorMessages.AUTHENTICATION_REQUIRED_JA,
                status_code=status.HTTP_401_UNAUTHORIZED
            )
        
        project_id = params.get('project_id', None)
        project_name = None
        
        queryset = ScenarioLocalService.get_queryset(user=user)
        
        if project_id:
            try:
                user_in_project = ProjectUserMap.objects.filter(
                    project_id=project_id,
                    user=user
                ).exists()
                
                if not user_in_project:
                    return BaseResponse(
                        data=None,
                        message=ErrorMessages.PERMISSION_DENIED_PROJECT_JA,
                        error=ErrorMessages.PERMISSION_DENIED_PROJECT_JA,
                        status_code=status.HTTP_403_FORBIDDEN
                    )
                
                active_user_ids = ProjectUserMap.objects.filter(
                    project_id=project_id,
                    user__is_active=True
                ).values_list('user_id', flat=True)

                queryset = Scenario.objects.filter(
                    user_id__in=active_user_ids,
                    deletion_state=ScenarioDeletionState.ACTIVE.value
                )

                try:
                    from user.models import Project

                    project_name = Project.objects.filter(id=project_id).values_list("project_name", flat=True).first()
                except Exception:
                    project_name = None
                
            except Exception as e:
                log_json(
                    logger,
                    logging.ERROR,
                    "list_scenarios_project_fetch_error",
                    project_id=project_id,
                    error=str(e)
                )
                return BaseResponse(
                    data=None,
                    message=ErrorMessages.PROJECT_FETCH_FAILED_JA,
                    error=str(e),
                    status_code=status.HTTP_400_BAD_REQUEST
                )
        else:
            queryset = Scenario.objects.filter(
                user=user,
                user__is_active=True,
                deletion_state=ScenarioDeletionState.ACTIVE.value
            )
        
        queryset = queryset.prefetch_related(
            Prefetch(
                'feedinfo_set',
                queryset=FeedInfo.objects.order_by('id'),
                to_attr='_prefetched_feed_info_list'
            )
        )
        
        scenarios = list(queryset)
        for scenario in scenarios:
            feed_info_list = getattr(scenario, '_prefetched_feed_info_list', [])
            scenario._prefetched_feed_info = feed_info_list[0] if feed_info_list else None
        
        serializer = ScenarioLocalSerializer(
            scenarios,
            many=True,
            context={"current_user": user, "project_id": project_id, "project_name": project_name},
        )
        
        return BaseResponse(
            message="シナリオのリストが取得されました。",
            error=None,
            data=serializer.data,
            status_code=status.HTTP_200_OK
        )

    @staticmethod
    def create(*, user, payload, files):
        # Validate the request data
        data = payload.copy() if hasattr(payload, "copy") else dict(payload)
        data["gtfs_zip"] = (files or {}).get("gtfs_zip") or data.get("gtfs_zip")
        serializer = ScenarioLocalCreateRequestSerializer(data=data)
        serializer.is_valid(raise_exception=False)
        # Extract the scenario name and GTFS ZIP file from the request

        scenario_name = serializer.validated_data.get("scenario_name") or (payload or {}).get("scenario_name")

        # send notification to user that scenario import has started
        try:
            Notification.objects.create(
                user=user,
                message=f"{scenario_name}のシナリオの作成を開始しました。完了するまでしばらくお待ちください。",
                notification_path="",
                scenario_id=None,
                screen_menu="GTFSデータインポート",
                is_read=False,
                description="message"
            )
        except Exception as e:
            log_json(
                logger,
                logging.WARNING,
                "create_scenario_notification_failed",
                scenario_name=scenario_name,
                user_id=str(user.id),
                error=str(e)
            )

        gtfs_zip = (files or {}).get('gtfs_zip') or serializer.validated_data.get("gtfs_zip")
        if not gtfs_zip or not gtfs_zip.name.lower().endswith('.zip'):
            log_json(
                logger,
                logging.WARNING,
                "create_scenario_invalid_file_format",
                scenario_name=scenario_name,
                user_id=str(user.id),
            )
            return BaseResponse(
                data=None,
                message=ErrorMessages.INVALID_FILE_FORMAT_ZIP_ONLY_JA,
                error=ErrorMessages.INVALID_FILE_FORMAT_ZIP_ONLY_JA,
                status_code=status.HTTP_400_BAD_REQUEST
            )
        
        response = ScenarioService.handle_scenario_import(
            scenario_name,
            gtfs_zip,
            user,
            SourceType.LOCAL_FILE.value,
            None,
            None
        )   
        # Handle notification based on response status
        if response.status_code == status.HTTP_400_BAD_REQUEST:
            log_json(
                logger,
                logging.WARNING,
                "create_scenario_import_failed",
                scenario_name=scenario_name,
                user_id=str(user.id),
                error=str(response.data.get('error'))
            )
            # Error - create error notification with full validator response
            Notification.objects.create(
                user=user,
                message=f"{scenario_name}の作成中にエラーが発生しました。詳細をご確認ください。",
                notification_path="",
                scenario_id=None,  # Scenario was rolled back
                screen_menu="GTFSデータインポート",
                is_read=False,
                description="error",
                error_response=response.data.get('error') if hasattr(response, 'data') and isinstance(response.data, dict) else None
            )
        
        elif response.status_code == status.HTTP_201_CREATED:
            # Success - get the created scenario
            scenario = Scenario.objects.filter(
                scenario_name=scenario_name,
                user=user
            ).order_by('-created_datetime').first()
            
            if scenario:
                # Create success notification
                try:
                    def _do():
                        Notification.objects.create(
                            user=user,
                            message=f"{scenario_name}のシナリオの作成が完了しました。",
                            notification_path="/scenario/" + str(scenario.id) +"?tab=validation",
                            scenario_id=str(scenario.id),
                            screen_menu="GTFSデータインポート",
                            is_read=False,
                            description="success"
                        )
                        
                        # Handle translations if provided
                        translations = payload.get("translations", [])
                        if translations:
                            for t in translations:
                                tbl = t.get("table_name")
                                if not tbl:
                                    continue
                                entity_ids = {
                                    "route_id": t.get("route_id") or "",
                                    "trip_id": t.get("trip_id") or "",
                                    "service_id": t.get("service_id") or "",
                                    "stop_id": t.get("stop_id") or "",
                                    "shape_id": t.get("shape_id") or "",
                                    "feed_info_id": t.get("feed_info_id") or "",
                                }
                                upsert_translations(
                                    scenario_id = scenario.id,
                                    table_name = tbl,
                                    entity_ids = entity_ids,
                                    items = [{
                                        "field_name": t.get("field_name"),
                                        "language": t.get("language"),
                                        "translation": t.get("translation"),
                                        "field_value": t.get("field_value", ""),
                                        "record_id": t.get("record_id", ""),
                                        "record_sub_id": t.get("record_sub_id", ""),
                                    }],
                                )
                    return transactional(_do)()
                except Exception as e:
                    log_json(
                        logger,
                        logging.WARNING,
                        "create_scenario_success_notification_failed",
                        scenario_name=scenario_name,
                        scenario_id=str(scenario.id),
                        user_id=str(user.id),
                        error=str(e)
                    )

        return response



    @staticmethod
    def retrieve(*, user, pk, params):
        # user is passed in
        if not user.is_authenticated:
            return BaseResponse(
                data=None,
                message=ErrorMessages.AUTHENTICATION_REQUIRED_JA,
                error=ErrorMessages.AUTHENTICATION_REQUIRED_JA,
                status_code=status.HTTP_401_UNAUTHORIZED
            )

        pk = pk
        project_id = params.get("project_id", None)

        # Base queryset: only ACTIVE scenarios
        qs = Scenario.objects.filter(
            deletion_state=ScenarioDeletionState.ACTIVE.value
        )

        if project_id:
            try:
                # Check that the user belongs to this project
                user_in_project = ProjectUserMap.objects.filter(
                    project_id=project_id,
                    user=user
                ).exists()

                if not user_in_project:
                    return BaseResponse(
                        data=None,
                        message=ErrorMessages.PERMISSION_DENIED_PROJECT_JA,
                        error=ErrorMessages.PERMISSION_DENIED_PROJECT_JA,
                        status_code=status.HTTP_403_FORBIDDEN
                    )

                # All ACTIVE users in this project
                active_user_ids = ProjectUserMap.objects.filter(
                    project_id=project_id,
                    user__is_active=True
                ).values_list("user_id", flat=True)

                qs = qs.filter(user_id__in=active_user_ids)
            except Exception as e:
                return BaseResponse(
                    data=None,
                    message=ErrorMessages.PROJECT_FETCH_FAILED_JA,
                    error=str(e),
                    status_code=status.HTTP_400_BAD_REQUEST
                )
        else:
            # Default: only scenarios owned by the current (active) user
            qs = qs.filter(
                user=user,
                user__is_active=True,
            )

        try:
            scenario = qs.get(pk=pk)
        except Scenario.DoesNotExist:
            return BaseResponse(
                data=None,
                message=ErrorMessages.SCENARIO_NOT_FOUND_JA,
                error=ErrorMessages.SCENARIO_NOT_FOUND_JA,
                status_code=status.HTTP_400_BAD_REQUEST
            )
        feed_info = FeedInfo.objects.filter(scenario=scenario).first()
        if not feed_info:
            return BaseResponse(
                data=None,
                message=ErrorMessages.FEEDINFO_NOT_FOUND_JA,
                error=ErrorMessages.FEEDINFO_NOT_FOUND_JA,
                status_code=status.HTTP_400_BAD_REQUEST
            )
        import_info = ScenarioLocalService.getImportInfo(scenario)
        return BaseResponse(
            message="リクエストが正常に完了しました。",
            data={
                "feed_publisher_name": feed_info.feed_publisher_name,
                "feed_publisher_url": feed_info.feed_publisher_url,
                "feed_lang": feed_info.feed_lang,
                "feed_start_date": feed_info.feed_start_date,
                "feed_end_date": feed_info.feed_end_date,
                "feed_version": feed_info.feed_version,
                "scenario_prefecture": scenario.prefecture_info,
                "scenario_region": scenario.region_info,
                "import_info": import_info,
            },
            status_code=status.HTTP_200_OK
        )

    @staticmethod
    def getImportInfo(scenario):
        scenario_id = scenario.id
        scenario._prefetched_feed_info = FeedInfo.objects.filter(scenario=scenario).order_by("id").first()
        import_info = ScenarioLocalSerializer(instance=scenario).data

        # map filename -> queryset for counting
        table_map = {
            "agency_jp.txt": AgencyJP.objects,
            "office_jp.txt": OfficeJP.objects,
            "pattern_jp.txt": PatternJP.objects,
            "agency.txt": Agency.objects,
            "stops.txt": Stops.objects,
            "routes.txt": Routes.objects,
            "trips.txt": Trips.objects,
            "stop_times.txt": StopTimes.objects,
            "calendar.txt": Calendar.objects,
            "calendar_dates.txt": CalendarDates.objects,
            "shapes.txt": Shape.objects,
            "frequencies.txt": Frequencies.objects,
            "transfers.txt": Transfers.objects,
            "pathways.txt": Pathway.objects,
            "levels.txt": Level.objects,
            "location_groups.txt": LocationGroup.objects,
            "location_group_stops.txt": LocationGroupStop.objects,
            "booking_rules.txt": BookingRule.objects,
            "attributions.txt": Attribution.objects,
            "fare_attributes.txt": FareAttribute.objects,
            "fare_rules.txt": FareRule.objects,
            "feed_info.txt": FeedInfo.objects,
            "translations.txt": Translation.objects,
            "timeframes.txt": Timeframe.objects,
            "rider_categories.txt": RiderCategory.objects,
            "fare_media.txt": FareMedia.objects,
            "fare_products.txt": FareProduct.objects,
            "fare_leg_rules.txt": FareLegRule.objects,
            "fare_leg_join_rules.txt": FareLegJoinRule.objects,
            "fare_transfer_rules.txt": FareTransferRule.objects,
            "areas.txt": Area.objects,
            "stop_areas.txt": StopArea.objects,
            "networks.txt": Network.objects,
            "route_networks.txt": RouteNetwork.objects,
        }


        default_files = [
            "agency.txt",
            "stops.txt",
            "routes.txt",
            "trips.txt",
            "stop_times.txt",
            "calendar.txt",
            "calendar_dates.txt",
            "fare_attributes.txt",
            "fare_rules.txt",
            "shapes.txt",
            "translations.txt",
            "feed_info.txt",
        ]

        imported_files = list(
            GtfsImportedFile.objects.filter(scenario=scenario).values_list("file_name", flat=True)
        )
        target_files = imported_files or default_files

        # Exception files: include when data exists even if not imported
        exception_files = [
            ("translations.txt", Translation.objects.filter(scenario=scenario).exists()),
            ("shapes.txt", Shape.objects.filter(scenario=scenario).exists()),
            ("calendar.txt", Calendar.objects.filter(scenario=scenario).exists()),
            ("calendar_dates.txt", CalendarDates.objects.filter(scenario=scenario).exists()),
        ]
        for fname, has_data in exception_files:
            if has_data and fname not in target_files:
                target_files.append(fname)

        record_count = {}
        for fname in target_files:
            qs = table_map.get(fname)
            if qs is not None:
                record_count[fname] = qs.filter(scenario_id=scenario_id).count()
            else:
                # file was imported but we don't have a mapping; note it
                record_count[fname] = None

        import_info["record_count"] = record_count
        return import_info

    @staticmethod
    def clone(*, user, payload):
        serializer = CloneScenarioSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        source_id = serializer.validated_data['source_scenario_id']
        # Validate that source scenario exists
        try:
            source = Scenario.objects.filter(
                id=source_id,
                deletion_state=ScenarioDeletionState.ACTIVE.value
            ).first()
            if not source:
                log_json(
                    logger,
                    logging.WARNING,
                    "clone_scenario_source_not_found",
                    source_scenario_id=str(source_id),
                )
                return BaseResponse(
                    data=None,
                    message=ErrorMessages.SCENARIO_NOT_FOUND_JA_DOT,
                    error=ErrorMessages.SPECIFIED_SCENARIO_NOT_FOUND_JA,
                    status_code=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            log_json(
                logger,
                logging.ERROR,
                "clone_scenario_source_fetch_error",
                source_scenario_id=str(source_id),
                error=str(e)
            )
            return BaseResponse(
                data=None,
                message=ErrorMessages.SCENARIO_FETCH_ERROR_JA,
                error=str(e),
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        # Clone scenario
        try:
            def _do():
                return clone_scenario_models(
                    user=user,
                    source_scenario_id=source_id,
                    new_scenario_name=serializer.validated_data['new_scenario_name']
                )

            new = transactional(_do)()
        except IntegrityError:
                log_json(
                    logger,
                    logging.WARNING,
                    "clone_scenario_duplicate_name",
                    source_scenario_id=str(source_id),
                    new_scenario_name=serializer.validated_data['new_scenario_name'],
                )
                return BaseResponse(
                    data=None,
                    message=ErrorMessages.SCENARIO_NAME_ALREADY_EXISTS_VARIANT_JA,
                    error={
                        "source": "internal",
                        "code": "duplicate_scenario_name",
                        "message": ErrorMessages.SCENARIO_NAME_ALREADY_EXISTS_VARIANT_JA,
                    },
                    status_code=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            log_json(
                logger,
                logging.ERROR,
                "clone_scenario_creation_error",
                source_scenario_id=str(source_id),
                error=str(e)
            )
            return BaseResponse(
                data=None,
                message=ErrorMessages.SCENARIO_CLONE_ERROR_JA,
                error=str(e),
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        new._prefetched_feed_info = FeedInfo.objects.filter(scenario=new).order_by("id").first()
        return BaseResponse(
            message="新しいシナリオが正常に作成されました。",
            data={  
                "new_scenario": ScenarioLocalSerializer(new).data
            },
            error=None,
            status_code=status.HTTP_201_CREATED
        )

    @staticmethod
    def duplication_candidates(*, user, pk=None, params=None):
        """
        Candidates for duplicated_scenario:
        - Same FeedInfo.publisher_name (trim, case-insensitive)
        - Same FeedInfo.start_date and FeedInfo.end_date
        - Exclude original

        Scoping (same as list):
        - default: only user's ACTIVE scenarios
        - if ?project_id=... : any ACTIVE users' scenarios in that project,
            only if requester belongs to that project
        """
        # user is passed in
        if not user.is_authenticated:
            return BaseResponse(
                data=None, message=ErrorMessages.AUTHENTICATION_REQUIRED_JA, error=ErrorMessages.AUTHENTICATION_REQUIRED_JA,
                status_code=status.HTTP_401_UNAUTHORIZED
            )

        project_id = _norm_project_id((params or {}).get("project_id"))

        # Fetch original (ACTIVE)
        original = get_object_or_404(
            Scenario, pk=pk, deletion_state=ScenarioDeletionState.ACTIVE.value
        )

        # Scope candidates like list()
        if project_id:
            in_project = ProjectUserMap.objects.filter(project_id=project_id, user=user).exists()
            if not in_project:
                return BaseResponse(
                    data=None,
                    message=ErrorMessages.PERMISSION_DENIED_PROJECT_JA,
                    error=ErrorMessages.PERMISSION_DENIED_PROJECT_JA,
                    status_code=status.HTTP_403_FORBIDDEN,
                )

            active_user_ids = ProjectUserMap.objects.filter(
                project_id=project_id,
                user__is_active=True
            ).values_list("user_id", flat=True)

            if original.user_id not in set(active_user_ids):
                return BaseResponse(data=None, message="Not found.", status_code=status.HTTP_404_NOT_FOUND)

            base_qs = Scenario.objects.filter(
                user_id__in=active_user_ids,
                deletion_state=ScenarioDeletionState.ACTIVE.value,
            )
        else:
            if not user.is_active or original.user_id != user.id:
                return BaseResponse(data=None, message="Not found.", status_code=status.HTTP_404_NOT_FOUND)

            base_qs = Scenario.objects.filter(
                user=user,
                user__is_active=True,
                deletion_state=ScenarioDeletionState.ACTIVE.value,
            )

        # Original feed_info (latest by id)
        fi = (
            FeedInfo.objects
            .filter(scenario=original)
            .order_by("-id")
            .first()
        )
        if not fi:
            return BaseResponse(
                message="複製候補はありません（feed_info が見つかりません）。",
                data={"scenarios": []},
                status_code=status.HTTP_200_OK,
            )

        publisher = (fi.feed_publisher_name or "").strip()
        start_date = fi.feed_start_date
        end_date = fi.feed_end_date

        # Subquery to annotate each candidate with its latest feed_info fields
        latest_fi = FeedInfo.objects.filter(scenario_id=OuterRef("pk")).order_by("-id")

        candidates = (
            base_qs
            .exclude(pk=original.pk)
            .filter(
                feedinfo__feed_publisher_name__iexact=publisher,
                feedinfo__feed_start_date=start_date,
                feedinfo__feed_end_date=end_date,
            )
            .distinct()
            .order_by("-created_datetime")
            .annotate(
                fi_publisher=Subquery(latest_fi.values("feed_publisher_name")[:1]),
                fi_start=Subquery(latest_fi.values("feed_start_date")[:1]),
                fi_end=Subquery(latest_fi.values("feed_end_date")[:1]),
            )
        )

        project_name = None
        if project_id:
            try:
                from user.models import Project

                project_name = Project.objects.filter(id=project_id).values_list("project_name", flat=True).first()
            except Exception:
                project_name = None

        serializer_context = {"current_user": user, "project_id": project_id, "project_name": project_name}

        scenario_serializer = ScenarioLocalSerializer(context=serializer_context)


        items = []
        for s in candidates:
            scenario_source = scenario_serializer.get_scenario_source(s)
            project_name = scenario_serializer.get_project_name(s)
            items.append(
                {
                    "id": str(s.id),
                    "scenario_name": s.scenario_name,
                    "scenario_source": scenario_source,  
                    "project_name": project_name,
                    "start_date": s.fi_start,
                    "end_date": s.fi_end,
                }
            )

        return BaseResponse(
            message="複製候補のシナリオが取得されました。",
            data={"scenarios": items},
            status_code=status.HTTP_200_OK,
        )

    @staticmethod
    def get_graph_status(*, user, pk):
        scenario = get_object_or_404(ScenarioLocalService.get_queryset(user=user), pk=pk)
        return BaseResponse(
            message="グラフステータスが取得されました。",
            error=None,
            data={"osm_graph_status": scenario.osm_graph_status, "drm_graph_status": scenario.drm_graph_status},
            status_code=status.HTTP_200_OK
        )


    @staticmethod
    def export_gtfs(*, scenario_id: str, payload: dict):
        data = payload
        start = data.get("start_date")
        end   = data.get("end_date")
        files = data.get("files", []) or ALL_EXPORT_FILES

        try:
            zip_buffer = generate_gtfs_zip_export(
                scenario_id=scenario_id,
                start_date=start,
                end_date=end,
                include_files=files
            )
            zip_buffer.seek(0)
        except Exception as e:
            log_json(
                logger,
                logging.ERROR,
                "export_gtfs_generation_error",
                scenario_id=str(scenario_id),
                error=str(e)
            )
            return BaseResponse(
                data=None,
                message=ErrorMessages.GTFS_EXPORT_GENERATION_ERROR_JA,
                error=str(e),
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        resp = FileResponse(
            zip_buffer,
            content_type='application/zip',
            as_attachment=True,
            filename=f'gtfs_export_{scenario_id}.zip',
        )
        # Tell the browser exactly how many bytes to expect
        try:
            resp["Content-Length"] = zip_buffer.getbuffer().nbytes
        except Exception:
            pass

        # Optional but nice: prevent caching of one-off exports
        resp["Cache-Control"] = "no-store"
        return resp

    
    @staticmethod
    def edit_context(*, pk):
        scenario = (
            Scenario.objects
            .filter(id=pk)
            .first()
        )
        if not scenario:
            return BaseResponse(
                data=None,
                message=ErrorMessages.SCENARIO_NOT_FOUND_JA,
                error=ErrorMessages.SCENARIO_NOT_FOUND_JA,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        fi = FeedInfo.objects.filter(scenario=scenario).first()
        feed_info = None
        if fi:
            feed_info = {
                "publisher_url": fi.feed_publisher_url,
                "version": fi.feed_version,
                "language": fi.feed_lang,
                "publisher_name": fi.feed_publisher_name,
                "start_date": fi.feed_start_date,
                "end_date": fi.feed_end_date,
            }

        cal = list(
            Calendar.objects.filter(scenario=scenario)
            .values(
                "service_id",
                "monday","tuesday","wednesday","thursday","friday","saturday","sunday",
                "start_date","end_date",
            )
            .order_by("service_id")
        )

        cdates = list(
            CalendarDates.objects.filter(scenario=scenario)
            .values("service_id", "date", "exception_type")
            .order_by("service_id", "date")
        )

        data = {
            "scenario_name": scenario.scenario_name,
            "start_date": scenario.start_date,
            "end_date": scenario.end_date,
            "feed_info": feed_info,
            "calendar": cal,
            "calendar_dates": cdates,
        }
        return BaseResponse(
            data=data,
            message="編集用コンテキスト",
            error=None,
            status_code=status.HTTP_200_OK,
        )

@log_service_call
class ScenarioAPIService:

    @staticmethod
    def get_queryset(*, user):  # returns only current users scenarios
        return Scenario.objects.filter(
            user=user,
            deletion_state=ScenarioDeletionState.ACTIVE.value
        )

    @staticmethod
    def create(*, user, payload):
        serializer = ScenarioAPICreateRequestSerializer(data=payload)
        serializer.is_valid(raise_exception=True)

        org_id = serializer.validated_data.get('organization_id')
        feed_id = serializer.validated_data.get('feed_id')
        scenario_name = serializer.validated_data.get('scenario_name')
        gtfs_file_uid = serializer.validated_data.get('gtfs_file_uid')  

        try:
            Notification.objects.create(
                user=user,
                message=f"{scenario_name}のシナリオの作成を開始しました。完了するまでしばらくお待ちください。",
                notification_path="",
                scenario_id=None,
                screen_menu="GTFSデータインポート",
                is_read=False,
                description="message"
            )
        except Exception as e:
            log_json(
                logger,
                logging.WARNING,
                "scenario_api_create_notification_failed",
                scenario_name=scenario_name,
                user_id=str(user.id),
                error=str(e)
            )


        try:
            response = requests.get(
                f"https://api.gtfs-data.jp/v2/organizations/{org_id}/feeds/{feed_id}/files/feed.zip?uid={gtfs_file_uid}",
            )
            response.raise_for_status()
        except requests.exceptions.RequestException as e:
            log_json(
                logger,
                logging.ERROR,
                "scenario_api_gtfs_fetch_error",
                organization_id=str(org_id),
                feed_id=str(feed_id),
                gtfs_file_uid=str(gtfs_file_uid),
                error=str(e)
            )
            return BaseResponse(
                data=None,
                message=ErrorMessages.GTFS_DATA_FETCH_ERROR_JA,
                error={"source": "external", "message": str(e)},
                status_code=status.HTTP_400_BAD_REQUEST
            )

        gtfs_zip = ContentFile(response.content, name=f"{feed_id}.zip")
        import_response = ScenarioService.handle_scenario_import(
            scenario_name,
            gtfs_zip,
            user,
            SourceType.API.value,
            serializer.validated_data.get('start_date'),
            serializer.validated_data.get('end_date')
        )
        
        # Handle notification based on response status
        if import_response.status_code == status.HTTP_400_BAD_REQUEST:
            log_json(
                logger,
                logging.WARNING,
                "scenario_api_create_import_failed",
                scenario_name=scenario_name,
                user_id=str(user.id),
                error=str(import_response.data.get('error'))
            )
            # Error - create error notification with full validator response
            Notification.objects.create(
                user=user,
                message=f"{scenario_name}の作成中にエラーが発生しました。詳細をご確認ください。",
                notification_path="",
                scenario_id=None,  # Scenario was rolled back
                screen_menu="GTFSデータインポート",
                is_read=False,
                description="error",
                error_response=import_response.data.get('error') if hasattr(import_response, 'data') else None
            )

        elif import_response.status_code == status.HTTP_201_CREATED:
            # Success - get the created scenario
            scenario = Scenario.objects.filter(
                scenario_name=scenario_name,
                user=user
            ).order_by('-created_datetime').first()

            if scenario:
                # Create success notification
                try:
                    def _do():
                        Notification.objects.create(
                            user=user,
                            message=f"{scenario_name}のシナリオの作成が完了しました。",
                            notification_path="/scenario/" + str(scenario.id) +"?tab=validation",
                            scenario_id=str(scenario.id),
                            screen_menu="GTFSデータインポート",
                            is_read=False,
                            description="success"
                        )

                        # Handle translations if provided
                        translations = payload.get("translations", [])
                        if translations:
                            for t in translations:
                                tbl = t.get("table_name")
                                if not tbl:
                                    continue
                                entity_ids = {
                                    "route_id": t.get("route_id") or "",
                                    "trip_id": t.get("trip_id") or "",
                                    "service_id": t.get("service_id") or "",
                                    "stop_id": t.get("stop_id") or "",
                                    "shape_id": t.get("shape_id") or "",
                                    "feed_info_id": t.get("feed_info_id") or "",
                                }
                                upsert_translations(
                                    scenario_id = scenario.id,
                                    table_name = tbl,
                                    entity_ids = entity_ids,
                                    items = [{
                                        "field_name": t.get("field_name"),
                                        "language": t.get("language"),
                                        "translation": t.get("translation"),
                                        "field_value": t.get("field_value", ""),
                                        "record_id": t.get("record_id", ""),
                                        "record_sub_id": t.get("record_sub_id", ""),
                                    }],
                                )

                    transactional(_do)()
                except Exception as e:
                    log_json(
                        logger,
                        logging.WARNING,
                        "scenario_api_create_success_notification_failed",
                        scenario_name=scenario_name,
                        scenario_id=str(scenario.id),
                        user_id=str(user.id),
                        error=str(e)
                    )

        return import_response
