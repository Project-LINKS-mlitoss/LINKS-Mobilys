// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import { VISUALIZATION } from "@/strings";
import { BOARDING_ALIGHTING_ANALYSIS_COLORS } from "../../../../../constant/colors";

const LINE_COLOR = BOARDING_ALIGHTING_ANALYSIS_COLORS.LINE_COLOR;
const BAR_UP = BOARDING_ALIGHTING_ANALYSIS_COLORS.BAR_UP;
const BAR_DOWN = BOARDING_ALIGHTING_ANALYSIS_COLORS.BAR_DOWN;

export const TOTAL_SERIES = [
    {
        key: "boardings",
        label: VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.series.boardings,
        color: BAR_UP,
        kind: "bar",
    },
    {
        key: "alightings",
        label: VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.series.alightings,
        color: BAR_DOWN,
        kind: "bar",
    },
    {
        key: "inVehicle",
        label: VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.series.inVehicle,
        color: LINE_COLOR,
        kind: "line",
    },
];

/**
 * Interactive legend for route total chart
 */
export function ChartLegend({ activeSeries, onLegendClick }) {
    return (
        <div
            style={{
                display: "flex",
                gap: 12,
                padding: "8px 8px 4px 8px",
                flexWrap: "wrap",
                marginBottom: "20px",
            }}
        >
            {TOTAL_SERIES.map((it) => {
                const isActive = activeSeries === "ALL" || activeSeries === it.key;
                const isFocused = activeSeries === it.key;
                return (
                    <div
                        key={it.key}
                        onClick={() => onLegendClick(it.key)}
                        style={{
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            opacity: isActive ? 1 : 0.35,
                            fontWeight: isFocused ? 700 : 500,
                            transition: "opacity 200ms ease",
                            userSelect: "none",
                        }}
                        title={`${it.label}${VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.legend.toggleSuffix}`}
                    >
                        <span
                            style={{
                                width: 12,
                                height: 12,
                                background: it.color,
                                borderRadius: 3,
                                display: "inline-block",
                            }}
                        />
                        <span style={{ fontSize: 13 }}>{it.label}</span>
                    </div>
                );
            })}
        </div>
    );
}

/**
 * Custom dot for line chart (route total)
 */
export function ChartDot(props) {
    return (
        <circle
            cx={props.cx}
            cy={props.cy}
            r={6}
            stroke="#D99F3C"
            strokeWidth={3}
            fill="#F1CE86"
        />
    );
}
