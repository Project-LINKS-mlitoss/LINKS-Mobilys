// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import { useMap, useMapEvents } from "react-leaflet";

/**
 * Common map event bindings for "last interaction" tracking and zoom-dependent UI.
 */
export function MapEvents({ onZoomChange, onMoveOrZoomEnd }) {
  const map = useMap();

  useMapEvents({
    zoomend(e) {
      const z = e?.target?.getZoom?.() ?? map.getZoom();
      onZoomChange?.(z);
      onMoveOrZoomEnd?.();
    },
    moveend() {
      onMoveOrZoomEnd?.();
    },
  });

  return null;
}

