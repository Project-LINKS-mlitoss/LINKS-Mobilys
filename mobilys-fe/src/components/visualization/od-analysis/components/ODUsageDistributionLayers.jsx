// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import { CircleMarker } from "react-leaflet";
import { blue, orange, red } from "@mui/material/colors";
import { FitToData } from "./ODLeafletHelpers";

export default function ODUsageDistributionLayers({
  selectedVisualization,
  layerState,
  points,
  radiusFor,
  selectedPoint,
  selectedMode,
}) {
  if (selectedVisualization !== 0) return null;

  return (
    <>
      {layerState.stops &&
        points.map((p, idx) => (
          <CircleMarker
            key={idx}
            center={[p.lat, p.lng]}
            radius={radiusFor(p.val)}
            pathOptions={{
              color: p.name === selectedPoint?.name ? "#1976d2" : "#ffffff",
              weight: p.name === selectedPoint?.name ? 4 : 2,
              fillColor:
                selectedMode === "origin"
                  ? p.on === 0
                    ? "#bdbdbd"
                    : blue[600]
                  : selectedMode === "dest"
                    ? p.off === 0
                      ? "#bdbdbd"
                      : red[600]
                    : p.on === 0 && p.off === 0
                      ? "#bdbdbd"
                      : orange[600],
              fillOpacity: 0.9,
            }}
          />
        ))}

      <FitToData points={points} selectedPoint={selectedPoint} shouldFitBounds />
    </>
  );
}

