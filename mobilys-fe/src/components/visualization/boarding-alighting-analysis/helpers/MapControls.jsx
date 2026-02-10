import React from "react";
import {
    Box,
    Paper,
    Typography,
    FormControl,
    RadioGroup,
    FormControlLabel,
    Radio,
    IconButton,
    Tooltip as MuiTooltip,
} from "@mui/material";
import { VISUALIZATION } from "@/strings";
import { METRIC_BASE } from "./LegendPanel";

export function MetricSelector({ metric, onMetricChange }) {
    return (
        <Paper
            elevation={3}
            sx={{
                position: "absolute",
                bottom: 16,
                left: 16,
                zIndex: 2400,
                p: 1.5,
                border: "1px solid #e0e0e0",
                borderRadius: 2,
                bgcolor: "rgba(255,255,255,0.98)",
                minWidth: 240,
            }}
            data-html2canvas-ignore
        >
            <Typography sx={{ fontWeight: 600, fontSize: 15, mb: 0.5 }}>
                {VISUALIZATION.common.map.labels.mode}
            </Typography>
            <FormControl component="fieldset">
                <RadioGroup row value={metric} onChange={(e) => onMetricChange?.(e.target.value)}>
                    <FormControlLabel
                        value="in_car"
                        control={<Radio size="small" />}
                        label={<span style={{ fontSize: 13 }}>{METRIC_BASE.in_car.label}</span>}
                    />
                    <FormControlLabel
                        value="boarding"
                        control={<Radio size="small" />}
                        label={<span style={{ fontSize: 13 }}>{METRIC_BASE.boarding.label}</span>}
                    />
                    <FormControlLabel
                        value="alighting"
                        control={<Radio size="small" />}
                        label={<span style={{ fontSize: 13 }}>{METRIC_BASE.alighting.label}</span>}
                    />
                </RadioGroup>
            </FormControl>
        </Paper>
    );
}

export function LegendToggleButton({ showLegend, setShowLegend }) {
    return (
        <Box
            sx={{ position: "absolute", bottom: 33, right: 100, zIndex: 1950, pointerEvents: "auto" }}
            data-html2canvas-ignore
        >
            <IconButton
                onClick={() => setShowLegend(!showLegend)}
                aria-label={
                    showLegend
                        ? VISUALIZATION.common.map.labels.legendHide
                        : VISUALIZATION.common.map.labels.legendShow
                }
                title={
                    showLegend
                        ? VISUALIZATION.common.map.labels.legendHide
                        : VISUALIZATION.common.map.labels.legendShow
                }
                sx={{
                    width: 48,
                    height: 48,
                    minWidth: 0,
                    minHeight: 0,
                    backgroundColor: "rgba(255,255,255,0.98)",
                    border: "1px solid #ddd",
                    borderRadius: 3,
                    boxShadow: 3,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 0,
                    cursor: "pointer",
                    "&:hover": {
                        backgroundColor: "rgba(255,255,255,1)",
                    },
                }}
            >
                <span className="material-symbols-outlined outlined">info</span>
            </IconButton>
        </Box>
    );
}

export function FullscreenButton({ isFullscreen, toggleFullscreen, exporting }) {
    return (
        <MuiTooltip
            title={
                isFullscreen
                    ? VISUALIZATION.common.map.fullscreen.exit
                    : VISUALIZATION.common.map.fullscreen.enter
            }
        >
            <IconButton
                data-html2canvas-ignore
                onClick={toggleFullscreen}
                sx={{
                    position: "absolute",
                    top: 16,
                    right: 16,
                    zIndex: 1100,
                    bgcolor: "#fff",
                    boxShadow: 1,
                }}
                size="large"
                aria-label="toggle fullscreen"
                disabled={exporting}
            >
                {isFullscreen ? (
                    <span className="material-symbols-outlined outlined">fullscreen_exit</span>
                ) : (
                    <span className="material-symbols-outlined outlined">fullscreen</span>
                )}
            </IconButton>
        </MuiTooltip>
    );
}

export function DownloadButton({ handleDownloadPNG, exporting }) {
    return (
        <MuiTooltip title={VISUALIZATION.common.map.actions.downloadPng}>
            <IconButton
                data-html2canvas-ignore
                onClick={handleDownloadPNG}
                disabled={exporting}
                sx={{
                    position: "absolute",
                    top: 16,
                    right: 70,
                    zIndex: 1100,
                    bgcolor: "#fff",
                    border: "1px solid #ddd",
                    boxShadow: 1,
                    opacity: exporting ? 0.6 : 1,
                }}
                size="large"
                aria-label="download map png"
            >
                <span className="material-symbols-outlined outlined">download</span>
            </IconButton>
        </MuiTooltip>
    );
}

export function ExportingOverlay({ exporting }) {
    if (!exporting) return null;

    return (
        <div
            id="exportOverlay"
            data-html2canvas-ignore
            style={{
                position: "absolute",
                inset: 0,
                zIndex: 2600,
                display: "grid",
                placeItems: "center",
                background: "rgba(255,255,255,0.35)",
                backdropFilter: "blur(0.5px)",
                fontWeight: 700,
            }}
        >
            {VISUALIZATION.common.map.actions.downloading}
        </div>
    );
}
