# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from typing import Iterable, Optional, Sequence, Union

from simulation.models import Simulation, SimulationInput


class SimulationResponseService:
    @staticmethod
    def attach_response_fields(
        simulations: Union[Simulation, Iterable[Simulation]],
        *,
        current_user_id: Optional[int],
        project_id: Optional[str],
    ) -> None:
        items: Sequence[Simulation]
        if isinstance(simulations, Simulation):
            items = [simulations]
        else:
            items = list(simulations)

        project_name = None
        if project_id:
            try:
                from user.models import Project

                project = (
                    Project.objects.only("project_name")
                    .filter(id=project_id)
                    .first()
                )
                project_name = getattr(project, "project_name", None)
            except Exception:
                project_name = None

        missing_has_run_ids = [
            str(sim.id)
            for sim in items
            if not hasattr(sim, "_has_run") and getattr(sim, "has_run", None) is None
        ]
        has_run_ids = set()
        if missing_has_run_ids:
            has_run_ids = set(
                SimulationInput.objects.filter(simulation_id__in=missing_has_run_ids)
                .values_list("simulation_id", flat=True)
                .distinct()
            )

        for sim in items:
            if getattr(sim, "project_name", None) is None:
                sim.project_name = project_name

            if getattr(sim, "has_run", None) is None:
                if hasattr(sim, "_has_run"):
                    sim.has_run = bool(sim._has_run)
                else:
                    sim.has_run = str(sim.id) in has_run_ids

            if getattr(sim, "scenario_source", None) is not None:
                continue

            if current_user_id is None:
                sim.scenario_source = None
                continue

            owner_id = getattr(sim, "user_id", None)
            if owner_id == current_user_id:
                sim.scenario_source = "owned simulation"
                continue

            owner_username = "user"
            try:
                owner = getattr(sim, "user", None)
                owner_username = getattr(owner, "username", None) or owner_username
            except Exception:
                owner_username = owner_username

            if project_name:
                sim.scenario_source = f"{project_name} ({owner_username})"
            else:
                sim.scenario_source = f"shared ({owner_username})"

