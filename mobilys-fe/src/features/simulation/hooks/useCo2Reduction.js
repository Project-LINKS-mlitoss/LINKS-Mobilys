import React from "react";
import { getCo2ByRoute } from "../../../services/simulationService";

export function useCo2Reduction(simulationId) {
  const [routes, setRoutes] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const requestIdRef = React.useRef(0);

  const clearError = React.useCallback(() => setError(""), []);

  const refresh = React.useCallback(async () => {
    const requestId = ++requestIdRef.current;

    if (!simulationId) {
      setRoutes([]);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await getCo2ByRoute({ simulationId });
      if (requestId !== requestIdRef.current) return;

      // Backend payload is inconsistent across versions:
      // - either `{ routes: [...] }`
      // - or `[...]`
      const list = Array.isArray(res?.routes)
        ? res.routes
        : Array.isArray(res)
        ? res
        : [];

      setRoutes(list);
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

