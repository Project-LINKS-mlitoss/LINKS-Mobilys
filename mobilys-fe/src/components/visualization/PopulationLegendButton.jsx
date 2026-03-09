// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { useMemo, useRef, useState, useEffect } from "react";
import L from "leaflet";
import { Box, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { VISUALIZATION } from "@/strings";
import { getPopulationBins, POPULATION_COLORS } from "./map/mapColorUtils";

function hexToRgba(hex, alpha = 0.4) {
  if (!hex) return hex;
  const mHex = /^#?([a-f0-9]{6})$/i.exec(hex);
  if (!mHex) return hex;
  const int = parseInt(mHex[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

const PopulationLegendButton = ({ activeKey = "population" }) => {
  const [showLegend, setShowLegend] = useState(false);
  const containerRef = useRef();

  useEffect(() => {
    if (containerRef.current) {
      L.DomEvent.disableClickPropagation(containerRef.current);
      L.DomEvent.disableScrollPropagation(containerRef.current);
    }
  }, []);

  const bins = useMemo(() => getPopulationBins(activeKey), [activeKey]);
  const rangeSep = VISUALIZATION.common.dateParts.rangeSeparator;
  const peopleSuffix = VISUALIZATION.common.units.peopleSuffix;
  const orMoreSuffix = VISUALIZATION.common.units.orMoreSuffix;

  const legendItems = useMemo(() => {
    const colors = POPULATION_COLORS;
    const items = [{ label: `0 ${peopleSuffix}`, color: hexToRgba(colors[0], 0.4) }];

    for (let i = 0; i < bins.length - 1; i++) {
      const from = i === 0 ? 1 : bins[i] + 1;
      const to = bins[i + 1];
      const baseColor = colors[i];
      items.push({
        label: `${from}${rangeSep}${to} ${peopleSuffix}`,
        color: hexToRgba(baseColor, 0.4),
      });
    }

    const last = bins[bins.length - 1] + 1;
    items.push({
      label: `${last} ${peopleSuffix}${orMoreSuffix}`,
      color: hexToRgba(colors[colors.length - 1], 0.4),
    });

    return items;
  }, [bins, orMoreSuffix, peopleSuffix, rangeSep]);

  const title =
    activeKey === "population0_14"
      ? VISUALIZATION.common.map.populationLegend.title.age0To14
      : activeKey === "population15_64"
        ? VISUALIZATION.common.map.populationLegend.title.age15To64
        : activeKey === "population65_up"
          ? VISUALIZATION.common.map.populationLegend.title.age65Up
          : VISUALIZATION.common.map.populationLegend.title.total;

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        bottom: 33,
        right: 100,
        zIndex: 1000,
      }}
    >
      {/* Info Button */}
      <IconButton
        data-html2canvas-ignore
        onClick={() => setShowLegend((prev) => !prev)}
        aria-label={showLegend ? VISUALIZATION.common.map.labels.legendHide : VISUALIZATION.common.map.labels.legendShow}
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
          info
        </span>
      </IconButton>

      {/* Legend */}
      {showLegend && (
        <div
          className="map-legend-card"
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            background: "#fff",
            borderRadius: 8,
            padding: "8px 12px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            zIndex: 1001,
            width: 190,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <strong style={{ flex: 1 }}>{title}</strong>

            <Box
              sx={{
                position: "absolute",
                top: 6,
                right: 8,
                cursor: "pointer",
                color: "#888",
                zIndex: 1,
              }}
              onClick={() => setShowLegend(false)}
              title={VISUALIZATION.common.dialog.close}
            >
              <CloseIcon fontSize="small" />
            </Box>
          </div>

          <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0 0" }}>
            {legendItems.map((item, index) => (
              <li
                key={index}
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 4,
                  fontSize: "14px",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 14,
                    height: 14,
                    background: item.color,
                    // opacity: item.opacity ?? 1,
                    border: "1px solid #999",
                    marginRight: 8,
                    borderRadius: 3, // optional: round corners a bit
                  }}
                />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
};

export default PopulationLegendButton;
