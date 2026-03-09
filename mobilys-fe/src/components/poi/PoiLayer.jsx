// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { useMemo } from "react";
import { Marker, Popup, Pane } from "react-leaflet";
import Button from "@mui/material/Button";
import { VISUALIZATION } from "@/strings";
import { POI_LAYER } from "@/constant";
import { generateDivIcon, POI_ICON_CONFIG } from "./POIMap";

const normalizeType = (t) =>
  String(t ?? "")
    .trim()
    .replace(/（.*?）/g, "")
    .replace(/[()]/g, "");

export { generateDivIcon, POI_ICON_CONFIG };

export function PoiPopupContent({ poi, onSelectOrigin }) {
  const lat = Number(poi.lat);
  const lng = Number(poi.lng);

  return (
    <div style={{ lineHeight: 1.3 }}>
      <strong style={{ display: "block", fontSize: 18, marginBottom: 8 }}>
        {poi.name}
      </strong>
      <div style={{ fontSize: 12, marginBottom: 12 }}>
        {VISUALIZATION.common.map.labels.poiType}: {poi.type}
      </div>

      {typeof onSelectOrigin === "function" && (
        <Button
          variant="contained"
          color="primary"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSelectOrigin(lat, lng, poi.name);
          }}
          sx={{
            borderRadius: "9999px",
            textTransform: "none",
            fontWeight: 700,
            px: 2.5,
            py: 1,
            boxShadow: 1,
          }}
        >
          {VISUALIZATION.common.map.labels.setAsOrigin}
        </Button>
      )}
    </div>
  );
}

export function PoiLayer({ pois = [], radius = 32, onSelectOrigin }) {
  // icons for configured types
  const poiIcons = useMemo(() => {
    const icons = Object.fromEntries(
      Object.entries(POI_ICON_CONFIG).map(([type, cfg]) => [
        type,
        generateDivIcon({
          glyph: cfg?.glyph || POI_LAYER.DEFAULT_GLYPH,
          filled: cfg?.filled ?? true,
          variant: "outlined",
          size: radius,
          color: cfg?.color || POI_LAYER.DEFAULT_COLOR,
        }),
      ])
    );

    return icons;
  }, [radius]);

  // generic fallback icon used when type not in POI_ICON_CONFIG
  const fallbackIcon = useMemo(
    () =>
      generateDivIcon({
        glyph: POI_LAYER.DEFAULT_GLYPH,
        filled: true,
        variant: "outlined",
        size: radius,
        color: POI_LAYER.DEFAULT_COLOR,
      }),
    [radius]
  );

  return (
    <>
      <Pane name="poiPane" style={{ zIndex: POI_LAYER.Z_INDEX }} />

      {pois.map((poi) => {
        const lat = parseFloat(poi.lat);
        const lng = parseFloat(poi.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        const pos = [lat, lng];

        const typeKey = normalizeType(poi.type);
        const icon = poiIcons[typeKey] ?? fallbackIcon;

        return (
          <Marker
            key={poi.id ?? `${poi.type}-${lat}-${lng}`}
            position={pos}
            icon={icon}
            pane="poiPane"
          >
            <Popup className="buffer-popup">
              <PoiPopupContent poi={poi} onSelectOrigin={onSelectOrigin} />
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
