import React from "react";
import { CircleMarker, Marker, Polyline } from "react-leaflet";
import { red } from "@mui/material/colors";
import { VISUALIZATION } from "@/strings";
import { BLANK_DIVICON } from "../../buffer-analysis/BufferAnalysisMap";
import StopLabelTooltip from "../../StopLabelTooltip";
import { BusStopZoomWrapper, HoverPopup } from "./ODLeafletHelpers";

export default function ODBusStopLayers({
  selectedVisualization,
  layerState,
  filteredBusStopLines,
  busLineWeight,
  currentStopOptions,
  busStopLines,
  oDBusStopSelectedPoint,
  setODBusStopSelectedPoint,
}) {
  if (selectedVisualization !== 2) return null;

  return (
    <>
      {layerState.relation &&
        filteredBusStopLines.map((line, idx) => (
          <Polyline
            key={`polyline-${idx}`}
            positions={[line.from, line.to]}
            pathOptions={{
              color: "#1976d2",
              weight: busLineWeight(line.count),
              opacity: 0.25,
            }}
            eventHandlers={{
              mouseover: (e) => e.target.openPopup(e.latlng),
              mouseout: (e) => e.target.closePopup(),
            }}
          >
            <HoverPopup>
              <strong>
                {line.fromName} 竊・{line.toName}
              </strong>
              <div>
                {VISUALIZATION.odAnalysis.components.legend.headers.users}: {line.count}
              </div>
            </HoverPopup>
          </Polyline>
        ))}

      {layerState.stops &&
        currentStopOptions.map((s, idx) => (
          <React.Fragment key={`busstop-${idx}`}>
            <CircleMarker
              center={[s.lat, s.lng]}
              radius={3}
              pathOptions={{
                color: red[600],
                weight: 2,
                fillColor: red[600],
                fillOpacity: 0.9,
              }}
            />

            {layerState.stopLabels && (
              <Marker
                position={[s.lat, s.lng]}
                icon={BLANK_DIVICON}
                pane="od-map-stop-labels-pane"
                interactive={false}
              >
                <StopLabelTooltip
                  stopName={s.label}
                  direction="top"
                  offset={[0, -10]}
                  pane="od-map-stop-tooltip-pane"
                />
              </Marker>
            )}
          </React.Fragment>
        ))}

      <BusStopZoomWrapper
        selectedVisualization={selectedVisualization}
        oDBusStopSelectedPoint={oDBusStopSelectedPoint}
        busStopLines={busStopLines}
        setODBusStopSelectedPoint={setODBusStopSelectedPoint}
      />
    </>
  );
}

