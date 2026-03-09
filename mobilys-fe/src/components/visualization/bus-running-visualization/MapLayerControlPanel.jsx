// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React, { useMemo } from "react";
import { Box, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import LabelIcon from "../../../assets/photos/labelsicon.svg";
import StopName from "../../../assets/photos/light-stop-name.png";
import RouteIcon from "../../../assets/logo/route-color-layer.png";
import StopIcon from "../../../assets/photos/stopsicon.svg";
import BlankMap from "../../../assets/photos/blank.png";
import PaleMap from "../../../assets/photos/pale.png";
import PhotoMap from "../../../assets/photos/photo.jpg";
import StdMap from "../../../assets/photos/std.png";
import StopLayer from "../../../assets/logo/stop-layer.png";
import StopNameLayer from "../../../assets/logo/stop-name-layer.png";
import RouteLayer from "../../../assets/logo/route-layer.png";
import RouteNameLayer from "../../../assets/logo/route-name-layer.png";
import RouteColorLayer from "../../../assets/logo/route-color-layer.png";
import { IconButton } from "@mui/material";
import { VISUALIZATION } from "@/strings";


const mapLayerStrings = VISUALIZATION.busRunningVisualization.components.mapLayerControl;
const GSI_ATTR = VISUALIZATION.common.map.attributions.gsi;
const defaultLayerItems = [
  { key: "edges", icon: RouteLayer, label: mapLayerStrings.layers.edges },
  { key: "routeLabels", icon: RouteNameLayer, label: mapLayerStrings.layers.routeLabels },
  { key: "stops", icon: StopLayer, label: mapLayerStrings.layers.stops },
  { key: "stopLabels", icon: StopNameLayer, label: mapLayerStrings.layers.stopLabels },
];

const mapBaseItems = [
  {
    key: "pale",
    thumb: PaleMap,
    label: mapLayerStrings.baseMaps.pale,
    url: "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png",
    attribution: GSI_ATTR,
  },
  {
    key: "std",
    thumb: StdMap,
    label: mapLayerStrings.baseMaps.std,
    url: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
    attribution: GSI_ATTR,
  },
  {
    key: "blank",
    thumb: BlankMap,
    label: mapLayerStrings.baseMaps.blank,
    url: "https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png",
    attribution: GSI_ATTR,
  },
  {
    key: "photo",
    thumb: PhotoMap,
    label: mapLayerStrings.baseMaps.photo,
    url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
    attribution: GSI_ATTR,
  },
];

// Renders: Material Symbols element, MUI icon component, or URL string (png/svg)
function RenderIcon({ icon, alt, size = 34, dim = false }) {
  // React element, e.g. <span className="material-symbols-outlined">groups</span>
  if (React.isValidElement(icon)) {
    return React.cloneElement(icon, {
      className: ["material-symbols-outlined", icon.props.className]
        .filter(Boolean)
        .join(" "),
      style: {
        fontSize: size,
        width: size,
        height: size,
        display: "block",
        margin: "0 auto 2px",
        filter: dim ? "grayscale(0.7)" : "none",
        ...(icon.props.style || {}),
      },
    });
  }

  // Component function/class (e.g., MUI icon)
  if (typeof icon === "function") {
    const C = icon;
    return (
      <C
        sx={{
          fontSize: size,
          display: "block",
          mx: "auto",
          mb: "2px",
          filter: dim ? "grayscale(0.7)" : "none",
        }}
      />
    );
  }

  // String URL (Vite resolves imports to URLs)
  if (typeof icon === "string") {
    return (
      <img
        src={icon}
        alt={alt}
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          display: "block",
          margin: "0 auto 2px",
          filter: dim ? "grayscale(0.7)" : "none",
        }}
      />
    );
  }

  return null;
}

const LAYER_ORDER = {
  edges: 0,
  routeColors: 1,
  routeLabels: 2,
  stops: 3,
  stopLabels: 4,
  pois: 5,
  buffer: 6,
};

