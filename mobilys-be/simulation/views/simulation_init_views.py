# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import logging

from rest_framework import status as http_status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.views import APIView

from mobilys_BE.shared.log_json import log_json
from mobilys_BE.shared.response import BaseResponse
from simulation.serializers.request.simulation_init_request import (
    SimulationInitCreateRequestSerializer,
    SimulationInitDiffRequestSerializer,
    SimulationInitGetRequestSerializer,
    SimulationUnionServiceIdsRequestSerializer,
    ValidateAndSaveCSVRequestSerializer,
)
from simulation.serializers.response.simulation_init_response import (
    SimulationInitCreateResponseSerializer,
    SimulationInitDiffResponseSerializer,
    SimulationInitGetResponseSerializer,
    SimulationUnionServiceIdsResponseSerializer,
    ValidateAndSaveCSVResponseSerializer,
    ValidationResultDeleteResponseSerializer,
)
from simulation.serializers.simulation_serializers import SimulationValidationResultSerializer
from simulation.services import (
    NotFoundError,
    SimulationInitApiService,
    ValidationError,
    ValidationService,
)
from simulation.constants.errors import ErrorMessages

logger = logging.getLogger(__name__)
def _safe_request_data(request) -> dict:
    """
    Avoid `request.data.copy()` for multipart requests because it may deep-copy
    UploadedFile objects (can raise "cannot pickle BufferedRandom").
    """
    try:
        return {k: request.data.get(k) for k in request.data.keys()}
    except Exception:
        return dict(request.data)
    
