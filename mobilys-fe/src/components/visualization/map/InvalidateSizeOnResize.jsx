// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import { useMap } from "react-leaflet";

/**
 * Observes a DOM element size and calls `map.invalidateSize()` when it changes.
 *
 * Notes:
 * - `deps` is for external triggers (e.g., panel collapse) where size might change
 *   without a ResizeObserver callback timing the way we want.
 */
export function InvalidateSizeOnResize({ targetRef, deps = [] }) {
  const map = useMap();

  React.useEffect(() => {
    const el = targetRef?.current;
    if (!el) return;

    if (typeof ResizeObserver === "undefined") {
      const onResize = () => requestAnimationFrame(() => map.invalidateSize());
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }

    const ro = new ResizeObserver(() => requestAnimationFrame(() => map.invalidateSize()));
    ro.observe(el);
    return () => ro.disconnect();
  }, [map, targetRef]);

  React.useEffect(() => {
    requestAnimationFrame(() => map.invalidateSize());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ...deps]);

  return null;
}