function LayerControlPanel({
  additionalLayerItems = [],
  populationItems = [],
  layerState,
  onLayerToggle,
  selectedTile,
  onTileSelect,
  minimized,
  setMinimized,
}) {
  // Build a mesh key set (in case you need it later)
  const MESH_KEYS = useMemo(
    () => new Set(populationItems.map((i) => i.key)),
    [populationItems]
  );

  const layerItems = useMemo(() => {
    const merged = [...defaultLayerItems, ...additionalLayerItems];
    return merged.sort((a, b) => {
      const aOrder = LAYER_ORDER[a.key] ?? 999;
      const bOrder = LAYER_ORDER[b.key] ?? 999;
      return aOrder - bOrder;
    });
  }, [additionalLayerItems]);

  // Single-select behavior for population mesh row
  const handleMeshClick = (key) => {
    const isActive = !!layerState[key];

    if (isActive) {
      onLayerToggle(key); // turn off current
      return;
    }

    // turn off others
    populationItems.forEach(({ key: k }) => {
      if (k !== key && layerState[k]) onLayerToggle(k);
    });

    // turn on clicked
    onLayerToggle(key);
  };

  if (minimized) {
    return (
      <IconButton
        onClick={() => setMinimized(false)}
        aria-label="Show Layer Control"
        title="Show Layer Control"
        sx={{
          position: "absolute",
          bottom: 33,
          right: 24,
          zIndex: 1100,
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
          "&:hover": {
            backgroundColor: "rgba(255,255,255,1)",
          },
        }}
      >
        <span className="material-symbols-outlined outlined">
          layers
        </span>
      </IconButton>

    );
  }

  return (
    <Box
      sx={{
        position: "absolute",
        bottom: 33,
        right: 24,
        zIndex: 2000,
        background: "rgba(255,255,255,0.98)",
        border: "1px solid #ddd",
        borderRadius: 3,
        boxShadow: 3,
        p: 2,
        minWidth: 280,
        maxWidth: 480,
        fontSize: 14,
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: 6,
          right: 8,
          cursor: "pointer",
          color: "#888",
          zIndex: 1,
        }}
        onClick={() => setMinimized(true)}
        title="Hide Layer Control"
      >
        <CloseIcon fontSize="small" />
      </Box>

      {/* Layers (multi-select) */}
      <Typography sx={{ mb: 1, fontWeight: 600, fontSize: 17 }}>
        {mapLayerStrings.sectionLabels.layers}
      </Typography>
      <Box sx={{ display: "flex", gap: 2, mb: 2, overflowX: "auto" }}>
        {layerItems.map((item) => {
          const active = !!layerState[item.key];
          return (
            <Box
              key={item.key}
              onClick={() => onLayerToggle(item.key)}
              sx={{
                borderRadius: 2,
                background: active ? "#f3faff" : "#f6f6f6",
                border: active ? "2px solid #2196f3" : "2px solid #eee",
                cursor: "pointer",
                boxShadow: active ? 2 : "none",
                textAlign: "center",
                px: 1.2,
                pt: 1,
                pb: 0.6,
                minWidth: 56,
                minHeight: 54,
                transition: "border .15s, box-shadow .18s, background .18s",
                userSelect: "none",
              }}
            >
              <RenderIcon icon={item.icon} alt={item.label} size={34} dim={!active} />
              <Typography
                sx={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: active ? "#1976d2" : "#888",
                }}
              >
                {item.label}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {/* Population mesh (single-select) */}
      {populationItems.length > 0 && (
        <Typography sx={{ mb: 1, fontWeight: 600, fontSize: 17 }}>
          {mapLayerStrings.sectionLabels.population}
        </Typography>
      )}
      <Box sx={{ display: "flex", gap: 2, mb: 2, overflowX: "auto" }}>
        {populationItems.map((item) => {
          const active = !!layerState[item.key];
          return (
            <Box
              key={item.key}
              onClick={() => handleMeshClick(item.key)}
              sx={{
                borderRadius: 2,
                background: active ? "#f3faff" : "#f6f6f6",
                border: active ? "2px solid #2196f3" : "2px solid #eee",
                cursor: "pointer",
                boxShadow: active ? 2 : "none",
                textAlign: "center",
                px: 1.2,
                pt: 1,
                pb: 0.6,
                minWidth: 56,
                minHeight: 54,
                transition: "border .15s, box-shadow .18s, background .18s",
                userSelect: "none",
              }}
            >
              <RenderIcon icon={item.icon} alt={item.label} size={34} dim={!active} />
              <Typography
                sx={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: active ? "#1976d2" : "#888",
                }}
              >
                {item.label}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {/* Base map (single-select by selectedTile) */}
      <Typography sx={{ mb: 1, fontWeight: 600, fontSize: 16 }}>
        {mapLayerStrings.sectionLabels.map}
      </Typography>
      <Box sx={{ display: "flex", gap: 2 }}>
        {mapBaseItems.map((item) => {
          const isSelected = selectedTile === item.key;
          return (
            <Box
              key={item.key}
              onClick={() => onTileSelect(item.key)}
              sx={{
                borderRadius: 2,
                border: isSelected ? "2px solid #222" : "2px solid #eee",
                boxShadow: isSelected ? 2 : "none",
                overflow: "hidden",
                cursor: "pointer",
                p: 0.5,
                background: "#fff",
                minWidth: 54,
                minHeight: 54,
                textAlign: "center",
                userSelect: "none",
                transition: "border .13s, box-shadow .18s",
              }}
            >
              <img
                src={item.thumb}
                alt={item.label}
                style={{
                  width: 40,
                  height: 40,
                  objectFit: "cover",
                  borderRadius: 3,
                  display: "block",
                  margin: "0 auto 2px",
                  opacity: isSelected ? 1 : 0.75,
                }}
              />
              <Typography
                sx={{
                  fontSize: 13,
                  fontWeight: 400,
                  color: isSelected ? "#111" : "#aaa",
                }}
              >
                {item.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export default LayerControlPanel;
