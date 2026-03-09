// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import { Box, Paper, Typography, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { VISUALIZATION } from "@/strings";
import { rangeLabels, makeRamp } from "../utils/colorUtils";

const METRIC_BASE = {
    in_car: {
        label:
            VISUALIZATION.boardingAlightingAnalysis.components.routeSegmentVisualization
                .series.inVehicle,
        base: "#FFA726",
    },
    boarding: {
        label:
            VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization
                .series.boarding,
        base: "#3B82F6",
    },
    alighting: {
        label:
            VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization
                .series.alighting,
        base: "#E74C3C",
    },
};

export function LegendPanel({ metric, thresholds, onClose }) {
    const { label, base } = METRIC_BASE[metric] || METRIC_BASE.in_car;
    const ramp = makeRamp(base);
    const labels = rangeLabels(thresholds);
    const len = Math.min(ramp.length, labels.length);
    const items = Array.from({ length: len }, (_, i) => ({
        color: ramp[i],
        label: labels[i],
    })).reverse();

    return (
        <Paper
            className="map-legend-card"
            data-ba-legend-panel
            elevation={0}
            sx={{
                p: 1.25,
                border: "none",
                borderRadius: 2,
                bgcolor: "#ffffff",
                minWidth: 170,
                boxShadow: "none",
                position: "absolute",
                right: 100,
                zIndex: 1951,
                bottom: 10,
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14, color: "#111827", flex: 1 }}>
                    {label}
                </Typography>

                {typeof onClose === "function" && (
                    <IconButton
                        size="small"
                        aria-label={VISUALIZATION.common.dialog.close}
                        title={VISUALIZATION.common.dialog.close}
                        onClick={onClose}
                        sx={{ width: 24, height: 24, borderRadius: 1 }}
                    >
                        <CloseIcon sx={{ fontSize: 16, color: "#666" }} />
                    </IconButton>
                )}
            </Box>

            <Box component="ul" sx={{ listStyle: "none", p: 0, m: "8px 0 0 0" }}>
                {items.map((it, i) => (
                    <Box key={i} component="li" sx={{ display: "flex", alignItems: "center", mb: "4px", fontSize: "14px" }}>
                        <Box component="span" sx={{ display: "inline-block", width: 14, height: 14, background: it.color, border: "1px solid #999", mr: "8px" }} />
                        <Box component="span">{it.label}</Box>
                    </Box>
                ))}
            </Box>
        </Paper>
    );
}

export { METRIC_BASE };