class SimulationInitAPIView(APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        request_serializer = SimulationInitGetRequestSerializer(data=request.query_params)
        if not request_serializer.is_valid():
            if "simulation_id" in request_serializer.errors:
                return BaseResponse.bad_request(
                    message=ErrorMessages.SIM_INIT_MISSING_SIMULATION_ID_PARAM,
                    error="missing_simulation_id",
                )
            return BaseResponse.bad_request(
                message=ErrorMessages.VALIDATION_ERROR,
                error=request_serializer.errors,
            )

        simulation_id = request_serializer.validated_data.get("simulation_id")
        try:
            payload = SimulationInitApiService.get_latest_init_payload(
                simulation_id=str(simulation_id)
            )
        except NotFoundError as e:
            if e.code == "simulation_not_found":
                return BaseResponse.not_found(
                    message=ErrorMessages.SIM_INIT_SIMULATION_NOT_FOUND,
                    error="simulation_not_found",
                )
            return BaseResponse.not_found(
                message=ErrorMessages.SIM_INIT_INITIAL_DATA_NOT_FOUND,
                error="not_found",
            )

        response_serializer = SimulationInitGetResponseSerializer(payload)
        return BaseResponse.success(
            data=response_serializer.data,
            message="初期データを取得しました",
        )

    def post(self, request):
        request_serializer = SimulationInitCreateRequestSerializer(data=request.data)
        if not request_serializer.is_valid():
            if "simulation_id" in request_serializer.errors:
                return BaseResponse.bad_request(
                    message=ErrorMessages.SIM_INIT_MISSING_SIMULATION_ID,
                    error="missing_simulation_id",
                )
            return BaseResponse.bad_request(
                message=ErrorMessages.VALIDATION_ERROR,
                error=request_serializer.errors,
            )

        sim_id_for_log = request_serializer.validated_data.get("simulation_id")
        file_obj = request_serializer.validated_data.get("file") or request.FILES.get("file")

        try:
            payload, _simulation_id = SimulationInitApiService.create_init_payload(
                data=request.data,
                file_obj=file_obj,
            )
        except NotFoundError:
            return BaseResponse.not_found(
                message=ErrorMessages.SIM_INIT_SIMULATION_NOT_FOUND,
                error="simulation_not_found",
            )
        except ValidationError as e:
            if e.code == "missing_simulation_id":
                return BaseResponse.bad_request(
                    message=ErrorMessages.SIM_INIT_MISSING_SIMULATION_ID,
                    error="missing_simulation_id",
                )
            if e.code == "invalid_service_date":
                return BaseResponse.bad_request(
                    message=ErrorMessages.SIM_INIT_INVALID_SERVICE_DATE,
                    error="invalid_service_date",
                )
            if e.code == "missing_service_id":
                return BaseResponse.bad_request(
                    message=ErrorMessages.SIM_INIT_MISSING_SERVICE_ID,
                    error="missing_service_id",
                )
            if e.code == "missing_numeric_field":
                field_names = (e.details or {}).get("field_names") or ""
                return BaseResponse.bad_request(
                    message=ErrorMessages.SIM_INIT_MISSING_NUMERIC_FIELD.format(
                        field_names=field_names
                    ),
                    error="missing_numeric_field",
                )
            if e.code == "invalid_numeric":
                message = e.message or ErrorMessages.SIM_INIT_INVALID_NUMERIC
                return BaseResponse.bad_request(
                    message=message,
                    error="invalid_numeric",
                )
            if e.code == "invalid_csv":
                return BaseResponse.bad_request(
                    message=e.message,
                    error="invalid_csv",
                )
            if e.code == "csv_parse_error":
                log_json(
                    logger,
                    logging.ERROR,
                    "ic_csv_validation_failed",
                    simulation_id=str(sim_id_for_log or ""),
                )
                return BaseResponse.bad_request(
                    message=ErrorMessages.SIM_INIT_CSV_PARSE_ERROR,
                    error="csv_parse_error",
                )
            if e.code == "already_exists":
                log_json(
                    logger,
                    logging.ERROR,
                    "simulation_init_already_exists",
                    simulation_id=str(sim_id_for_log or ""),
                    error=str(e),
                )
                return BaseResponse.error(
                    message=ErrorMessages.SIM_INIT_ALREADY_EXISTS,
                    error="already_exists",
                    status_code=http_status.HTTP_409_CONFLICT,
                )
            if e.code == "invalid_service_id_for_date":
                invalid = (e.details or {}).get("invalid") or []
                return BaseResponse.bad_request(
                    message=ErrorMessages.SIM_INIT_INVALID_SERVICE_ID_FOR_DATE.format(
                        invalid=", ".join(invalid)
                    ),
                    error="invalid_service_id_for_date",
                )
            if e.code == "no_different_data":
                log_json(
                    logger,
                    logging.WARNING,
                    "simulation_init_no_different_data",
                    simulation_id=str(sim_id_for_log or ""),
                    error=str(e),
                )
                return BaseResponse.bad_request(
                    message=ErrorMessages.SIM_INIT_NO_DIFFERENT_DATA,
                    error="no_different_data",
                )

            log_json(
                logger,
                logging.ERROR,
                "simulation_init_failed",
                simulation_id=str(sim_id_for_log or ""),
                error=str(e),
            )
            return BaseResponse.internal_error(
                message=ErrorMessages.SIM_INIT_INTERNAL_ERROR,
                error="internal_error",
            )
        except Exception:
            log_json(
                logger,
                logging.ERROR,
                "simulation_init_failed",
                simulation_id=str(sim_id_for_log or ""),
            )
            return BaseResponse.internal_error(
                message=ErrorMessages.SIM_INIT_INTERNAL_ERROR,
                error="internal_error",
            )

        response_serializer = SimulationInitCreateResponseSerializer(payload)
        return BaseResponse.success(
            data=response_serializer.data,
            message="保存しました",
            status_code=http_status.HTTP_201_CREATED,
        )


class SimulationInitDiffAPIView(APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        request_data = _safe_request_data(request)
        if not request_data.get("simulation_id"):
            sim_id = request.query_params.get("simulation_id") or request.query_params.get("simulationId")
            if sim_id:
                request_data["simulation_id"] = sim_id

        request_serializer = SimulationInitDiffRequestSerializer(data=request_data)
        if not request_serializer.is_valid():
            if "simulation_id" in request_serializer.errors:
                return BaseResponse.bad_request(
                    message=ErrorMessages.SIM_INIT_MISSING_SIMULATION_ID_PARAM,
                    error="missing_simulation_id",
                )
            if "file" in request_serializer.errors:
                return BaseResponse.bad_request(
                    message=ErrorMessages.SIM_INIT_MISSING_FILE,
                    error="missing_file",
                )
            return BaseResponse.bad_request(
                message=ErrorMessages.VALIDATION_ERROR,
                error=request_serializer.errors,
            )

        simulation_id = request_serializer.validated_data.get("simulation_id")
        uploaded_file = request_serializer.validated_data.get("file")

        try:
            analysis, message = SimulationInitApiService.diff_csv_against_simulation(
                simulation_id=str(simulation_id),
                file_obj=uploaded_file,
            )
        except NotFoundError:
            return BaseResponse.not_found(
                message=ErrorMessages.SIM_INIT_SIMULATION_NOT_FOUND,
                error="simulation_not_found",
            )
        except ValidationError as e:
            if e.code == "missing_scenarios":
                return BaseResponse.bad_request(
                    message=ErrorMessages.SIM_INIT_MISSING_SCENARIOS,
                    error="missing_scenarios",
                )
            if e.code == "missing_file":
                return BaseResponse.bad_request(
                    message=ErrorMessages.SIM_INIT_MISSING_FILE,
                    error="missing_file",
                )
            if e.code == "invalid_csv":
                log_json(
                    logger,
                    logging.ERROR,
                    "ic_csv_validation_failed_on_diff_api",
                    simulation_id=str(simulation_id),
                    error=str(e),
                )
                return BaseResponse.bad_request(
                    message=e.message,
                    error="invalid_csv",
                )
            if e.code == "csv_parse_error":
                log_json(
                    logger,
                    logging.ERROR,
                    "ic_csv_validation_failed_on_diff_api",
                    simulation_id=str(simulation_id),
                )
                return BaseResponse.bad_request(
                    message=ErrorMessages.SIM_INIT_CSV_PARSE_ERROR,
                    error="csv_parse_error",
                )
            raise

        response_serializer = SimulationInitDiffResponseSerializer(analysis)
        return BaseResponse.success(
            data=response_serializer.data,
            message=message,
        )


class SimulationUnionServiceIdsAPIView(APIView):
    def get(self, request):
        request_serializer = SimulationUnionServiceIdsRequestSerializer(data=request.query_params)
        if not request_serializer.is_valid():
            if "simulation_id" in request_serializer.errors:
                return BaseResponse.bad_request(
                    message=ErrorMessages.SIM_INIT_MISSING_SIMULATION_ID_PARAM,
                    error="missing_simulation_id",
                )
            if "date" in request_serializer.errors:
                return BaseResponse.bad_request(
                    message=ErrorMessages.SIM_INIT_INVALID_DATE,
                    error="invalid_date",
                )
            return BaseResponse.bad_request(
                message=ErrorMessages.VALIDATION_ERROR,
                error=request_serializer.errors,
            )

        date_str = (request_serializer.validated_data.get("date") or "").strip()
        simulation_id = request_serializer.validated_data.get("simulation_id")

        try:
            union_services = SimulationInitApiService.union_service_ids(
                simulation_id=str(simulation_id),
                date_str=date_str,
            )
        except NotFoundError as e:
            if e.code == "simulation_not_found":
                return BaseResponse.not_found(
                    message=ErrorMessages.SIM_INIT_SIMULATION_NOT_FOUND,
                    error="simulation_not_found",
                )
            if e.code == "scenario_not_found":
                return BaseResponse.not_found(
                    message=ErrorMessages.SIM_INIT_SCENARIO_NOT_FOUND,
                    error="scenario_not_found",
                )
            raise
        except ValidationError as e:
            if e.code == "invalid_date":
                return BaseResponse.bad_request(
                    message=ErrorMessages.SIM_INIT_INVALID_DATE,
                    error="invalid_date",
                )
            if e.code == "no_scenarios":
                return BaseResponse.bad_request(
                    message=ErrorMessages.SIM_INIT_NO_SCENARIOS,
                    error="no_scenarios",
                )
            raise

        response_serializer = SimulationUnionServiceIdsResponseSerializer(union_services)
        return BaseResponse.success(
            data=response_serializer.data,
            message="サービスIDの取得に成功しました",
        )


class ValidateAndSaveCSVView(APIView):
    """
    POST /api/simulation/<simulation_id>/validation/validate-and-save/
    form-data: file=<csv>
    """

    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, simulation_id):
        request_data = _safe_request_data(request)
        request_serializer = ValidateAndSaveCSVRequestSerializer(data=request_data)
        if not request_serializer.is_valid():
            if "file" in request_serializer.errors:
                log_json(
                    logger,
                    logging.ERROR,
                    "validate_and_save_csv_missing_file",
                    simulation_id=str(simulation_id),
                )
                return BaseResponse.bad_request(
                    message=ErrorMessages.FILE_IS_REQUIRED,
                )
            return BaseResponse.bad_request(
                message=ErrorMessages.VALIDATION_ERROR,
                error=request_serializer.errors,
            )

        file_obj = request_serializer.validated_data.get("file")
        if not file_obj:
            log_json(
                logger,
                logging.ERROR,
                "validate_and_save_csv_missing_file",
                simulation_id=str(simulation_id),
            )
            return BaseResponse.bad_request(
                message=ErrorMessages.FILE_IS_REQUIRED,
            )

        simulation_input_id = request_serializer.validated_data.get("simulation_input_id")

        try:
            payload = SimulationInitApiService.validate_and_save_csv_payload(
                simulation_id=str(simulation_id),
                simulation_input_id=simulation_input_id,
                file_obj=file_obj,
            )
        except NotFoundError:
            return BaseResponse.not_found(
                message=ErrorMessages.SIM_INIT_SIMULATION_NOT_FOUND,
                error="simulation_not_found",
            )
        except ValidationError as e:
            code = e.code or ""
            err = (e.details or {}).get("exception") or ""

            if code == "invalid_simulation_input_id":
                log_json(
                    logger,
                    logging.WARNING,
                    "validate_and_save_csv_invalid_simulation_input_id",
                    simulation_id=str(simulation_id),
                )
                return BaseResponse.bad_request(
                    message=ErrorMessages.SIM_INIT_INVALID_SIMULATION_INPUT_ID,
                )

            if code == "csv_processing_error":
                log_json(
                    logger,
                    logging.ERROR,
                    "validate_and_save_csv_processing_error",
                    simulation_id=str(simulation_id),
                    error=err,
                )
                message = ErrorMessages.SIM_INIT_CSV_PROCESSING_ERROR.format(err=err)
            elif code == "fetch_previous_error":
                log_json(
                    logger,
                    logging.ERROR,
                    "validate_and_save_csv_fetch_previous_error",
                    simulation_id=str(simulation_id),
                    error=err,
                )
                message = ErrorMessages.SIM_INIT_FETCH_PREVIOUS_ERROR.format(err=err)
            elif code == "save_error":
                log_json(
                    logger,
                    logging.ERROR,
                    "validate_and_save_csv_save_error",
                    simulation_id=str(simulation_id),
                    error=err,
                )
                message = ErrorMessages.SIM_INIT_SAVE_ERROR.format(err=err)
            else:
                log_json(
                    logger,
                    logging.ERROR,
                    "validate_and_save_csv_processing_error",
                    simulation_id=str(simulation_id),
                    error=err,
                )
                message = ErrorMessages.SIM_INIT_CSV_PROCESSING_ERROR.format(err=err)

            return BaseResponse.bad_request(
                message=message,
            )

        response_serializer = ValidateAndSaveCSVResponseSerializer(payload)
        return BaseResponse.success(
            data=response_serializer.data,
            message="CSV の検証と保存に成功しました",
        )


class GetLatestValidationResultView(APIView):
    """GET /api/simulation/<simulation_id>/validation-result/"""

    def get(self, request, simulation_id):
        svr = ValidationService.get_latest_validation_result(simulation_id=str(simulation_id))
        if not svr:
            return BaseResponse.not_found(
                message=ErrorMessages.NOT_FOUND,
            )

        response_serializer = SimulationValidationResultSerializer(svr)
        return BaseResponse.success(
            data=response_serializer.data,
            message="",
        )

    def delete(self, request, simulation_id):
        deleted_count = ValidationService.delete_validation_results(simulation_id=str(simulation_id))
        response_serializer = ValidationResultDeleteResponseSerializer({"deleted": deleted_count})
        return BaseResponse.success(
            data=response_serializer.data,
            message="",
        )
