import React, { useState, useRef } from "react";
import { GeoJSON, Marker } from "react-leaflet";
import L from "leaflet";

import StopLabelTooltip from "../../visualization/StopLabelTooltip";
import RouteLabelTooltip from "../../visualization/RouteLabelTooltip";
import { blue, red } from "@mui/material/colors";
import { SIMULATION } from "@/strings";

const legendStrings = SIMULATION.carRouting.legend;

export default function MapElement({
  data,
  color = "#000",
  weight = 4,
  active = false,
  activeWeight = 6,
  opacity = 0.95,
  onClick,

  label,
  showRouteLabels = false,
  routeLabelDirection = "center",
  routeLabelOffset = [0, 0],
  routeLabelPane = "route-tooltip-pane",

  start,
  end,
  showStops = true,
  showStopLabels = true,
  startLabel = legendStrings.start,
  endLabel = legendStrings.end,
  stopLabelDirection = "top",
  stopLabelOffset = [0, -10],

  onEndpointSelect,
}) {
  const [flashKey, setFlashKey] = useState(null); // "start" | "end" | null
  const hideTimerRef = useRef(null);
  const endpointColors = { start: blue[600], end: red[600] };

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const handleEndpointClick = (type, lat, lon, lbl) => {
    if (typeof onEndpointSelect === "function") {
      onEndpointSelect({ type, lat, lon, label: lbl });
      return;
    }
    clearHideTimer();
    setFlashKey(type);
    hideTimerRef.current = setTimeout(() => {
      setFlashKey(null);
      hideTimerRef.current = null;
    }, 2000);
  };

  const divIcon = (type, clickable) =>
    L.divIcon({
      className: "",
      html: `<div style="
        background:${endpointColors[type] ?? "#2c3e50"};
        border:2px solid #f8fafd;
        border-radius:50%;
        width:10px;height:10px;
        ${clickable ? "cursor:pointer" : ""}
      "></div>`,
      iconSize: [10, 10],
      iconAnchor: [5, 5],
    });

  const clickable = typeof onEndpointSelect === "function";

  const renderEndpointMarker = (type, point, lbl) => {
    if (!point) return null;
    const lat = Number(point.lat);
    const lon = Number(point.lon);

    return (
      <Marker
        key={`endpoint-${type}-${lat},${lon}`}
        position={[lat, lon]}
        eventHandlers={{ click: () => handleEndpointClick(type, lat, lon, lbl) }}
        icon={divIcon(type, clickable)}
      >
        {showStopLabels && lbl ? (
          <StopLabelTooltip
            text={lbl}
            textColor={endpointColors[type] ?? "#2c3e50"}
            direction={stopLabelDirection}
            offset={stopLabelOffset}
            permanent
          />
        ) : null}

        {!showStopLabels && !clickable && flashKey === type && lbl ? (
          <StopLabelTooltip
            text={lbl}
            textColor={endpointColors[type] ?? "#2c3e50"}
            direction={stopLabelDirection}
            offset={stopLabelOffset}
          />
        ) : null}
      </Marker>
    );
  };

  const hasRouteLabel = showRouteLabels && label;

  return (
    <GeoJSON
      data={data}
      style={{
        color,
        weight: active ? activeWeight : weight,
        opacity,
      }}
      eventHandlers={onClick ? { click: onClick } : undefined}
    >
      {hasRouteLabel && (
        <RouteLabelTooltip
          pane={routeLabelPane}
          labels={[label]}
          color={color}
          direction={routeLabelDirection}
          offset={routeLabelOffset}
        />
      )}

      {showStops && renderEndpointMarker("start", start, startLabel)}
      {showStops && renderEndpointMarker("end", end, endLabel)}
    </GeoJSON>
  );
}
