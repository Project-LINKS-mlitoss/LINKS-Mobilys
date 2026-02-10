from rest_framework import viewsets, status
from django.db.models import Exists, OuterRef
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError as DRFValidationError

from mobilys_BE.shared.response import BaseResponse
from simulation.models import Simulation, SimulationInput
from simulation.serializers.simulation_serializers import SimulationSerializer
from simulation.serializers.response import SimulationResponseSerializer
from simulation.services import (
    SimulationResponseService,
    SimulationService,
    ValidationError as ServiceValidationError,
)
from simulation.services.project_scope import ensure_project_scope
from simulation.constants.errors import ErrorMessages


class SimulationViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = SimulationSerializer
    queryset = (
        Simulation.objects
        .select_related("original_scenario", "duplicated_scenario", "user")
        .annotate(
            _has_run=Exists(
                SimulationInput.objects.filter(simulation=OuterRef("pk"))
            )
        )
        .order_by("-created_at")
    )

    def _flatten_errors(self, detail):
        if isinstance(detail, dict):
            for v in detail.values():
                msg = self._flatten_errors(v)
                if msg:
                    return msg
        elif isinstance(detail, list):
            for v in detail:
                msg = self._flatten_errors(v)
                if msg:
                    return msg
        elif detail:
            return str(detail)
        return ErrorMessages.VALIDATION_ERROR

    def handle_exception(self, exc):
        response = super().handle_exception(exc)
        if response is None:
            return response
        message = self._flatten_errors(getattr(response, "data", None))
        return BaseResponse(
            data=None,
            message=message,
            status_code=response.status_code,
        )

    def get_queryset(self):
        scope = ensure_project_scope(self.request)
        return self.queryset.filter(
            user_id__in=scope.user_ids,
            user__is_active=True,
        )

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        project_id_raw = request.query_params.get("project_id")
        page = self.paginate_queryset(qs)
        items = page if page is not None else qs
        SimulationResponseService.attach_response_fields(
            items,
            current_user_id=getattr(request.user, "id", None),
            project_id=project_id_raw,
        )
        return BaseResponse.success(
            data=SimulationResponseSerializer(items, many=True).data,
            message="",
            status_code=status.HTTP_200_OK,
        )

    def retrieve(self, request, *args, **kwargs):
        simulation = self.get_object()
        project_id_raw = request.query_params.get("project_id")
        SimulationResponseService.attach_response_fields(
            simulation,
            current_user_id=getattr(request.user, "id", None),
            project_id=project_id_raw,
        )
        return BaseResponse.success(
            data=SimulationResponseSerializer(simulation).data,
            message="",
            status_code=status.HTTP_200_OK,
        )

    def create(self, request, *args, **kwargs):
        request_serializer = SimulationSerializer(data=request.data, context={"request": request})
        try:
            request_serializer.is_valid(raise_exception=True)
        except DRFValidationError as e:
            return BaseResponse(
                data=None,
                message=self._flatten_errors(e.detail),
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        validated = request_serializer.validated_data
        project_id_raw = request.data.get("project_id") or request.query_params.get("project_id")
        try:
            SimulationService.validate_name_unique(
                request=request,
                name=validated.get("name"),
                exclude_simulation_id=None,
                project_id_raw=project_id_raw,
            )
        except ServiceValidationError as e:
            return BaseResponse(
                data=None,
                message=str(e.message or ErrorMessages.VALIDATION_ERROR),
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        original = validated.get("original_scenario")
        duplicated = validated.get("duplicated_scenario")
        simulation = SimulationService.create_simulation(
            name=validated.get("name"),
            original_scenario_id=getattr(original, "id", None),
            duplicated_scenario_id=getattr(duplicated, "id", None),
            owner_id=request.user.id,
        )

        SimulationResponseService.attach_response_fields(
            simulation,
            current_user_id=getattr(request.user, "id", None),
            project_id=project_id_raw,
        )
        return BaseResponse.success(
            data=SimulationResponseSerializer(simulation).data,
            message="",
            status_code=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        request_serializer = SimulationSerializer(
            instance, data=request.data, partial=partial, context={"request": request}
        )
        try:
            request_serializer.is_valid(raise_exception=True)
        except DRFValidationError as e:
            return BaseResponse(
                data=None,
                message=self._flatten_errors(e.detail),
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        validated = request_serializer.validated_data
        project_id_raw = request.data.get("project_id") or request.query_params.get("project_id")
        if "name" in validated:
            try:
                SimulationService.validate_name_unique(
                    request=request,
                    name=validated.get("name"),
                    exclude_simulation_id=str(instance.pk),
                    project_id_raw=project_id_raw,
                )
            except ServiceValidationError as e:
                return BaseResponse(
                    data=None,
                    message=str(e.message or ErrorMessages.VALIDATION_ERROR),
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
        original = validated.get("original_scenario")
        duplicated = validated.get("duplicated_scenario")
        simulation = SimulationService.update_simulation(
            simulation=instance,
            name=validated.get("name", None),
            original_scenario_id=getattr(original, "id", None) if original is not None else None,
            duplicated_scenario_id=getattr(duplicated, "id", None) if duplicated is not None else None,
        )

        SimulationResponseService.attach_response_fields(
            simulation,
            current_user_id=getattr(request.user, "id", None),
            project_id=project_id_raw,
        )
        return BaseResponse.success(
            data=SimulationResponseSerializer(simulation).data,
            message="",
            status_code=status.HTTP_200_OK,
        )

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        simulation = self.get_object()
        SimulationService.delete_simulation(simulation)
        return BaseResponse.success(
            data=None,
            message="",
            status_code=status.HTTP_204_NO_CONTENT,
        )
