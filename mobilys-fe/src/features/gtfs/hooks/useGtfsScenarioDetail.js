// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import { SCENARIO } from "../../../strings";
import { getScenarioDetail } from "../../../services/scenarioService";
import { exportGTFS } from "../../../services/exportServices";

export function useGtfsScenarioDetail(scenarioId) {
  const [importInfo, setImportInfo] = React.useState({});
  const [scenarioName, setScenarioName] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState(null);

  const refreshScenarioDetail = React.useCallback(async () => {
    if (!scenarioId) return;

    setLoading(true);
    setLoadError(null);

    try {
      const data = await getScenarioDetail(scenarioId);
      setImportInfo(data);
      setScenarioName(data?.scenario_name || "");
    } catch (err) {
      setImportInfo({});
      setScenarioName("");
      setLoadError(err);
    } finally {
      setLoading(false);
    }
  }, [scenarioId]);

  React.useEffect(() => {
    void refreshScenarioDetail();
  }, [refreshScenarioDetail]);

  const exportScenarioGtfs = React.useCallback(
    async ({ startDate = null, endDate = null, fileTypes = [], onProgress }) => {
      const blob = await exportGTFS({
        scenarioId,
        startDate,
        endDate,
        fileTypes,
        onProgress: (pct) => onProgress?.(pct, SCENARIO.detail.export.downloadInProgress),
      });
      return blob;
    },
    [scenarioId]
  );

  return {
    importInfo,
    scenarioName,
    loading,
    loadError,
    refreshScenarioDetail,
    exportScenarioGtfs,
  };
}
