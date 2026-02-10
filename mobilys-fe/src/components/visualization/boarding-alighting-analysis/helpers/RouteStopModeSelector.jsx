import React from "react";
import { Box, Typography, FormControl, RadioGroup, FormControlLabel, Radio } from "@mui/material";
import { VISUALIZATION } from "@/strings";

export function RouteStopModeSelector({ mode, onChange }) {
    return (
        <Box
            sx={{
                position: "absolute",
                bottom: 16,
                left: 16,
                zIndex: 1000,
                p: 1.5,
                border: "1px solid #e0e0e0",
                borderRadius: 2,
                bgcolor: "rgba(255,255,255,0.98)",
                minWidth: 260,
            }}
            data-html2canvas-ignore
        >
            <Typography sx={{ fontWeight: 600, fontSize: 15, mb: 0.5 }}>
                {VISUALIZATION.common.map.labels.mode}
            </Typography>
            <FormControl component="fieldset">
                <RadioGroup
                    row
                    value={mode}
                    onChange={(e) => onChange?.(e.target.value)}
                    name="indicator-mode"
                >
                    <FormControlLabel
                        value="both"
                        control={<Radio size="small" />}
                        label={
                            <span style={{ fontSize: 13 }}>
                                {VISUALIZATION.common.labels.total}
                            </span>
                        }
                    />
                    <FormControlLabel
                        value="boarding"
                        control={<Radio size="small" />}
                        label={
                            <span style={{ fontSize: 13 }}>
                                {VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.series.boarding}
                            </span>
                        }
                    />
                    <FormControlLabel
                        value="alighting"
                        control={<Radio size="small" />}
                        label={
                            <span style={{ fontSize: 13 }}>
                                {VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.series.alighting}
                            </span>
                        }
                    />
                </RadioGroup>
            </FormControl>
        </Box>
    );
}
