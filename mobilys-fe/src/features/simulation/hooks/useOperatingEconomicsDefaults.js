import React from "react";
import { getOperatingEconomicsDefaults } from "../../../services/simulationService";
import { SIMULATION } from "@/strings";

const strings = SIMULATION.operatingEconomics;

export function useOperatingEconomicsDefaults(simulationId) {
  const [routes, setRoutes] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const requestIdRef = React.useRef(0);

  const clearError = React.useCallback(() => setError(""), []);

  const refresh = React.useCallback(async () => {
    const requestId = ++requestIdRef.current;

    if (simulationId == null || simulationId === "") {
      setRoutes([]);
      setLoading(false);
      setError(strings.errors.missingSimulationId);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload = await getOperatingEconomicsDefaults(simulationId);
      if (requestId !== requestIdRef.current) return;
      const nextRoutes = Array.isArray(payload?.routes) ? payload.routes : [];
      setRoutes(nextRoutes);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setRoutes([]);
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

  return { routes, loading, error, clearError, refresh };
}

