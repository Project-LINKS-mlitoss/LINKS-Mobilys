import React from "react";
import { getUserScenarios } from "../../../services/scenarioService";
import { cloneGTFSDataImport } from "../../../services/importService";
import { GTFS_STORAGE_KEYS } from "../../../constant";

export function useGtfsScenarios() {
  const storageKey = GTFS_STORAGE_KEYS.selectedScenarioVisualization;

  const [scenarioOptions, setScenarioOptions] = React.useState([]);
  const [scenarioOwnedByUser, setScenarioOwnedByUser] = React.useState([]);
  const [loadingScenario, setLoadingScenario] = React.useState(true);
  const [loadError, setLoadError] = React.useState(null);

  const [selectedScenarioId, setSelectedScenarioId] = React.useState(() => {
    try {
      return localStorage.getItem(storageKey) || "";
    } catch {
      return "";
    }
  });

  const hasValidScenario = React.useMemo(
    () =>
      scenarioOptions.some((s) => String(s.id) === String(selectedScenarioId)),
    [scenarioOptions, selectedScenarioId]
  );

  const existingScenarioNames = React.useMemo(
    () =>
      new Set(
        (scenarioOwnedByUser || [])
          .map((s) => (s?.scenario_name || s?.name || "").trim().toLowerCase())
          .filter(Boolean)
      ),
    [scenarioOwnedByUser]
  );

  const refreshScenarios = React.useCallback(async () => {
    setLoadingScenario(true);
    setLoadError(null);

    try {
      const list = (await getUserScenarios(true)) || [];
      setScenarioOptions(list);

      try {
        const ownedList = (await getUserScenarios(false)) || [];
        setScenarioOwnedByUser(ownedList);
      } catch {
        setScenarioOwnedByUser([]);
      }

      try {
        const stored = localStorage.getItem(storageKey);
        const stillExists = list.some((s) => String(s.id) === String(stored));
        if (!stillExists) {
          setSelectedScenarioId("");
          localStorage.removeItem(storageKey);
        }
      } catch {
        // ignore localStorage failures
      }
    } catch (err) {
      setScenarioOptions([]);
      setScenarioOwnedByUser([]);
      setSelectedScenarioId("");
      setLoadError(err);
    } finally {
      setLoadingScenario(false);
    }
  }, [storageKey]);

  React.useEffect(() => {
    void refreshScenarios();
  }, [refreshScenarios]);

  React.useEffect(() => {
    try {
      if (selectedScenarioId) {
        localStorage.setItem(storageKey, selectedScenarioId);
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {
      // ignore localStorage failures
    }
  }, [selectedScenarioId, storageKey]);

  const cloneScenario = React.useCallback(async (sourceScenarioId, scenarioName) => {
    const data = await cloneGTFSDataImport({
      scenario_name: scenarioName,
      source_scenario_id: sourceScenarioId,
    });
    return data?.new_scenario?.id ?? null;
  }, []);

  return {
    scenarioOptions,
    loadingScenario,
    selectedScenarioId,
    setSelectedScenarioId,
    hasValidScenario,
    refreshScenarios,
    existingScenarioNames,
    cloneScenario,
    loadError,
  };
}
