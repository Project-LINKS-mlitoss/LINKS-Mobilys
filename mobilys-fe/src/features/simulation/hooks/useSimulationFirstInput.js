// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";

import {
  deleteValidationResult,
  getSimulationInitData,
  getUnionCalendarByDates,
  runSimulation,
  validateAndSaveSimulationCsv,
} from "../../../services/simulationService";

export function useSimulationFirstInput(simulationId) {
  const [loadingInit, setLoadingInit] = React.useState(true);
  const [locked, setLocked] = React.useState(false);
  const [serverData, setServerData] = React.useState(null);
  const [initError, setInitError] = React.useState("");

  const requestIdRef = React.useRef(0);

  const refreshInit = React.useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoadingInit(true);
    setInitError("");
    try {
      const res = await getSimulationInitData(simulationId);
      if (requestId !== requestIdRef.current) return null;

      setServerData(res || null);
      const isLocked = String(res?.status || "").toLowerCase() === "success";
      setLocked(isLocked);
      return res || null;
    } catch (err) {
      if (requestId !== requestIdRef.current) return null;
      setLocked(false);
      setServerData(null);
      setInitError(err?.message || "");
      return null;
    } finally {
      if (requestId === requestIdRef.current) setLoadingInit(false);
    }
  }, [simulationId]);

  React.useEffect(() => {
    void refreshInit();
    return () => {
      requestIdRef.current += 1;
    };
  }, [refreshInit]);

  const fetchServiceIdsByDate = React.useCallback(
    async (isoDate) => {
      if (!isoDate) return [];
      const list = await getUnionCalendarByDates({
        date: isoDate.replace(/-/g, ""),
        simulationID: simulationId,
      });
      return Array.isArray(list) ? Array.from(new Set(list)) : [];
    },
    [simulationId]
  );

  const validateCsv = React.useCallback(
    async (file) => {
      if (!file || !simulationId) return null;
      return await validateAndSaveSimulationCsv({ simulationId, file });
    },
    [simulationId]
  );

  const removeValidationResult = React.useCallback(async () => {
    if (!simulationId) return;
    await deleteValidationResult({ simulationId });
  }, [simulationId]);

  const executeSimulation = React.useCallback(
    async ({ file, payload }) => {
      if (!file || !simulationId) return null;
      return await runSimulation(file, payload);
    },
    [simulationId]
  );

  return {
    loadingInit,
    locked,
    serverData,
    initError,
    refreshInit,
    fetchServiceIdsByDate,
    validateCsv,
    removeValidationResult,
    executeSimulation,
  };
}

