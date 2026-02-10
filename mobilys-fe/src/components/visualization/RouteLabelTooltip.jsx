// RouteLabelTooltip.jsx
import React from "react";
import { Tooltip } from "react-leaflet";

/**
 * RouteLabelTooltip
 * Props:
 * - labels?: string[]   // e.g. feature.properties.keywords
 * - label?: string      // alternative single string
 * - color?: string      // optional text color (defaults to dark gray)
 */
export default function RouteLabelTooltip({
  labels,
  label,
  color = "#111827", // gray-900 default
  direction = "center",
  offset = [0, 0],
  pane = "route-tooltip-pane",
}) {
  const text = Array.isArray(labels) ? labels.join(", ") : (label ?? "");
  if (!text) return null;

  return (
    <Tooltip
      pane={pane}
      direction={direction}
      permanent
      opacity={1}
      offset={offset}
      className="route-label-tooltip"
    >
      <span
        style={{
          display: "inline-block",
          background: "rgba(255,255,255,0.92)",
          border: "1px solid rgba(17,24,39,0.08)", // subtle border
          borderRadius: 8,
          padding: "2px 8px",
          lineHeight: 1.15,
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
          color,
          fontWeight: 600,
          fontSize: 12,
          whiteSpace: "nowrap",
          pointerEvents: "none",
        }}
      >
        {text}
      </span>
    </Tooltip>
  );
}
