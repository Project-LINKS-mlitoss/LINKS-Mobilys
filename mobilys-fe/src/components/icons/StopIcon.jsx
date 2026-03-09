// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";

export const StopIcon = ({
  color = "#1976D2",
  fontSize = 35,
  className = "material-symbols-outlined filled",
  style,
  children = "location_on",
  ...rest
}) => {
  return (
    <span
      className={className}
      style={{
        color,
        fontSize,
        lineHeight: 1,
        display: "inline-block",
        ...(style || {}),
      }}
      {...rest}
    >
      {children}
    </span>
  );
};

// Alias for clarity when used as a Leaflet "location_on" marker.
export const StopLocationOnIcon = StopIcon;

export const stopLocationOnIconHtml = ({
  color = "#1976D2",
  fontSize = 35,
  className = "material-symbols-outlined filled",
} = {}) => {
  const safeColor = String(color);
  const safeFontSize = Number(fontSize);
  const safeClassName = String(className);

  return `
    <span class="${safeClassName}"
      style="
        color:${safeColor};
        font-size:${Number.isFinite(safeFontSize) ? safeFontSize : 35}px;
        line-height:1;
        display:inline-block;
      "
    >
      location_on
    </span>
  `;
};

// Helper for Leaflet: pass into L.divIcon(stopLocationOnDivIconOptions())
export const stopLocationOnDivIconOptions = (opts = {}) => {
  return {
    className: "",
    html: stopLocationOnIconHtml(opts),
    iconAnchor: [14, 28],
  };
};

export default StopIcon;
