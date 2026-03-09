// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import { CircleMarker, Polyline } from "react-leaflet";
import { blue, red } from "@mui/material/colors";
import { VISUALIZATION } from "@/strings";
import { FitToData, HoverPopup } from "./ODLeafletHelpers";

export default function ODLastFirstStopLayers({
  selectedVisualization,
  layerState,
  lastFirstPoints,
  selectedFeature,
  lastFirstData,
  onSelectFeature,
  selectedMode,
  parentMarkerColor,
}) {
  if (selectedVisualization !== 1) return null;

  return (
    <>
      {layerState.stops &&
        lastFirstPoints.map((p, idx) => {
          let faded = false;
          if (selectedFeature || p.name) {
            const isParent = p.name === selectedFeature?.properties?.stop_name;
            const isChild = (selectedFeature?.properties?.child_features || []).some(
              (cf) => cf.properties?.stop_name === p.name
            );
            faded = !!selectedFeature && !isParent && !isChild;
          }

          const isZeroParent = p.val === 0;

          return (
            <CircleMarker
              key={idx}
              center={[p.lat, p.lng]}
              radius={6}
              pathOptions={{
                color:
                  selectedFeature?.properties?.stop_name === p.name ? "#1976d2" : "#ffffff",
                weight:
                  selectedFeature?.properties?.stop_name === p.name ? 4 : 2,
                fillColor: isZeroParent ? "#bdbdbd" : parentMarkerColor,
                fillOpacity: faded ? 0.3 : 0.9,
              }}
              eventHandlers={{
                click: () => {
                  const feature = lastFirstData?.features?.find(
                    (f) => f.properties?.stop_name === p.name
                  );
                  if (feature && typeof onSelectFeature === "function") onSelectFeature(feature);
                },
              }}
            />
          );
        })}

      <FitToData points={lastFirstPoints} selectedPoint={selectedFeature} shouldFitBounds />

      {(selectedFeature?.properties?.child_features || []).map((cf, idx) => {
        const [clng, clat] = cf.geometry.coordinates || [NaN, NaN];
        const ctotal = Number(cf.properties?.total ?? 0);
        const childMarkerColor = selectedMode === "first_stop" ? red[600] : blue[600];
        const childMarkerRadius = Math.max(6, Math.min(18, Math.sqrt(ctotal) * 2));
        const parentCoords = selectedFeature?.geometry?.coordinates || [NaN, NaN];

        return (
          <React.Fragment key={idx}>
            <Polyline
              positions={[
                [parentCoords[1], parentCoords[0]],
                [clat, clng],
              ]}
              pathOptions={{
                color: "#1976d2",
                weight: Math.max(2, Math.min(10, ctotal)),
                opacity: 0.4,
              }}
            />

            <CircleMarker
              center={[clat, clng]}
              radius={childMarkerRadius}
              pathOptions={{
                color: childMarkerColor,
                weight: 2,
                fillColor: childMarkerColor,
                fillOpacity: 0.8,
              }}
              eventHandlers={{
                mouseover: (e) => e.target.openPopup(),
                mouseout: (e) => e.target.closePopup(),
              }}
            >
              <HoverPopup>
                <strong>{cf.properties?.stop_name}</strong>
                <div>
                  {VISUALIZATION.common.labels.total}: {ctotal}
                </div>
              </HoverPopup>
            </CircleMarker>
          </React.Fragment>
        );
      })}
    </>
  );
}

