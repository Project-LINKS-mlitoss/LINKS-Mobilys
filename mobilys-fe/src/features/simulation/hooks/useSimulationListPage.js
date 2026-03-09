// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import {
  createSimulationScenario,
  deleteSimulationScenarioSvc,
  fetchSimulationScenarios,
  renameSimulationScenarioSvc,
} from "../../../services/simulationService";
import {
  fetchDuplicateCandidates,
  getUserScenarios,
} from "../../../services/scenarioService";
import { SIMULATION } from "@/strings";

const strings = SIMULATION.listPage;

function normalizeDuplicateNameMessage(message) {
  const text = String(message || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase();

  if (text.includes("simulation with this name already exists")) {
    return strings.messages.duplicateName;
  }

  return message;
}

export function useSimulationListPage(baseScenarioId) {
  // simulation list
  const [simulations, setSimulations] = React.useState([]);
  const [loadingSimulations, setLoadingSimulations] = React.useState(true);
  const [errorSimulations, setErrorSimulations] = React.useState("");

  // scenarios (for modal dropdowns)
  const [allScenarios, setAllScenarios] = React.useState([]);
  const [loadingScenarios, setLoadingScenarios] = React.useState(false);
  const [errorScenarios, setErrorScenarios] = React.useState("");

  // duplicate candidates (derived from baseScenarioId)
  const [dupCandidates, setDupCandidates] = React.useState([]);
  const [loadingCandidates, setLoadingCandidates] = React.useState(false);

  const simulationsRequestIdRef = React.useRef(0);
  const scenariosRequestIdRef = React.useRef(0);

  const refreshSimulations = React.useCallback(async () => {
    const requestId = ++simulationsRequestIdRef.current;
    setLoadingSimulations(true);
    setErrorSimulations("");
    try {
      const list = await fetchSimulationScenarios();
      if (requestId !== simulationsRequestIdRef.current) return;
      setSimulations(Array.isArray(list) ? list : []);
    } catch (err) {
      if (requestId !== simulationsRequestIdRef.current) return;
      setSimulations([]);
      setErrorSimulations(err?.message || strings.messages.listFetchFailed);
    } finally {
      if (requestId === simulationsRequestIdRef.current) setLoadingSimulations(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshSimulations();
    return () => {
      simulationsRequestIdRef.current += 1;
      scenariosRequestIdRef.current += 1;
    };
  }, [refreshSimulations]);

  const refreshScenarios = React.useCallback(async () => {
    const requestId = ++scenariosRequestIdRef.current;
    setLoadingScenarios(true);
    setErrorScenarios("");
    try {
      const list = await getUserScenarios();
      if (requestId !== scenariosRequestIdRef.current) return;
      setAllScenarios(Array.isArray(list) ? list : []);
    } catch (err) {
      if (requestId !== scenariosRequestIdRef.current) return;
      setAllScenarios([]);
      setErrorScenarios(err?.message || strings.messages.scenariosFetchFailed);
    } finally {
      if (requestId === scenariosRequestIdRef.current) setLoadingScenarios(false);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function loadCandidates() {
      setDupCandidates([]);
      if (!baseScenarioId) return;

      setLoadingCandidates(true);
      try {
        const payload = await fetchDuplicateCandidates(baseScenarioId);
        const arr = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.scenarios)
          ? payload.scenarios
          : [];

        if (!cancelled) setDupCandidates(arr);
      } finally {
        if (!cancelled) setLoadingCandidates(false);
      }
    }

    void loadCandidates();
    return () => {
      cancelled = true;
    };
  }, [baseScenarioId]);

  const createSimulation = React.useCallback(
    async ({ original_scenario, duplicated_scenario, name }) => {
      try {
        const created = await createSimulationScenario({
          original_scenario,
          duplicated_scenario,
          name,
        });
        await refreshSimulations();
        return created;
      } catch (err) {
        const msg = normalizeDuplicateNameMessage(err?.message) || strings.messages.createFailed;
        throw new Error(msg);
      }
    },
    [refreshSimulations]
  );

  const renameSimulation = React.useCallback(async (simulationId, name) => {
    try {
      await renameSimulationScenarioSvc(simulationId, name);
      setSimulations((prev) =>
        prev.map((s) => (s.id === simulationId ? { ...s, name } : s))
      );
    } catch (err) {
      const msg = normalizeDuplicateNameMessage(err?.message) || strings.messages.renameFailed;
      throw new Error(msg);
    }
  }, []);

  const deleteSimulation = React.useCallback(
    async (simulationId) => {
      await deleteSimulationScenarioSvc(simulationId);
      await refreshSimulations();
    },
    [refreshSimulations]
  );

  return {
    simulations,
    loadingSimulations,
    errorSimulations,
    refreshSimulations,

    allScenarios,
    loadingScenarios,
    errorScenarios,
    refreshScenarios,

    dupCandidates,
    loadingCandidates,

    createSimulation,
    renameSimulation,
    deleteSimulation,
  };
}
