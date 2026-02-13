# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

import logging
from io import BytesIO
from typing import Any, Optional

from django.utils import timezone

from gtfs.constants import RidershipUploadStatus
from gtfs.models import Notification, RidershipRecord, RidershipUpload, RidershipUploadError, Scenario
from gtfs.services.base import log_service_call, transactional
from gtfs.services.ridership.core import RidershipRecordProcessor
from gtfs.services.ridership.errors import RidershipServiceError

logger = logging.getLogger(__name__)


@log_service_call
class RidershipUploadService:
    @staticmethod
    def upload(
        *,
        user,
        scenario_id: str,
        file_bytes: bytes,
        filename: str,
        file_size: int,
        ridership_record_name: str,
        description: str = "",
        validation_mode: str = "railway",
        max_tolerance_time: Any = None,
    ) -> tuple[dict[str, Any], int]:
        try:
            scenario = Scenario.objects.get(id=scenario_id)
        except Scenario.DoesNotExist as e:
            raise RidershipServiceError(
                message="シナリオが見つかりません",
                status_code=404,
                payload={"success": False, "message": "シナリオが見つかりません"},
            ) from e

        try:
            Notification.objects.create(
                user=user,
                message=f"{ridership_record_name}の一件明細データのアップロードを開始しました。完了するまでしばらくお待ちください。",
                notification_path="",
                scenario_id=scenario_id,
                screen_menu="一件明細データアップロード",
                is_read=False,
                description="message",
            )
        except Exception as e:
            logger.warning(f"Failed to create start notification: {e}")

        max_tolerance_time = RidershipUploadService._parse_positive_int(max_tolerance_time)

        file_name = filename.lower()
        if file_name.endswith(".csv"):
            file_type = "csv"
        elif file_name.endswith((".xlsx", ".xls")):
            file_type = "excel"
        else:
            return (
                {
                    "success": False,
                    "message": "サポートされていないファイル形式です。Excel (.xlsx, .xls) または CSV (.csv) ファイルを使用してください。",
                },
                400,
            )

        ridership_upload = RidershipUpload.objects.create(
            scenario=scenario,
            user=user,
            ridership_record_name=ridership_record_name,
            file_name=filename,
            file_size=file_size,
            description=description,
            upload_status=RidershipUploadStatus.PROCESSING.value,
            max_tolerance_time=max_tolerance_time,
        )

        try:
            uploaded_file = BytesIO(file_bytes)
            if file_type == "csv":
                processor, success_count, error_count = RidershipRecordProcessor.parse_csv(
                    scenario=scenario,
                    ridership_upload=ridership_upload,
                    file=uploaded_file,
                    validation_mode=validation_mode,
                    max_tolerance_time=max_tolerance_time,
                )
            else:
                processor, success_count, error_count = RidershipRecordProcessor.parse_excel(
                    scenario=scenario,
                    ridership_upload=ridership_upload,
                    file=uploaded_file,
                    validation_mode=validation_mode,
                    max_tolerance_time=max_tolerance_time,
                )

            RidershipUploadService._finalize_upload(
                processor=processor,
                ridership_upload=ridership_upload,
                success_count=success_count,
                error_count=error_count,
            )

            try:
                Notification.objects.create(
                    user=user,
                    message=f"{ridership_record_name}のアップロードが完了しました。",
                    notification_path="additional-data?tab=onedetailed",
                    scenario_id=scenario_id,
                    screen_menu="一件明細データアップロード",
                    is_read=False,
                    description="success",
                )
            except Exception as e:
                logger.warning(f"Failed to create success notification: {e}")

            response_data: dict[str, Any] = {
                "success": True,
                "message": RidershipUploadService._status_message(success_count, error_count),
                "data": {
                    "id": str(ridership_upload.id),
                    "scenario_id": str(ridership_upload.scenario_id),
                    "ridership_record_name": ridership_upload.ridership_record_name,
                    "file_name": ridership_upload.file_name,
                    "file_size": ridership_upload.file_size,
                    "upload_status": ridership_upload.upload_status,
                    "validation_mode": validation_mode,
                    "max_tolerance_time": max_tolerance_time,
                    "file_type": file_type,
                    "total_rows": ridership_upload.total_rows,
                    "success_rows": ridership_upload.success_rows,
                    "error_count": error_count,
                    "description": ridership_upload.description,
                    "uploaded_at": ridership_upload.uploaded_at.isoformat(),
                    "processed_at": ridership_upload.processed_at.isoformat() if ridership_upload.processed_at else None,
                },
            }

            if error_count > 0:
                errors = ridership_upload.errors.all()[:100]
                response_data["data"]["errors"] = [
                    {
                        "id": str(e.id),
                        "source_row_number": e.source_row_number,
                        "error_type": e.error_type,
                        "field_name": e.field_name,
                        "error_message": e.error_message,
                        "raw_data": e.raw_data,
                    }
                    for e in errors
                ]
                if error_count > 100:
                    response_data["data"]["errors_truncated"] = True
                    response_data["data"]["total_errors"] = error_count

            return response_data, 201

        except ValueError as e:
            ridership_upload.upload_status = RidershipUploadStatus.FAILED.value
            ridership_upload.processed_at = timezone.now()
            ridership_upload.save()
            return (
                {
                    "success": False,
                    "message": str(e),
                    "data": {
                        "id": str(ridership_upload.id),
                        "scenario_id": str(ridership_upload.scenario_id),
                        "upload_status": RidershipUploadStatus.FAILED.value,
                    },
                },
                400,
            )

        except Exception as e:
            logger.exception(f"Error processing ridership upload: {e}")

            ridership_upload.upload_status = RidershipUploadStatus.FAILED.value
            ridership_upload.processed_at = timezone.now()
            ridership_upload.save()

            try:
                Notification.objects.create(
                    user=user,
                    message=f"{ridership_record_name}のアップロード中にエラーが発生しました。詳細をご確認ください。",
                    notification_path="",
                    scenario_id=scenario_id,
                    screen_menu="一件明細データアップロード",
                    is_read=False,
                    description="error",
                    error_response={"error": str(e), "upload_id": str(ridership_upload.id)},
                )
            except Exception as notification_error:
                logger.warning(f"Failed to create error notification: {notification_error}")

            return (
                {
                    "success": False,
                    "message": f"ファイルの処理中にエラーが発生しました: {str(e)}",
                    "data": {
                        "id": str(ridership_upload.id),
                        "scenario_id": str(ridership_upload.scenario_id),
                        "upload_status": RidershipUploadStatus.FAILED.value,
                    },
                },
                500,
            )

    @staticmethod
    @transactional
    def _finalize_upload(
        *,
        processor: Any,
        ridership_upload: RidershipUpload,
        success_count: int,
        error_count: int,
    ) -> None:
        RidershipRecordProcessor.save_records(processor=processor)

        ridership_upload.total_rows = success_count + error_count
        ridership_upload.success_rows = success_count
        ridership_upload.processed_at = timezone.now()

        if error_count == 0:
            ridership_upload.upload_status = RidershipUploadStatus.COMPLETED.value
        elif success_count == 0:
            ridership_upload.upload_status = RidershipUploadStatus.FAILED.value
        else:
            ridership_upload.upload_status = RidershipUploadStatus.PARTIAL.value

        ridership_upload.save()

    @staticmethod
    def list_uploads(*, scenario_id: str, params: dict[str, Any]) -> dict[str, Any]:
        try:
            scenario = Scenario.objects.get(id=scenario_id)
        except Scenario.DoesNotExist as e:
            raise RidershipServiceError(
                message="シナリオが見つかりません",
                status_code=404,
                payload={"success": False, "message": "シナリオが見つかりません"},
            ) from e

        uploads = RidershipUpload.objects.filter(scenario=scenario)

        status_filter = params.get("status", None)
        if status_filter:
            status_list = [s.strip() for s in status_filter.split(",")]
            valid_statuses = [
                RidershipUploadStatus.PROCESSING.value,
                RidershipUploadStatus.COMPLETED.value,
                RidershipUploadStatus.PARTIAL.value,
                RidershipUploadStatus.FAILED.value,
            ]
            status_list = [s for s in status_list if s in valid_statuses]
            if status_list:
                uploads = uploads.filter(upload_status__in=status_list)

        uploads = uploads.order_by("-uploaded_at")

        page = int(params.get("page", 1))
        page_size = int(params.get("page_size", 20))
        start = (page - 1) * page_size
        end = start + page_size

        total_count = uploads.count()
        uploads_page = uploads[start:end]

        data = [
            {
                "id": str(upload.id),
                "scenario_id": str(upload.scenario_id),
                "ridership_record_name": upload.ridership_record_name,
                "file_name": upload.file_name,
                "file_size": upload.file_size,
                "upload_status": upload.upload_status,
                "total_rows": upload.total_rows,
                "success_rows": upload.success_rows,
                "error_count": upload.errors.count(),
                "description": upload.description,
                "uploaded_at": upload.uploaded_at.isoformat(),
                "processed_at": upload.processed_at.isoformat() if upload.processed_at else None,
                "max_tolerance_time": upload.max_tolerance_time,
            }
            for upload in uploads_page
        ]

        return {
            "success": True,
            "data": data,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_count": total_count,
                "total_pages": (total_count + page_size - 1) // page_size,
            },
        }

    @staticmethod
    def upload_detail(*, scenario_id: str, upload_id: str, params: dict[str, Any]) -> dict[str, Any]:
        try:
            scenario = Scenario.objects.get(id=scenario_id)
        except Scenario.DoesNotExist as e:
            raise RidershipServiceError(
                message="シナリオが見つかりません",
                status_code=404,
                payload={"success": False, "message": "シナリオが見つかりません"},
            ) from e

        try:
            upload = RidershipUpload.objects.get(id=upload_id, scenario=scenario)
        except RidershipUpload.DoesNotExist as e:
            raise RidershipServiceError(
                message="アップロードが見つかりません",
                status_code=404,
                payload={"success": False, "message": "アップロードが見つかりません"},
            ) from e

        details_page = int(params.get("details_page", 1))
        details_page_size = min(int(params.get("details_page_size", 50)), 100)
        error_type_filter = params.get("error_type", None)
        field_name_filter = params.get("field_name", None)

        all_errors = upload.errors.all()
        total_errors = all_errors.count()

        from django.db.models import Count

        error_group_counts = (
            all_errors.values("error_type", "field_name").annotate(count=Count("id")).order_by("-count")
        )

        field_display_names = {
            "ic_card_agency_identification_code": "ICカード識別コード",
            "ridership_record_id": "乗降実績ID",
            "boarding_station_code": "乗車駅(停留所)コード",
            "boarding_station_name": "乗車駅(停留所)名",
            "alighting_station_code": "降車駅(停留所)コード",
            "alighting_station_name": "降車駅(停留所)名",
            "boarding_at": "乗車日時",
            "alighting_at": "降車日時",
            "payment_at": "精算日時",
            "serviced_office_code": "営業所コード",
            "route_pattern_number": "系統番号",
            "adult_passenger_count": "大人利用者数",
            "child_passenger_count": "小児利用者数",
            "boarding_station_code/boarding_station_name": "乗車駅(停留所)",
            "alighting_station_code/alighting_station_name": "降車駅(停留所)",
        }

        error_summary: list[dict[str, Any]] = []
        for group in error_group_counts:
            error_type = group["error_type"]
            field_name = group["field_name"] or ""
            error_count = group["count"]
            group_key = f"{error_type}:{field_name}"

            group_errors_qs = all_errors.filter(error_type=error_type, field_name=field_name).order_by(
                "source_row_number"
            )

            all_row_numbers = list(group_errors_qs.values_list("source_row_number", flat=True))
            sample_error = group_errors_qs.first()
            sample_message = sample_error.error_message if sample_error else ""

            is_filtered_group = error_type_filter == error_type and field_name_filter == field_name
            include_details = (error_type_filter is None and field_name_filter is None) or is_filtered_group

            if include_details:
                if is_filtered_group:
                    details_start = (details_page - 1) * details_page_size
                    details_end = details_start + details_page_size
                else:
                    details_start = 0
                    details_end = details_page_size

                details_slice = group_errors_qs[details_start:details_end]
                details = [
                    {
                        "id": str(e.id),
                        "source_row_number": e.source_row_number,
                        "error_message": e.error_message,
                        "raw_data": e.raw_data,
                    }
                    for e in details_slice
                ]
                total_details_pages = (error_count + details_page_size - 1) // details_page_size if error_count > 0 else 0
            else:
                details = []
                total_details_pages = 0

            error_summary.append(
                {
                    "error_type": error_type,
                    "error_type_display": (
                        dict(RidershipUploadError._meta.get_field("error_type").choices).get(error_type, error_type)
                        if hasattr(RidershipUploadError, "_meta")
                        else error_type
                    ),
                    "field_name": field_name,
                    "field_display_name": field_display_names.get(field_name, field_name),
                    "group_key": group_key,
                    "total_count": error_count,
                    "affected_rows": all_row_numbers[:50],
                    "affected_rows_truncated": len(all_row_numbers) > 50,
                    "sample_message": sample_message,
                    "details": details,
                    "details_truncated": error_count > len(details),
                    "details_pagination": (
                        {
                            "page": details_page if is_filtered_group else 1,
                            "page_size": details_page_size,
                            "total_count": error_count,
                            "total_pages": total_details_pages,
                        }
                        if include_details
                        else None
                    ),
                }
            )

        return {
            "success": True,
            "data": {
                "id": str(upload.id),
                "scenario_id": str(upload.scenario_id),
                "ridership_record_name": upload.ridership_record_name,
                "file_name": upload.file_name,
                "file_size": upload.file_size,
                "upload_status": upload.upload_status,
                "total_rows": upload.total_rows,
                "success_rows": upload.success_rows,
                "total_error_count": total_errors,
                "error_group_count": len(error_summary),
                "description": upload.description,
                "uploaded_at": upload.uploaded_at.isoformat(),
                "processed_at": upload.processed_at.isoformat() if upload.processed_at else None,
                "error_summary": error_summary,
            },
        }

    @staticmethod
    def delete_upload(*, scenario_id: str, upload_id: str) -> dict[str, Any]:
        try:
            scenario = Scenario.objects.get(id=scenario_id)
        except Scenario.DoesNotExist as e:
            raise RidershipServiceError(
                message="シナリオが見つかりません",
                status_code=404,
                payload={"success": False, "message": "シナリオが見つかりません"},
            ) from e

        try:
            upload = RidershipUpload.objects.get(id=upload_id, scenario=scenario)
        except RidershipUpload.DoesNotExist as e:
            raise RidershipServiceError(
                message="アップロードが見つかりません",
                status_code=404,
                payload={"success": False, "message": "アップロードが見つかりません"},
            ) from e

        upload_name = upload.ridership_record_name
        upload.delete()
        return {"success": True, "message": f"アップロード「{upload_name}」が削除されました"}

    @staticmethod
    def list_records(*, scenario_id: str, params: dict[str, Any]) -> dict[str, Any]:
        try:
            scenario = Scenario.objects.get(id=scenario_id)
        except Scenario.DoesNotExist as e:
            raise RidershipServiceError(
                message="シナリオが見つかりません",
                status_code=404,
                payload={"success": False, "message": "シナリオが見つかりません"},
            ) from e

        records = RidershipRecord.objects.filter(scenario=scenario)

        upload_id = params.get("upload_id")
        if upload_id:
            records = records.filter(ridership_upload_id=upload_id)

        start_date = params.get("start_date")
        end_date = params.get("end_date")
        if start_date:
            records = records.filter(payment_at__date__gte=start_date)
        if end_date:
            records = records.filter(payment_at__date__lte=end_date)

        boarding_station = params.get("boarding_station")
        alighting_station = params.get("alighting_station")
        if boarding_station:
            records = records.filter(boarding_station_code__icontains=boarding_station)
        if alighting_station:
            records = records.filter(alighting_station_code__icontains=alighting_station)

        order_by = params.get("order_by", "ridership_record_id")
        records = records.order_by(order_by)

        page = int(params.get("page", 1))
        page_size = int(params.get("page_size", 50))
        start = (page - 1) * page_size
        end = start + page_size

        total_count = records.count()
        records_page = records[start:end]

        data = [
            {
                "id": record.id,
                "ridership_upload_id": str(record.ridership_upload_id) if record.ridership_upload_id else None,
                "source_row_number": record.source_row_number,
                "ridership_record_id": record.ridership_record_id,
                "ic_card_agency_identification_code": record.ic_card_agency_identification_code,
                "boarding_station_code": record.boarding_station_code,
                "boarding_station_name": record.boarding_station_name,
                "alighting_station_code": record.alighting_station_code,
                "alighting_station_name": record.alighting_station_name,
                "boarding_at": record.boarding_at.isoformat() if record.boarding_at else None,
                "alighting_at": record.alighting_at.isoformat() if record.alighting_at else None,
                "payment_at": record.payment_at.isoformat() if record.payment_at else None,
                "route_id": record.route_id,
                "route_name": record.route_name,
                "trip_code": record.trip_code,
                "adult_passenger_count": record.adult_passenger_count,
                "child_passenger_count": record.child_passenger_count,
            }
            for record in records_page
        ]

        return {
            "success": True,
            "data": data,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_count": total_count,
                "total_pages": (total_count + page_size - 1) // page_size,
            },
        }

    @staticmethod
    def list_all_uploads(*, user, params: dict[str, Any]) -> dict[str, Any]:
        user_scenarios = Scenario.objects.filter(user=user).values_list("id", flat=True)
        uploads = RidershipUpload.objects.filter(scenario_id__in=user_scenarios)

        scenario_filter = params.get("scenario_id", None)
        if scenario_filter:
            uploads = uploads.filter(scenario_id=scenario_filter)

        status_filter = params.get("status", None)
        if status_filter:
            status_list = [s.strip() for s in status_filter.split(",")]
            valid_statuses = [
                RidershipUploadStatus.PROCESSING.value,
                RidershipUploadStatus.COMPLETED.value,
                RidershipUploadStatus.PARTIAL.value,
                RidershipUploadStatus.FAILED.value,
            ]
            status_list = [s for s in status_list if s in valid_statuses]
            if status_list:
                uploads = uploads.filter(upload_status__in=status_list)

        uploads = uploads.order_by("-uploaded_at")

        page = int(params.get("page", 1))
        page_size = int(params.get("page_size", 20))
        start = (page - 1) * page_size
        end = start + page_size

        total_count = uploads.count()
        uploads_page = uploads[start:end]

        data = [
            {
                "id": str(upload.id),
                "scenario_id": str(upload.scenario_id),
                "ridership_record_name": upload.ridership_record_name,
                "file_name": upload.file_name,
                "file_size": upload.file_size,
                "upload_status": upload.upload_status,
                "total_rows": upload.total_rows,
                "success_rows": upload.success_rows,
                "error_count": upload.errors.count(),
                "description": upload.description,
                "uploaded_at": upload.uploaded_at.isoformat(),
                "processed_at": upload.processed_at.isoformat() if upload.processed_at else None,
            }
            for upload in uploads_page
        ]

        return {
            "success": True,
            "data": data,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_count": total_count,
                "total_pages": (total_count + page_size - 1) // page_size,
            },
        }

    @staticmethod
    def _parse_positive_int(value: Any) -> Optional[int]:
        if value is None or value == "":
            return None
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            return None
        return parsed if parsed > 0 else None

    @staticmethod
    def _status_message(success_count: int, error_count: int) -> str:
        if error_count == 0:
            return f"{success_count}件のレコードが正常にインポートされました"
        if success_count == 0:
            return f"すべての{error_count}件のレコードでエラーが発生しました"
        return f"{success_count}件のレコードがインポートされ、{error_count}件のエラーが発生しました"
