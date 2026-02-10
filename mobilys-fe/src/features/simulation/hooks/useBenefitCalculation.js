import React from "react";
import { getSimulationBenefitCalculationService } from "../../../services/simulationService";

export function useBenefitCalculation(simulationId) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const requestIdRef = React.useRef(0);

  const clearError = React.useCallback(() => setError(""), []);

  const refresh = React.useCallback(async () => {
    const requestId = ++requestIdRef.current;

    if (!simulationId) {
      setData(null);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const next = await getSimulationBenefitCalculationService(simulationId);
      if (requestId !== requestIdRef.current) return;
      setData(next ?? null);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setData(null);
      setError(err?.message || String(err));
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

  return { data, loading, error, clearError, refresh };
}

