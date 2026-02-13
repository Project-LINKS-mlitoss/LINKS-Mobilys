// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import { VISUALIZATION } from "@/strings";
import { stripSequenceSuffix } from "../../utils";

/**
 * Custom tooltip for route total chart
 */
export function RouteTotalTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;

    const p = Object.fromEntries(payload.map((x) => [x.dataKey, x.value]));
    const displayLabel = stripSequenceSuffix(label);

    return (
        <div
            style={{
                background: "#fff",
                border: "1px solid #ddd",
                padding: 8,
                borderRadius: 6,
                fontSize: 12,
            }}
        >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
                {displayLabel}
            </div>
            <div>
                {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.tooltip.boardings}:
                {p.boardings ?? 0}
            </div>
            <div>
                {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.tooltip.alightings}:
                {p.alightings ?? 0}
            </div>
            <div>
                {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.tooltip.inVehicle}:
                {p.inVehicle ?? 0}
            </div>
        </div>
    );
}

/**
 * Tooltip for boarding/alighting bars per trip
 */
export function BarsTooltip({ active, payload, label, hoverTrip, tidToKey }) {
    if (!active || !payload?.length || !hoverTrip) return null;

    const k = tidToKey[hoverTrip];
    const allow = new Set([`b__${k}`, `a__${k}`]);
    const items = payload.filter((it) => allow.has(it.dataKey));

    if (!items.length) return null;

    return (
        <div
            style={{
                background: "#fff",
                border: "1px solid #ddd",
                padding: 8,
                borderRadius: 6,
                fontSize: 12,
            }}
        >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
            {items.map((it, i) => (
                <div key={i} style={{ color: it.fill }}>
                    {it.name}: {it.value}
                </div>
            ))}
        </div>
    );
}

/**
 * Tooltip for in-vehicle line per trip
 */
export function LinesTooltip({ active, payload, label, hoverTrip, tidToKey }) {
    if (!active || !payload?.length || !hoverTrip) return null;

    const k = tidToKey[hoverTrip];
    const allow = new Set([`v__${k}`]);
    const items = payload.filter((it) => allow.has(it.dataKey));

    if (!items.length) return null;

    const displayLabel = stripSequenceSuffix(label);

    return (
        <div
            style={{
                background: "#fff",
                border: "1px solid #ddd",
                padding: 8,
                borderRadius: 6,
                fontSize: 12,
            }}
        >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
                {displayLabel}
            </div>
            {items.map((it, i) => (
                <div key={i} style={{ color: it.stroke }}>
                    {it.name}: {it.value}
                </div>
            ))}
        </div>
    );
}
