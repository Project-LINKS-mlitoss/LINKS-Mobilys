// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
// src/components/visualization/StopMarkerLayer.jsx
import React, { useState, useRef, useEffect } from "react";
import L from "leaflet";
import { Marker, useMap } from "react-leaflet";
import StopLabelTooltip from "./StopLabelTooltip";

export default function StopMarkerLayer({
  stopGeojson,
  show = true,
  showLabels = false,
  onStopSelect,          
  tooltipPane,           //pane for tooltips
  pane = "markerPane",   
}) {
  if (!stopGeojson || !show) return null;

  const features = Array.isArray(stopGeojson.features) ? stopGeojson.features : [];

  // Keep marker size stable across zooms
  const map = useMap();
  const [zoom, setZoom] = useState(() => (map?.getZoom?.() ?? 13));
  useEffect(() => {
    if (!map) return;
    const onZoom = () => setZoom(map.getZoom());
    setZoom(map.getZoom());
    map.on("zoomend", onZoom);
    return () => map.off("zoomend", onZoom);
  }, [map]);

  const computeSize = (z) => {
    const s = Math.round(6 + 0.9 * (z - 12));
    const clamped = Math.max(3, Math.min(9, s));
    const border = Math.max(1, Math.round(clamped * 0.22));
    return { size: clamped, border };
  };
  const { size: markerSize, border: borderPx } = computeSize(zoom);

  // Transient click-tooltip (when no onStopSelect is provided)
  const [clickTooltipKey, setClickTooltipKey] = useState(null);
  const hideTimerRef = useRef(null);
  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const handleMarkerClick = (props, key) => {
    if (typeof onStopSelect === "function") {
      onStopSelect(props);
      return; // no bubble when a handler exists
    }
    clearHideTimer();
    setClickTooltipKey(String(key));
    hideTimerRef.current = setTimeout(() => {
      setClickTooltipKey(null);
      hideTimerRef.current = null;
    }, 2000);
  };

  return (
    <>
      {features
        .filter((f) => f?.geometry?.type === "Point")
        .map((f, idx) => {
          const [lng, lat] = f.geometry.coordinates || [];
          const p = f.properties || {};
          const name = p.stop_name ?? p.parent_stop ?? p.name ?? p.label ?? "";
          const key = p.stop_id ?? p.id ?? p.code ?? `${lat},${lng},${idx}`;
          const clickable = typeof onStopSelect === "function";

          const html = `<div style="
              background:#2c3e50;
              border:${borderPx}px solid #f8fafd;
              border-radius:50%;
              width:${markerSize}px;height:${markerSize}px;
              ${clickable ? "cursor:pointer" : ""}
            "></div>`;

          return (
            <Marker
              key={String(key)}
              position={[Number(lat), Number(lng)]}
              pane={pane} 
              eventHandlers={{ click: () => handleMarkerClick(p, key) }}
              icon={L.divIcon({
                className: "",
                html,
                iconSize: [markerSize, markerSize],
                iconAnchor: [markerSize / 2, markerSize / 2],
              })}
            >
              {/* Permanent labels if requested */}
              {showLabels && name ? (
                <StopLabelTooltip pane={tooltipPane} stopName={name} />
              ) : null}

              {/* Fallback tooltip on click (only when no onStopSelect) */}
              {!showLabels &&
                !clickable &&
                clickTooltipKey === String(key) &&
                name && (
                  <StopLabelTooltip pane={tooltipPane} stopName={name} />
                )}
            </Marker>
          );
        })}
    </>
  );
}
