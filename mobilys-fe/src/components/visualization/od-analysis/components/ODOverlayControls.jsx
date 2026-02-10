import React from "react";
import {
  Box,
  FormControl,
  FormControlLabel,
  IconButton,
  Paper,
  Radio,
  RadioGroup,
  Typography,
} from "@mui/material";
import { VISUALIZATION } from "@/strings";
import MapLayerControlPanel from "../../bus-running-visualization/MapLayerControlPanel";
import LegendsDock from "../LegendDocks";
import RouteIcon from "../../../../assets/logo/route-color-layer.png";

export default function ODOverlayControls({
  selectedVisualization,
  layerState,
  onLayerToggle,
  selectedTile,
  onTileSelect,
  minimized,
  setMinimized,
  legendMinimized,
  setLegendMinimized,
  mapUiZIndex,

  oDUsageDistributionSelectedMode,
  setODUsageDistributionSelectedMode,
  oDLastFirstStopSelectedMode,
  setODLastFirstStopSelectedMode,

  points,
  lastFirstPoints,
  oDLastFirstStopSelectedPoint,
  filteredBusStopLines,
}) {
  return (
    <>
      {selectedVisualization === 0 && (
        <Paper
          elevation={3}
          sx={{
            position: "absolute",
            bottom: 16,
            left: 16,
            zIndex: mapUiZIndex - 20,
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
            <RadioGroup
              row
              value={oDUsageDistributionSelectedMode}
              onChange={(e) => setODUsageDistributionSelectedMode?.(e.target.value)}
            >
              <FormControlLabel
                value="sum"
                control={<Radio size="small" />}
                label={<span style={{ fontSize: 13 }}>{VISUALIZATION.common.labels.total}</span>}
              />
              <FormControlLabel
                value="origin"
                control={<Radio size="small" />}
                label={<span style={{ fontSize: 13 }}>{VISUALIZATION.odAnalysis.components.common.labels.boarding}</span>}
              />
              <FormControlLabel
                value="dest"
                control={<Radio size="small" />}
                label={<span style={{ fontSize: 13 }}>{VISUALIZATION.odAnalysis.components.common.labels.alighting}</span>}
              />
            </RadioGroup>
          </FormControl>
        </Paper>
      )}

      {selectedVisualization === 1 && (
        <Paper
          elevation={3}
          sx={{
            position: "absolute",
            bottom: 16,
            left: 16,
            zIndex: mapUiZIndex - 20,
            p: 1.5,
            border: "1px solid #e0e0e0",
            borderRadius: 2,
            bgcolor: "rgba(255,255,255,0.98)",
            minWidth: 160,
          }}
          data-html2canvas-ignore
        >
          <Typography sx={{ fontWeight: 600, fontSize: 15, mb: 0.5 }}>
            {VISUALIZATION.common.map.labels.mode}
          </Typography>
          <FormControl component="fieldset">
            <RadioGroup
              row
              value={oDLastFirstStopSelectedMode}
              onChange={(e) => setODLastFirstStopSelectedMode?.(e.target.value)}
            >
              <FormControlLabel
                value="first_stop"
                control={<Radio size="small" />}
                label={<span style={{ fontSize: 13 }}>{VISUALIZATION.odAnalysis.components.common.labels.firstStop}</span>}
              />
              <FormControlLabel
                value="last_stop"
                control={<Radio size="small" />}
                label={<span style={{ fontSize: 13 }}>{VISUALIZATION.odAnalysis.components.common.labels.lastStop}</span>}
              />
            </RadioGroup>
          </FormControl>
        </Paper>
      )}

      {/* Legend dock (included in PNG export) */}
      <LegendsDock
        open={!legendMinimized}
        onClose={() => setLegendMinimized(true)}
        anchorRight={minimized ? 100 : 312}
        anchorBottom={24}
        zIndex={mapUiZIndex + 1}
        selectedVisualization={selectedVisualization}
        odUsage={{ mode: oDUsageDistributionSelectedMode, points }}
        lastFirst={{ mode: oDLastFirstStopSelectedMode, points: lastFirstPoints }}
        lastFirstChild={{ mode: oDLastFirstStopSelectedMode, feature: oDLastFirstStopSelectedPoint }}
        busOD={{ lines: filteredBusStopLines }}
      />

      <Box
        sx={{
          position: "absolute",
          bottom: 33,
          right: minimized ? 100 : 312,
          zIndex: mapUiZIndex,
          pointerEvents: "auto",
        }}
        data-html2canvas-ignore
      >
        <IconButton
          onClick={() => setLegendMinimized((v) => !v)}
          aria-label={VISUALIZATION.common.map.labels.legendShow}
          title={VISUALIZATION.common.map.labels.legendShow}
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

      <div data-html2canvas-ignore>
        <MapLayerControlPanel
          additionalLayerItems={[
            { key: "routeColors", icon: RouteIcon, label: VISUALIZATION.common.map.labels.routeColors },
          ]}
          layerState={layerState}
          onLayerToggle={onLayerToggle}
          selectedTile={selectedTile}
          onTileSelect={onTileSelect}
          minimized={minimized}
          setMinimized={setMinimized}
        />
      </div>
    </>
  );
}

