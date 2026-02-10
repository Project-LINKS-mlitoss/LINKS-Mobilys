import React from "react";

import {
  getOperatingEconomicsDefaults,
  getSpeedChangeDefaults,
} from "../../../services/simulationService";
import { SIMULATION } from "@/strings";

const strings = SIMULATION.speedChangeTab;

export function useSpeedChangeTab(simulationId) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [data, setData] = React.useState([]);
  const [economicsByRoute, setEconomicsByRoute] = React.useState({});

  const requestIdRef = React.useRef(0);

  const refresh = React.useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");

    if (!simulationId && simulationId !== 0) {
      setLoading(false);
      setError(strings.messages.missingSimulationId);
      setData([]);
      setEconomicsByRoute({});
      return;
    }

    try {
      const [speedList, ecoList] = await Promise.all([
        getSpeedChangeDefaults(simulationId),
        getOperatingEconomicsDefaults(simulationId),
      ]);

      if (requestId !== requestIdRef.current) return;

      const routes = Array.isArray(speedList)
        ? speedList
        : Array.isArray(speedList?.routes)
        ? speedList.routes
        : [];
      setData(routes);
      if (!routes.length) setError(strings.messages.noData);

      const ecoRoutes = Array.isArray(ecoList)
        ? ecoList
        : Array.isArray(ecoList?.routes)
        ? ecoList.routes
        : [];
      const map = {};
      for (const r of ecoRoutes) {
        const id = String(r?.route_id ?? "");
        if (!id) continue;
        map[id] = {
          delta_cost_yen_per_day: r?.delta_cost_yen_per_day ?? null,
          delta_revenue_yen_per_day: r?.delta_revenue_yen_per_day ?? null,
          net_per_day_yen: r?.net_per_day_yen ?? null,
        };
      }
      setEconomicsByRoute(map);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err?.message || strings.messages.fetchFailed);
      setData([]);
      setEconomicsByRoute({});
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

  return { loading, error, data, economicsByRoute, refresh };
}

