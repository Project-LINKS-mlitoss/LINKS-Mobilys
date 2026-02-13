// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { useEffect, useMemo, useState } from "react";
import { useMap, Marker, Popup, LayerGroup } from "react-leaflet";
// Reuse *exactly* the same icon pipeline as AI
import { generateDivIcon, POI_ICON_CONFIG, PoiPopupContent } from "../poi/PoiLayer";
import { useViewportPoi } from "./hooks/useViewportPoi";
import "../poi/POIMap.css";

// ➕ same normalization as in PoiLayer / PoiMap
const normalizeType = (t) =>
  String(t ?? "")
    .trim()
    .replace(/（.*?）/g, "")
    .replace(/[()]/g, "");

// debounce helper
const debounce = (fn, ms) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

// === match AI icon behavior ===
function sizeForZoom(z) {
  if (z <= 9) return 0;
  if (z >= 16) return 24;
  if (z <= 11) return 10;
  const t = (z - 11) / (16 - 11);
  return Math.round(12 + t * (28 - 12));
}

export default function ViewportPoiLayer({
  scenarioId = undefined,
  datasetId = undefined,
  categories = undefined,
  showMLIT = true,
  showCustom = true,
  minPointZoom = 9,
  radius = 32, // kept for API compat; we now derive size from zoom
  onSelectOrigin = undefined,
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => (map ? map.getZoom() : 12));

  // Use custom hook for POI fetching
  const { features, loading, error, fetchPois } = useViewportPoi({
    scenarioId,
    datasetId,
    categories,
    showMLIT,
    showCustom,
    minPointZoom,
  });

  const iconSize = sizeForZoom(zoom);

  // Build icons using glyph/filled/color 
  const poiIcons = useMemo(() => {
    const baseSize = iconSize || 10; // ensure visible even when iconSize is 0 at low zoom
    const icons = Object.fromEntries(
      Object.entries(POI_ICON_CONFIG).map(([type, cfg]) => [
        type,
        generateDivIcon({
          glyph: cfg?.glyph || "location_on",
          filled: cfg?.filled ?? true,
          variant: "outlined",
          size: baseSize,
          color: cfg?.color || "#e53935",
        }),
      ])
    );

    // default fallback "location_on" icon 
    icons.default = generateDivIcon({
      glyph: "location_on",
      filled: true,
      variant: "outlined",
      size: baseSize,
      color: "#e53935",
    });

    return icons;
  }, [iconSize]);

  // Debounced fetch function
  const debouncedFetch = useMemo(
    () => debounce((currentZoom) => fetchPois(currentZoom), 250),
    [fetchPois]
  );

  // Handle zoom changes
  useEffect(() => {
    if (!map) return;

    const handleZoomEnd = () => {
      const z = map.getZoom();
      setZoom(z);
      debouncedFetch(z);
    };

    // Initial fetch
    debouncedFetch(map.getZoom());

    map.on("zoomend", handleZoomEnd);
    return () => {
      map.off("zoomend", handleZoomEnd);
    };
  }, [map, debouncedFetch]);

  // Log errors to console (component-level error handling)
  useEffect(() => {
    if (error) {
      console.error("[ViewportPoiLayer] Error fetching POIs:", error);
    }
  }, [error]);

  const validFeatures = useMemo(
    () =>
      features.filter(
        (f) => Number.isFinite(f.lat) && Number.isFinite(f.lon)
      ),
    [features]
  );

  return (
    <LayerGroup pane="poi-pane">
      {validFeatures.map((f) => {
        const lat = Number(f.lat);
        const lon = Number(f.lon);

        const typeKey = normalizeType(f.category);
        const icon = typeKey
          ? poiIcons[typeKey] || poiIcons.default
          : poiIcons.default;

        const popup = (
          <Popup className="rn-popup">
            <PoiPopupContent
              poi={{
                name: f.title,
                type: typeKey,
                lat,
                lng: lon,
                address: f.address ?? null,
              }}
              onSelectOrigin={onSelectOrigin}
            />
          </Popup>
        );

        return (
          <Marker key={f.id} position={[lat, lon]} icon={icon} pane="poi-pane">
            {popup}
          </Marker>
        );
      })}
    </LayerGroup>
  );
}
