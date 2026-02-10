import React from "react";

import { getDetailCarVolumeService } from "../../../services/simulationService";
import { SIMULATION } from "@/strings";

const strings = SIMULATION.volumeCarTab;

export function useVolumeCarTab(simulationId) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [data, setData] = React.useState(null);

  const requestIdRef = React.useRef(0);

  const clearError = React.useCallback(() => setError(""), []);

  const refresh = React.useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");

    if (!simulationId && simulationId !== 0) {
      setData(null);
      setError(strings.messages.missingSimulationId);
      setLoading(false);
      return;
    }

    try {
      const res = await getDetailCarVolumeService(simulationId);
      if (requestId !== requestIdRef.current) return;
      setData(res || null);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setData(null);
      setError(err?.message || strings.messages.fetchFailed);
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

  return { loading, error, data, refresh, clearError };
}

