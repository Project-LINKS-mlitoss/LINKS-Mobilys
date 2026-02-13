// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import { Marker, Polyline } from "react-leaflet";
import { BLANK_DIVICON } from "../../buffer-analysis/BufferAnalysisMap";
import RouteLabelTooltip from "../../RouteLabelTooltip";
import StopLabelTooltip from "../../StopLabelTooltip";

export default function ODBaseMapLayers({
  hasBase,
  layerState,
  routeFeatures,
  uniqueRouteLabels,
  selectedVisualization,
  currentStopOptions,
}) {
  return (
    <>
      {hasBase &&
        (layerState.edges || layerState.routeColors) &&
        routeFeatures.map((feature, idx) => {
          const colorHex = feature.properties?.keyword_colors?.[0]
            ? `#${String(feature.properties.keyword_colors[0]).replace(/^#?/, "")}`
            : "#1976d2";

          const finalColor = layerState.routeColors ? colorHex : "#58AB39";

          const positions = feature.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
          return (
            <Polyline
              pane="od-map-routes-pane"
              key={feature.properties?.route_id || feature.properties?.shape_id || idx}
              positions={positions}
              pathOptions={{ color: finalColor, weight: 5, opacity: 0.7 }}
              interactive={false}
            />
          );
        })}

      {layerState.routeLabels &&
        uniqueRouteLabels.map((item, i) => {
          if (!item.latlng) return null;

          const defaultColor = "#58AB39";
          const color =
            layerState.routeColors && item.color ? item.color : defaultColor;

          return (
            <Marker
              key={`od-unique-route-label-${i}`}
              position={item.latlng}
              icon={BLANK_DIVICON}
              pane="od-map-routes-labels-pane"
              interactive={false}
            >
              <RouteLabelTooltip
                pane="od-map-route-tooltip-pane"
                labels={[item.label]}
                color={color}
                direction="center"
                offset={[0, 0]}
              />
            </Marker>
          );
        })}

      {selectedVisualization !== 2 &&
        layerState.stopLabels &&
        currentStopOptions.map((s, i) => {
          const { lat, lng, label } = s || {};
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || !label) return null;
          return (
            <Marker
              key={`stop-label-${i}`}
              position={[lat, lng]}
              icon={BLANK_DIVICON}
              pane="od-map-stop-labels-pane"
            >
              <StopLabelTooltip
                stopName={label}
                direction="top"
                offset={[0, -10]}
                pane="od-map-stop-tooltip-pane"
              />
            </Marker>
          );
        })}
    </>
  );
}

