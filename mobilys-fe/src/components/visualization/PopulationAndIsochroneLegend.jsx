// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { useEffect, useMemo, useRef, useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import { Box } from "@mui/material";
import { IconButton } from "@mui/material";
import L from "leaflet";
import { VISUALIZATION } from "@/strings";
import { getPopulationBins, pickPopulationColor } from "./map/mapColorUtils";

function toRgba(color, alpha = 0.3) {
  if (!color) return color;
  const a = Math.max(0, Math.min(1, alpha));
  const mRgb = /rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i.exec(color);
  if (mRgb) return `rgba(${mRgb[1]}, ${mRgb[2]}, ${mRgb[3]}, ${a})`;

  const mHex = /^#?([a-f0-9]{6})$/i.exec(color);
  if (mHex) {
    const int = parseInt(mHex[1], 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return color;
}

function sampleLegendMinutes(minutesArr = [], maxSteps = 8) {
  const uniq = Array.from(new Set(minutesArr.filter(Number.isFinite))).sort((a, b) => a - b);
  if (uniq.length <= maxSteps) return uniq;
  const out = [];
  for (let i = 0; i < maxSteps; i++) {
    const idx = Math.round((uniq.length - 1) * (i / (maxSteps - 1)));
    out.push(uniq[idx]);
  }
  return Array.from(new Set(out)).sort((a, b) => a - b);
}

export default function PopulationAndIsochroneLegend({
  /** Population legend key */
  activeKey = "population", // "population" | "population0_14" | "population15_64" | "population65_up"

  /** Isochrone inputs (optional). If not provided, only population legend is shown. */
  isoMinutes = [],            // array of minute thresholds present on the map
  getIsoColor,                // function(minutes) => color used on the map
  isoOpacity = 0.3,           // legend swatch opacity (supports dynamic value)
  isoCutoffMinutes = null,    // highlight bands <= cutoff (e.g., currently visible)
  isoTitle = VISUALIZATION.bufferAnalysis.components.map.layers.buffer,
  maxIsoRows = 8,

  /** UI options */
  openDefault = false,
  showToggleButton = true,
  position = { bottom: 33, right: 100 },
  cardWidth = 220,
  zIndex = 1000,
}) {
  const [open, setOpen] = useState(openDefault);
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    L.DomEvent.disableClickPropagation(ref.current);
    L.DomEvent.disableScrollPropagation(ref.current);
  }, []);

  const bins =
    getPopulationBins(activeKey);

  const popItems = useMemo(() => {
    const sep = VISUALIZATION.common.dateParts.rangeSeparator;
    const people = VISUALIZATION.common.units.peopleSuffix;
    const orMore = VISUALIZATION.common.units.orMoreSuffix;

    // Use the same bins/colors as map rendering to keep legend consistent.
    const items = [];

    for (let i = 0; i < bins.length - 1; i++) {
      const from = i === 0 ? 0 : bins[i] + 1;
      const to = bins[i + 1];
      const label = `${from}${sep}${to} ${people}`;
      const sampleValue = i === 0 ? 0 : from; // stable representative
      items.push({
        label,
        color: toRgba(pickPopulationColor(sampleValue, activeKey), 0.4),
      });
    }

    // last: > max bin
    const lastFrom = bins[bins.length - 1] + 1;
    items.push({
      label: `${lastFrom} ${people}${orMore}`,
      color: toRgba(pickPopulationColor(lastFrom, activeKey), 0.4),
    });

    return items;
  }, [activeKey, bins]);

  const popTitle =
    activeKey === "population"
      ? VISUALIZATION.common.map.populationLegend.title.total
      : activeKey === "population0_14"
        ? VISUALIZATION.common.map.populationLegend.title.age0To14
        : activeKey === "population15_64"
          ? VISUALIZATION.common.map.populationLegend.title.age15To64
          : VISUALIZATION.common.map.populationLegend.title.age65Up;

  const hasIso = Array.isArray(isoMinutes) && isoMinutes.length > 0 && typeof getIsoColor === "function";
  const sampled = useMemo(() => sampleLegendMinutes(isoMinutes, maxIsoRows), [isoMinutes, maxIsoRows]);
  const isoDisplay = useMemo(() => [...sampled].sort((a, b) => b - a), [sampled]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        ...(position.top !== undefined ? { top: position.top } : { bottom: position.bottom }),
        ...(position.left !== undefined ? { left: position.left } : { right: position.right }),
        zIndex,
      }}
    >
      {showToggleButton && (
        <IconButton
          data-html2canvas-ignore
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? VISUALIZATION.common.map.labels.legendHide : VISUALIZATION.common.map.labels.legendShow}
          sx={{
            width: 48,
            height: 48,
            minWidth: 0,
            minHeight: 0,
            backgroundColor: "rgba(255,255,255,0.98)",
            border: "1px solid #ddd",
            borderRadius: 3,
            boxShadow: 3,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: 0,
            cursor: "pointer",
            "&:hover": {
              backgroundColor: "rgba(255,255,255,1)",
            },
          }}
        >
          <span className="material-symbols-outlined outlined">
            Info
          </span>
        </IconButton>
      )}

      {/* Legend card */}
      {open && (
        <div
          data-pop-iso-legend-card
          style={{
            position: "absolute",
            bottom: showToggleButton ? 0 : undefined,
            right: 0,
            background: "#fff",
            borderRadius: 8,
            padding: "8px 12px",
            boxShadow: "none",
            width: cardWidth,
            opacity: 1,
            mixBlendMode: "normal"
          }}
        >
          {/* Title + Close */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong style={{ flex: 1 }}>{popTitle}</strong>
            <Box
              sx={{ position: "absolute", top: 6, right: 8, cursor: "pointer", color: "#888", zIndex: 1 }}
              onClick={() => setOpen(false)}
              title={VISUALIZATION.common.dialog.close}
            >
              <CloseIcon fontSize="small" />
            </Box>
          </div>

          {/* Population section */}
          <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0 0" }}>
            {popItems.map((it, idx) => (
              <li key={`pop-${idx}`} style={{ display: "flex", alignItems: "center", marginBottom: 4, fontSize: 14 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 14,
                    height: 14,
                    background: it.color,
                    // opacity: it.opacity ?? 1,
                    border: "1px solid #999",
                    marginRight: 8,
                    borderRadius: 3,
                  }}
                />
                {it.label}
              </li>
            ))}
          </ul>

          {/* Divider */}
          {hasIso && <div style={{ height: 1, background: "#e5e5e5", margin: "10px 0 8px" }} />}

          {/* Isochrone section */}
          {hasIso && (
            <>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{isoTitle}</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {isoDisplay.map((m) => {
                  const swatch = toRgba(getIsoColor(m), isoOpacity ?? 0.3);
                  const active = Number.isFinite(isoCutoffMinutes) ? m <= isoCutoffMinutes : false;
                  return (
                    <li
                      key={`iso-${m}`}
                      style={{ display: "flex", alignItems: "center", marginBottom: 4, fontSize: 14 }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          width: 14,
                          height: 14,
                          background: swatch,
                          border: active ? "2px solid #444" : "1px solid #999",
                          marginRight: 8,
                          borderRadius: 3,
                        }}
                      />
                      {Math.round(m)}
                      {VISUALIZATION.bufferAnalysis.components.map.time.withinMinutesSuffix}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
