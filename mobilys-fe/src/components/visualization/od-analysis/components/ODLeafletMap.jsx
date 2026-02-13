// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import {
  CircleMarker,
  MapContainer,
  Pane,
  TileLayer,
} from "react-leaflet";
import { ProxiedGrayTileLayer } from "../../map/ProxiedGrayTileLayer";
import { MapEvents } from "../../map/MapEvents";
import { FocusOnStop } from "../../bus-running-visualization/MapVisualization";
import ODBaseMapLayers from "./ODBaseMapLayers";
import ODUsageDistributionLayers from "./ODUsageDistributionLayers";
import ODLastFirstStopLayers from "./ODLastFirstStopLayers";
import ODBusStopLayers from "./ODBusStopLayers";
import { AutoZoomToRoutes } from "./ODLeafletHelpers";

export default function ODLeafletMap({
  initialCenter,
  selectedTile,
  tileUrl,
  tileAttr,
  tileLayerRef,
  mapRef,
  onMoveOrZoomEnd,
  selectedStop,

  hasBase,
  routeFeatures,
  layerState,
  uniqueRouteLabels,
  currentStopOptions,

  selectedVisualization,
  points,
  radiusFor,
  oDUsageDistributionSelectedPoint,
  oDUsageDistributionSelectedMode,
  lastFirstPoints,
  oDLastFirstStopData,
  oDLastFirstStopSelectedPoint,
  setODLastFirstStopSelectedPoint,
  oDLastFirstStopSelectedMode,
  lastFirstMarkerColor,
  filteredBusStopLines,
  busLineWeight,
  busStopLines,
  oDBusStopSelectedPoint,
  setODBusStopSelectedPoint,
}) {
  return (
    <MapContainer
      center={initialCenter}
      zoom={13}
      scrollWheelZoom
      style={{ width: "100%", height: "100%" }}
      preferCanvas={true}
      whenCreated={(m) => {
        mapRef.current = m;
        setTimeout(() => m.invalidateSize(false), 0);
      }}
    >
      <MapEvents onMoveOrZoomEnd={onMoveOrZoomEnd} />

      {selectedTile === "pale" ? (
        <ProxiedGrayTileLayer
          upstreamTemplate={tileUrl}
          attribution={tileAttr}
          tileLayerRef={tileLayerRef}
          pane="tilePane"
        />
      ) : (
        <TileLayer
          key={selectedTile}
          ref={tileLayerRef}
          url={tileUrl}
          attribution={tileAttr}
          crossOrigin="anonymous"
        />
      )}

      <FocusOnStop stop={selectedStop} />
      {hasBase && <AutoZoomToRoutes routeFeatures={routeFeatures} />}

      {/* Custom panes with unique names for this component to avoid conflicts */}
      <Pane
        name="od-map-stop-labels-pane"
        style={{ zIndex: 700, pointerEvents: "none" }}
      />
      <Pane name="od-map-routes-pane" style={{ zIndex: 380 }} />
      <Pane name="od-map-routes-labels-pane" style={{ zIndex: 390 }} />
      <Pane name="od-map-labels-tooltip-pane" style={{ zIndex: 760 }} />
      <Pane name="od-map-route-tooltip-pane" style={{ zIndex: 755 }} />
      <Pane name="od-map-stop-tooltip-pane" style={{ zIndex: 755 }} />

      <ODBaseMapLayers
        hasBase={hasBase}
        layerState={layerState}
        routeFeatures={routeFeatures}
        uniqueRouteLabels={uniqueRouteLabels}
        selectedVisualization={selectedVisualization}
        currentStopOptions={currentStopOptions}
      />

      <ODUsageDistributionLayers
        selectedVisualization={selectedVisualization}
        layerState={layerState}
        points={points}
        radiusFor={radiusFor}
        selectedPoint={oDUsageDistributionSelectedPoint}
        selectedMode={oDUsageDistributionSelectedMode}
      />

      <ODLastFirstStopLayers
        selectedVisualization={selectedVisualization}
        layerState={layerState}
        lastFirstPoints={lastFirstPoints}
        selectedFeature={oDLastFirstStopSelectedPoint}
        lastFirstData={oDLastFirstStopData}
        onSelectFeature={setODLastFirstStopSelectedPoint}
        selectedMode={oDLastFirstStopSelectedMode}
        parentMarkerColor={lastFirstMarkerColor}
      />

      <ODBusStopLayers
        selectedVisualization={selectedVisualization}
        layerState={layerState}
        filteredBusStopLines={filteredBusStopLines}
        busLineWeight={busLineWeight}
        currentStopOptions={currentStopOptions}
        busStopLines={busStopLines}
        oDBusStopSelectedPoint={oDBusStopSelectedPoint}
        setODBusStopSelectedPoint={setODBusStopSelectedPoint}
      />
    </MapContainer>
  );
}

