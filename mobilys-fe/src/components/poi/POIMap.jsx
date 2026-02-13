// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
// src/components/poi/POIMap.jsx
import React, { useMemo, useEffect, useState } from "react";
import { MapContainer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Box } from "@mui/material";
import { VISUALIZATION } from "@/strings";
import { POI_ICON_CONFIG, POI_MAP_DEFAULTS } from "@/constant";
import { MapTileLayer } from "../MapTileLayer";
import { MapEvents } from "../visualization/map/MapEvents";
import "./POIMap.css";

// Match other maps: show "Leaflet" as prefix in the attribution control
L.Control.Attribution.prototype.options.prefix =
  '<a href="https://leafletjs.com" target="_blank" rel="noreferrer">Leaflet</a>';

export { POI_ICON_CONFIG };

function stopLikeDiameter(zoom) {
  const size = Math.max(8, Math.min(12, Math.round(12 + 1.0 * (zoom - 12))));
  const border = Math.max(1, Math.round(size * 0.22));
  return size + 2 * border;
}

/** PURE Material-Symbols Leaflet divIcon (no MUI), with strong guards */
// Use classic Material Icons (always filled) so html2canvas renders them correctly
export function symbolDivIcon({
  glyph = "location_on",
  size,
  color = "#e53935",
}) {
  const px = Number.isFinite(Number(size)) ? Number(size) : 24;
  const safeGlyph =
    typeof glyph === "string" && glyph.trim().length > 0
      ? glyph.trim()
      : "location_on";

  const html = `
    <span
      class="material-icons"
      style="
        font-size:${px}px;
        color:${color};
      "
      aria-hidden="true"
    >${safeGlyph}</span>
  `;

  return L.divIcon({
    ...POI_MAP_DEFAULTS.BASE_DIV_ICON_OPTS,
    html,
    iconSize: [px, px],
    iconAnchor: [px / 2, px],
  });
}

// Back-compat for any other file importing this name
export const generateDivIcon = (opts) => symbolDivIcon(opts);

function FitOrCenter({ points, fallbackCenter, fallbackZoom }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      if (bounds.isValid() && bounds.getNorthEast().equals(bounds.getSouthWest())) {
        map.setView(bounds.getNorthEast(), Math.max(map.getZoom(), 14));
      } else if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [24, 24] });
      }
    } else {
      map.setView(fallbackCenter, fallbackZoom);
    }
  }, [points, fallbackCenter, fallbackZoom, map]);
  return null;
}

function safeNum(n) {
  const v = parseFloat(n);
  return Number.isFinite(v) ? v : null;
}

const GSI_ATTR = VISUALIZATION.common.map.attributions.gsi;

export function PoiMap({ data = [] }) {
  const validPois = useMemo(
    () =>
      (data || []).filter((d) => {
        const la = safeNum(d.lat);
        const ln = safeNum(d.lng);
        return la !== null && ln !== null;
      }),
    [data]
  );

  const fitPoints = useMemo(
    () => validPois.map((p) => [Number(p.lat), Number(p.lng)]),
    [validPois]
  );

  const [zoom, setZoom] = useState(POI_MAP_DEFAULTS.ZOOM);
  const iconSizePx = useMemo(() => stopLikeDiameter(zoom), [zoom]);

  /** Build icons + safe defaults (never missing glyph/size/color) */
  const poiIcons = useMemo(() => {
    const icons = Object.fromEntries(
      Object.entries(POI_ICON_CONFIG).map(([type, cfg]) => [
        type,
        symbolDivIcon({
          glyph: cfg?.glyph || "location_on",
          size: iconSizePx,
          color: cfg?.color || "#e53935",
        }),
      ])
    );

    // fallback: default (location pin) and unknown ('?')
    icons.default = symbolDivIcon({
      glyph: "location_on",
      size: iconSizePx,
      color: "#e53935",
    });
    icons.unknown = symbolDivIcon({
      glyph: "?",
      size: iconSizePx,
      color: "#d32f2f",
    });

    return icons;
  }, [iconSizePx]);

  const labels = VISUALIZATION.common.map.labels;

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        position: "relative",
        "& .leaflet-container": {
          width: "100%",
          height: "100%",
          borderRadius: 2,
        },
        "& .leaflet-control-attribution": {
          marginRight: "16px",
          marginBottom: "110px",
        },
      }}
    >
      <MapContainer
        center={POI_MAP_DEFAULTS.CENTER}
        zoom={POI_MAP_DEFAULTS.ZOOM}
        style={{ height: "100%", width: "100%" }}
        attributionControl={true}
      >
        <MapTileLayer
          errorTileUrl="data:image/gif;base64,R0lGODlhAQABAAAAACw="
          noWrap
          attribution={GSI_ATTR}
        />

        <FitOrCenter
          points={fitPoints}
          fallbackCenter={POI_MAP_DEFAULTS.CENTER}
          fallbackZoom={POI_MAP_DEFAULTS.ZOOM}
        />

        <MapEvents onZoomChange={setZoom} />

        {validPois.map((poi) => {
          const pos = [Number(poi.lat), Number(poi.lng)];
          const typeKey = (poi.type ?? "").trim().replace(/（.*?）/g, "").replace(/[()]/g, "");

          let icon = poiIcons[typeKey] || poiIcons.default;
          const glyph = POI_ICON_CONFIG[typeKey]?.glyph;

          if (!POI_ICON_CONFIG[typeKey]) {
            // fallback handled by icons.default
          } else if (!glyph) {
            icon = poiIcons.unknown;
          }

          return (
            <Marker key={poi.id ?? `${poi.name}-${pos.join(",")}`} position={pos} icon={icon}>
              <Popup>
                <strong>{poi.name}</strong>
                <br />
                {labels.poiType}: {poi.type ?? VISUALIZATION.common.emptyState.noMatches}
                <br />
                {labels.lat}: {poi.lat}
                <br />
                {labels.lng}: {poi.lng}
                <br />
                {labels.remark}: {poi.remark ? poi.remark : labels.none}
                <br />
                {labels.csvFile}: {poi.fileName ? poi.fileName : VISUALIZATION.common.emptyState.noMatches}
              </Popup>
            </Marker>
          );
        })}

        {validPois.length === 0 && (
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              padding: "6px 10px",
              background: "rgba(255,255,255,0.9)",
              borderRadius: 8,
              fontSize: 12,
              boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
              pointerEvents: "none",
            }}
          >
            {labels.noPoiData}
          </div>
        )}
      </MapContainer>
    </Box>
  );
}

export default PoiMap;
