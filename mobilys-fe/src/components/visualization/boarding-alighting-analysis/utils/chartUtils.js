// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
/**
 * Strips sequence number suffix from stop labels
 * Example: "Station A (2)" => "Station A"
 */
export function stripSequenceSuffix(label) {
  return typeof label === "string" ? label.replace(/\s\(\d+\)$/, "") : label;
}

/**
 * Adds sequence numbers to duplicate stop names in chart data
 * Example: ["A", "B", "A"] => ["A", "B", "A (2)"]
 */
export function addStopSequenceLabels(data, stopKey = "stop") {
  if (!Array.isArray(data)) return [];
  
  const counter = new Map();

  return data.map((item, index) => {
    const rawStop = item?.[stopKey] ?? "";
    const prev = counter.get(rawStop) ?? 0;
    const current = prev + 1;
    counter.set(rawStop, current);

    const suffix = current > 1 ? ` (${current})` : "";

    return {
      ...item,
      index,
      stopSeq: current,
      stopLabel: `${rawStop}${suffix}`,
      stopRaw: rawStop,
    };
  });
}

/**
 * Calculate statistics (average, max, total) for boarding/alighting data
 */
export function calculateChartStats(chartData) {
  const rows = Array.isArray(chartData) ? chartData : [];
  
  const calc = (key) => {
    const vals = rows.map((r) => Number(r?.[key]) || 0);
    const total = vals.reduce((a, b) => a + b, 0);
    const maximum = vals.length ? Math.max(...vals) : 0;
    const average = vals.length ? total / vals.length : 0;
    return { average, maximum, total };
  };
  
  return {
    boardings: calc("boardings"),
    alightings: calc("alightings"),
    inVehicle: calc("inVehicle"),
  };
}

/**
 * Format number to integer, or 0 if not finite
 */
export function formatToInt(n) {
  return Number.isFinite(n) ? Math.round(n) : 0;
}
