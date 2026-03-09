// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import {
  getRidershipChanges,
  getSimulationInitData,
} from "../../../services/simulationService";

export function useRidershipChange(simulationId) {
  const [routes, setRoutes] = React.useState([]);
  const [sensitivityUp, setSensitivityUp] = React.useState(null);
  const [sensitivityDown, setSensitivityDown] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const requestIdRef = React.useRef(0);

  const clearError = React.useCallback(() => setError(""), []);

  const refresh = React.useCallback(async () => {
    const requestId = ++requestIdRef.current;

    if (simulationId == null || simulationId === "") {
      setRoutes([]);
      setSensitivityUp(null);
      setSensitivityDown(null);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload = await getRidershipChanges({ simulationId });
      if (requestId !== requestIdRef.current) return;
      const nextRoutes = Array.isArray(payload?.routes) ? payload.routes : [];
      setRoutes(nextRoutes);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setRoutes([]);
      setError(err?.message || String(err));
    }

    try {
      const initData = await getSimulationInitData(simulationId);
      if (requestId !== requestIdRef.current) return;

      const params = initData?.params || {};
      setSensitivityUp(
        typeof params.epsilon_inc === "number"
          ? params.epsilon_inc
          : params.epsilon_inc ?? null
      );
      setSensitivityDown(
        typeof params.epsilon_dec === "number"
          ? params.epsilon_dec
          : params.epsilon_dec ?? null
      );
    } catch (err) {
      // If init-data fetch fails, we still show ridership results.
      if (import.meta?.env?.DEV) {
        console.error("Failed to load simulation init data:", err);
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [simulationId]);

  React.useEffect(() => {
    void refresh();
    return () => {
      requestIdRef.current += 1;
    };
  }, [refresh]);

  return {
    routes,
    sensitivityUp,
    sensitivityDown,
    loading,
    error,
    clearError,
    refresh,
  };
}
