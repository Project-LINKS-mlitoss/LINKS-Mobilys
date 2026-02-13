# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from typing import Iterable, Optional, Union
from simulation.models import Simulation, SimulationInput
from simulation.services.base import NotFoundError, ValidationError, log_service_call, transactional
from simulation.services.project_scope import resolve_project_scope


class SimulationService:
    @staticmethod
    @log_service_call
    def find_simulation(
        simulation_id: str,
        *,
        select_related: Optional[Iterable[str]] = None,
        for_update: bool = False,
    ) -> Optional[Simulation]:
        qs = Simulation.objects
        if select_related:
            qs = qs.select_related(*select_related)
        if for_update:
            qs = qs.select_for_update()
        return qs.filter(pk=simulation_id).first()

    @staticmethod
    @log_service_call
    def get_simulation(
        simulation_id: str,
        *,
        select_related: Optional[Iterable[str]] = None,
        for_update: bool = False,
        not_found_message: str = "Simulation not found",
        not_found_code: Optional[str] = None,
        not_found_details: Optional[dict] = None,
    ) -> Simulation:
        sim = SimulationService.find_simulation(
            simulation_id,
            select_related=select_related,
            for_update=for_update,
        )
        if not sim:
            raise NotFoundError(
                message=not_found_message,
                code=not_found_code,
                details=not_found_details,
            )
        return sim

    @staticmethod
    @log_service_call
    def validate_name_unique(
        *,
        request,
        name: str,
        exclude_simulation_id: Optional[str] = None,
        project_id_raw: Optional[str] = None,
    ) -> None:
        if not request or not getattr(request, "user", None) or not request.user.is_authenticated:
            return

        scope, error = resolve_project_scope(request, project_id_raw=project_id_raw)
        if error:
            msg = None
            try:
                msg = (error.data or {}).get("message")
            except Exception:
                msg = None
            raise ValidationError(
                message=msg or "プロジェクトの検証に失敗しました。",
                code="invalid_project_scope",
            )

        qs = Simulation.objects.filter(
            original_scenario__user_id__in=scope.user_ids,
            original_scenario__user__is_active=True,
            name=name,
        )
        if exclude_simulation_id:
            qs = qs.exclude(pk=exclude_simulation_id)

        if qs.exists():
            raise ValidationError(
                message="同じ名前のシミュレーションが既に存在します。",
                code="duplicate_name",
            )

    @staticmethod
    @log_service_call
    @transactional
    def create_simulation(
        *,
        name: str,
        original_scenario_id: str,
        duplicated_scenario_id: str,
        owner_id: int,
    ) -> Simulation:
        return Simulation.objects.create(
            user_id=owner_id,
            name=name,
            original_scenario_id=original_scenario_id,
            duplicated_scenario_id=duplicated_scenario_id,
        )

    @staticmethod
    @log_service_call
    @transactional
    def update_simulation(
        *,
        simulation: Simulation,
        name: Optional[str] = None,
        original_scenario_id: Optional[str] = None,
        duplicated_scenario_id: Optional[str] = None,
    ) -> Simulation:
        if name is not None:
            simulation.name = name
        if original_scenario_id is not None:
            simulation.original_scenario_id = original_scenario_id
        if duplicated_scenario_id is not None:
            simulation.duplicated_scenario_id = duplicated_scenario_id
        simulation.save()
        return simulation

    @staticmethod
    @log_service_call
    @transactional
    def delete_simulation(simulation: Simulation) -> None:
        simulation.delete()

    @staticmethod
    @log_service_call
    def get_simulation_obj(simulation: Union[int, str, Simulation, None]) -> Optional[Simulation]:
        if simulation is None:
            return None
        if isinstance(simulation, Simulation):
            return simulation
        return SimulationService.find_simulation(simulation)

    @staticmethod
    @log_service_call
    def get_simulation_input_obj(
        simulation_input: Union[int, str, SimulationInput, None],
    ) -> Optional[SimulationInput]:
        if simulation_input is None:
            return None
        if isinstance(simulation_input, SimulationInput):
            return simulation_input
        try:
            return SimulationInput.objects.get(pk=simulation_input)
        except SimulationInput.DoesNotExist:
            return None
