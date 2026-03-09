// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
// src/components/visualization/StopLabelTooltip.jsx
import React, { useEffect } from "react";
import { Tooltip } from "react-leaflet";

/**
 * A consistent, self-styled tooltip for stop labels.
 * - Same look on every screen (injects its own CSS once).
 * - Works for permanent labels and click-to-show cases.
 */
let __mobilyTooltipCSSInjected = false;

function ensureTooltipCSS() {
  if (__mobilyTooltipCSSInjected) return;
  const css = `
  /* Base bubble */
  .leaflet-tooltip.mbl-bubble {
    background: #ffffff !important;
    color: var(--mbl-tooltip-color, #1b2711ff) !important;
    border: 1px solid rgba(0,0,0,0.08) !important;
    border-radius: 12px !important;
    padding: 6px 10px !important;
    line-height: 1.25;
    font-weight: 700;
    font-size: 14px;
    white-space: nowrap;
    box-shadow: 0 6px 16px rgba(0,0,0,0.12) !important;
    pointer-events: none;
  }

  /* Tail */
  .leaflet-tooltip.mbl-bubble::after {
    content: "";
    position: absolute;
    width: 10px; height: 10px;
    background: #ffffff;
    border: 1px solid rgba(0,0,0,0.08);
    box-shadow: 0 6px 16px rgba(0,0,0,0.12);
    transform: rotate(45deg);
    border-left: none; border-top: none;
  }
  .leaflet-tooltip.mbl-bubble.mbl-dir-top::after    { bottom: -6px; left: 50%; transform: translateX(-50%) rotate(45deg); }
  .leaflet-tooltip.mbl-bubble.mbl-dir-bottom::after { top: -6px;    left: 50%; transform: translateX(-50%) rotate(45deg); }
  .leaflet-tooltip.mbl-bubble.mbl-dir-left::after   { right: -6px;  top: 50%;  transform: translateY(-50%) rotate(45deg); }
  .leaflet-tooltip.mbl-bubble.mbl-dir-right::after  { left: -6px;   top: 50%;  transform: translateY(-50%) rotate(45deg); }
  .leaflet-tooltip.mbl-bubble.mbl-dir-center::after { display: none; }
  `;
  const style = document.createElement("style");
  style.setAttribute("data-mobily-tooltip", "true");
  style.innerHTML = css;
  document.head.appendChild(style);
  __mobilyTooltipCSSInjected = true;
}

export default function StopLabelTooltip({
  stopName,
  text,                 // optional alias
  direction = "top",    // "top" | "bottom" | "left" | "right" | "center"
  offset = [0, -10],
  permanent = true,
  textColor,
  pane,                 // optional pane; if omitted, Leaflet uses default tooltipPane
}) {
  const label = (text ?? stopName ?? "").trim();
  if (!label) return null;

  useEffect(ensureTooltipCSS, []);

  const dirClass =
    direction === "bottom" ? "mbl-dir-bottom" :
    direction === "left"   ? "mbl-dir-left"   :
    direction === "right"  ? "mbl-dir-right"  :
    direction === "center" ? "mbl-dir-center" : "mbl-dir-top";

  const bubbleStyle = textColor ? { "--mbl-tooltip-color": textColor } : undefined;
  const labelStyle = textColor ? { color: textColor } : undefined;

  // Only pass the pane prop if provided; otherwise omit it so Leaflet uses default pane
  const tooltipProps = {
    direction,
    offset,
    permanent,
    opacity: 1,
    className: `mbl-bubble ${dirClass}`,
    style: bubbleStyle,
  };
  if (typeof pane === "string" && pane) {
    tooltipProps.pane = pane;
  }

  return (
    <Tooltip {...tooltipProps}>
      <span style={labelStyle}>{label}</span>
    </Tooltip>
  );
}
