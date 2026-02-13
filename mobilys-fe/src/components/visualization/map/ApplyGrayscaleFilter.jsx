// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import { useMap } from "react-leaflet";

const DEFAULT_FILTER = "grayscale(80%) brightness(1.0)";
const DEFAULT_ENABLED_OPACITY = "0.5";
const DEFAULT_DISABLED_OPACITY = "1";

/**
 * Applies a grayscale filter to Leaflet's `tilePane`.
 *
 * Note: some maps now use server-side grayscale tiles via `ProxiedGrayTileLayer`.
 * Keep this for legacy maps that still rely on client-side CSS filters.
 */
export function ApplyGrayscaleFilter({
  enabled,
  paneName = "tilePane",
  filter = DEFAULT_FILTER,
  enabledOpacity = DEFAULT_ENABLED_OPACITY,
  disabledOpacity = DEFAULT_DISABLED_OPACITY,
}) {
  const map = useMap();

  React.useEffect(() => {
    if (!map) return;

    const applyFilter = () => {
      const tilePane = map.getPane(paneName);
      if (!tilePane) return;

      if (enabled) {
        tilePane.style.filter = filter;
        tilePane.style.webkitFilter = filter;
        tilePane.style.opacity = enabledOpacity;
      } else {
        tilePane.style.filter = "";
        tilePane.style.webkitFilter = "";
        tilePane.style.opacity = disabledOpacity;
      }
    };

    if (map._loaded) applyFilter();
    else map.whenReady(applyFilter);

    return () => {
      const tilePane = map.getPane(paneName);
      if (!tilePane) return;
      tilePane.style.filter = "";
      tilePane.style.webkitFilter = "";
      tilePane.style.opacity = DEFAULT_DISABLED_OPACITY;
    };
  }, [disabledOpacity, enabled, enabledOpacity, filter, map, paneName]);

  return null;
}

