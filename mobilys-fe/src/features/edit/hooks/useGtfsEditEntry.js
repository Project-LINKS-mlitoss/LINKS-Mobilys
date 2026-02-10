import React from "react";
import {
  deleteScenarioSvc,
  editScenario,
  getScenarioDetail,
  getUserScenarios,
} from "../../../services/scenarioService";
import { cloneGTFSDataImport } from "../../../services/importService";
import { exportGTFS } from "../../../services/exportServices";
import { ERRORS as ERROR_MESSAGES } from "../../../constant";

function deriveFileTypesFromInfo(info) {
  const recordCount = info?.import_info?.record_count || info?.record_count || {};
  return Object.keys(recordCount);
}

export function useGtfsEditEntry() {
  const [scenarios, setScenarios] = React.useState([]);
  const [scenariosOwnedByUser, setScenariosOwnedByUser] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const refreshScenarios = React.useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const list = (await getUserScenarios(true)) || [];
      setScenarios(list);

      try {
        const owned = (await getUserScenarios(false)) || [];
        setScenariosOwnedByUser(owned);
      } catch {
        setScenariosOwnedByUser([]);
      }
    } catch (err) {
      setScenarios([]);
      setScenariosOwnedByUser([]);
      setError(err?.message || "");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshScenarios();
  }, [refreshScenarios]);

  const renameScenario = React.useCallback(
    async (scenarioId, scenarioName) => {
      await editScenario(scenarioId, { scenario_name: scenarioName }, {
        fallbackMessage: ERROR_MESSAGES.scenario.rename,
      });
      await refreshScenarios();
    },
    [refreshScenarios]
  );

  const deleteScenario = React.useCallback(
    async (scenarioId) => {
      await deleteScenarioSvc(scenarioId);
      await refreshScenarios();
    },
    [refreshScenarios]
  );

  const cloneScenario = React.useCallback(
    async ({ sourceScenarioId, scenarioName }) => {
      const data = await cloneGTFSDataImport({
        scenario_name: scenarioName,
        source_scenario_id: sourceScenarioId,
      });
      await refreshScenarios();
      return data?.new_scenario?.id ?? null;
    },
    [refreshScenarios]
  );

  const getExportFileTypes = React.useCallback(async (scenarioId) => {
    const detail = await getScenarioDetail(scenarioId);
    return deriveFileTypesFromInfo(detail);
  }, []);

  const exportScenario = React.useCallback(
    async ({ scenarioId, startDate, endDate, fileTypes, onProgress }) => {
      return exportGTFS({ scenarioId, startDate, endDate, fileTypes, onProgress });
    },
    []
  );

  const cloneScenarioOptions = React.useMemo(
    () =>
      scenarios.map((sc) => ({
        id: sc.id,
        scenario_name: sc.scenario_name,
        scenario_source: sc.scenario_source,
        project_name: sc.project_name,
      })),
    [scenarios]
  );

  const existingScenarioNames = React.useMemo(
    () =>
      new Set(
        (scenariosOwnedByUser || [])
          .map((sc) => (sc?.scenario_name || sc?.name || "").trim().toLowerCase())
          .filter(Boolean)
      ),
    [scenariosOwnedByUser]
  );

  return {
    scenarios,
    cloneScenarioOptions,
    existingScenarioNames,
    loading,
    error,
    refreshScenarios,
    renameScenario,
    deleteScenario,
    cloneScenario,
    getExportFileTypes,
    exportScenario,
  };
}
