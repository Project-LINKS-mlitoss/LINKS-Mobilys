// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";

import {
  getSimulationSummaryService,
  getSpeedChangeDefaults,
} from "../../../services/simulationService";
import { SIMULATION } from "@/strings";

const strings = SIMULATION.summaryPage;

const normalizeSpeedRoutesForSummary = (data) => {
  let rawRoutes;
  if (Array.isArray(data)) rawRoutes = data;
  else if (Array.isArray(data?.routes)) rawRoutes = data.routes;
  else if (Array.isArray(data?.data?.routes)) rawRoutes = data.data.routes;
  else rawRoutes = [];

  return (rawRoutes || []).map((r) => {
    const route_id = String(r?.route_id ?? "");
    const service_id = r?.service_id ?? undefined;

    const shapes = (r?.shapes || []).map((s) => {
      const pattern_id = String(s?.pattern_id ?? s?.route_pattern?.pattern_id ?? "");
      const shape_id = String(s?.shape_id ?? s?.route_pattern?.shape_id ?? "");
      const direction_id = s?.direction_id ?? s?.route_pattern?.direction_id ?? null;
      const segments = Array.isArray(s?.segments) ? s.segments : [];
      return { pattern_id, shape_id, direction_id, segments };
    });

    return { route_id, service_id, shapes };
  });
};

const computeSpeedTotalsForSummary = (speedData) => {
  const routes = normalizeSpeedRoutesForSummary(speedData);

  let tpv_b = 0;
  let tpv_a = 0;
  let ttv_b = 0;
  let ttv_a = 0;

  let inv_b_sum = 0;
  let inv_a_sum = 0;
  let cnt_b = 0;
  let cnt_a = 0;

  for (const route of routes || []) {
    for (const shape of route.shapes || []) {
      for (const seg of shape.segments || []) {
        const m = seg?.metrics || {};

        const tpv_b_seg = Number(m?.time_per_vehicle_h?.before ?? 0) || 0;
        const tpv_a_seg = Number(m?.time_per_vehicle_h?.after ?? 0) || 0;
        const ttv_b_seg = Number(m?.total_time_vehicle_h?.before ?? 0) || 0;
        const ttv_a_seg = Number(m?.total_time_vehicle_h?.after ?? 0) || 0;

        const sp_b = m?.speed_kmh?.before;
        const sp_a = m?.speed_kmh?.after;

        if (typeof sp_b === "number" && sp_b > 0) {
          inv_b_sum += 1 / sp_b;
          cnt_b += 1;
        }
        if (typeof sp_a === "number" && sp_a > 0) {
          inv_a_sum += 1 / sp_a;
          cnt_a += 1;
        }

        tpv_b += tpv_b_seg;
        tpv_a += tpv_a_seg;
        ttv_b += ttv_b_seg;
        ttv_a += ttv_a_seg;
      }
    }
  }

  return {
    avg_speed_before: cnt_b ? cnt_b / inv_b_sum : null,
    avg_speed_after: cnt_a ? cnt_a / inv_a_sum : null,
    time_per_vehicle_before_h: tpv_b,
    time_per_vehicle_after_h: tpv_a,
    total_time_before_vehicle_h: ttv_b,
    total_time_after_vehicle_h: ttv_a,
  };
};

export function useSimulationSummaryPage(simulationId) {
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState(null);
  const [speedTotals, setSpeedTotals] = React.useState(null);
  const [error, setError] = React.useState("");

  const requestIdRef = React.useRef(0);

  const refreshSummary = React.useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");

    try {
      const res = await getSimulationSummaryService(simulationId);
      if (requestId !== requestIdRef.current) return;
      setData(res || null);

      try {
        const speedPayload = await getSpeedChangeDefaults(simulationId);
        if (requestId !== requestIdRef.current) return;
        const totals = computeSpeedTotalsForSummary(speedPayload);
        setSpeedTotals(totals);
      } catch {
        if (requestId !== requestIdRef.current) return;
        setSpeedTotals(null);
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setData(null);
      setSpeedTotals(null);
      setError(err?.message || strings.messages.fetchFailed);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [simulationId]);

  React.useEffect(() => {
    void refreshSummary();
    return () => {
      requestIdRef.current += 1;
    };
  }, [refreshSummary]);

  return {
    loading,
    data,
    speedTotals,
    error,
    refreshSummary,
  };
}

