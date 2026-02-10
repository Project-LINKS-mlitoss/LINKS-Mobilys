// MapVisualization.jsx
import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Box, IconButton, Paper, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import StopMarkerLayer from "../StopMarkerLayer";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  useMap,
  GeoJSON,
  Pane,
} from "react-leaflet";
import L from "leaflet";
import * as turf from "@turf/turf";
import "leaflet/dist/leaflet.css";
import "../MapVisualization.css";
import MapLayerControlPanel from "./MapLayerControlPanel";
import { PoiLayer } from "../../poi/PoiLayer";
import RouteIcon from "../../../assets/logo/route-color-layer.png";
import RouteLabelTooltip from "../RouteLabelTooltip";
import NumberBusIcon from "../../../assets/photos/numberBus.png";
import { BLANK_DIVICON } from "../buffer-analysis/BufferAnalysisMap";
import { buildFilename } from "../buildFilename";
import "leaflet/dist/leaflet.css";
import { VISUALIZATION } from "@/strings";
import { ProxiedGrayTileLayer } from "../map/ProxiedGrayTileLayer";
import { InvalidateSizeOnResize } from "../map/InvalidateSizeOnResize";
import { MapEvents } from "../map/MapEvents";
import { GSI_TILE_URLS, OSM_TILE_URL_TEMPLATE } from "../map/tileUrls";
import { getPopulationBins, pickPopulationColor, POPULATION_COLORS } from "../map/mapColorUtils";
import { useFullscreen } from "../map/useFullscreen";
import { useMapExport } from "../map/useMapExport";

// ----------------- small helpers -----------------
function hexToLeafletColor(hex) {
  if (!hex) return "#3388ff";
  return hex.startsWith("#") ? hex : "#" + hex;
}
function swapLatLng(coords) {
  return coords.map(([lng, lat]) => [lat, lng]);
}
function getAllEdgeCoords(edges = []) {
  return edges.flatMap((e) => e.geojson_data || []);
}
function MapAutoCenter({ center }) {
  const map = useMap();
  React.useEffect(() => {
    if (Array.isArray(center) && center.length === 2) map.setView(center, 13);
  }, [center, map]);
  return null;
}
function pixelOffsetToMeters(pixel, lat, zoom) {
  return (
    (pixel * 40075016.686 * Math.abs(Math.cos((lat * Math.PI) / 180))) /
    (256 * Math.pow(2, zoom))
  );
}
function getLabelColorFromEdge(edge, label) {
  const groups = Array.isArray(edge.route_groups) ? edge.route_groups : [];
  const colors = Array.isArray(edge.colors) ? edge.colors : [];

  const idx = groups.indexOf(label);
  if (idx === -1) return null;

  const raw = colors[idx];
  if (!raw) return null;
  return hexToLeafletColor(raw);
}

export const POPPER_Z = 1200;

export function FocusOnStop({ stop }) {
  const map = useMap();
  useEffect(() => {
    if (stop) map.setView([stop.lat, stop.lng], 17, { animate: true });
  }, [stop, map]);
  return null;
}

// ----------------- inner map content -----------------
const MapContent = React.memo(function MapContent({
  containerWidth,
  center,
  tileUrl,
  tileAttr,
  selectedTile,
  layerState,
  pois = [],
  edges,
  stops,
  onRouteSelect,
  onStopSelect,
  countHitApi,
  canvasRenderer,
  tileLayerRef,
}) {
  const map = useMap();
  const [currentZoom, setCurrentZoom] = React.useState(13);

  React.useEffect(() => {
    if (!map) return;

    const handleZoomEnd = () => {
      setCurrentZoom(map.getZoom());
    };

    setCurrentZoom(map.getZoom());
    map.on("zoomend", handleZoomEnd);

    return () => {
      map.off("zoomend", handleZoomEnd);
    };
  }, [map]);

  const stopGeojson = React.useMemo(
    () => ({
      type: "FeatureCollection",
      features: (stops || []).map((s) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [s.stop_lon, s.stop_lat] },
        properties: s,
      })),
    }),
    [stops]
  );

  React.useEffect(() => {
    if (containerWidth && map) {
      setTimeout(() => map.invalidateSize(), 100);
    }
  }, [containerWidth, map]);

  const lat = center[0] || 0;
  const offsetPixel = 8;
  const alongPercent = 0.45;

  // Dynamic font size based on zoom level
  const FONT_SIZE_MIN = 6;
  const FONT_SIZE_MAX = 20;
  const ZOOM_MIN = 8;
  const ZOOM_MAX = 18;

  const calculateFontSize = (zoom) => {
    if (zoom <= ZOOM_MIN) return FONT_SIZE_MIN;
    if (zoom >= ZOOM_MAX) return FONT_SIZE_MAX;
    const ratio = (zoom - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN);
    return Math.round(FONT_SIZE_MIN + ratio * (FONT_SIZE_MAX - FONT_SIZE_MIN));
  };

  const fontSize = calculateFontSize(currentZoom);

  function calculateBearing(coord1, coord2) {
    const [lon1, lat1] = coord1;
    const [lon2, lat2] = coord2;

    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;

    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x =
      Math.cos(lat1Rad) * Math.sin(lat2Rad) -
      Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    let bearing = (Math.atan2(y, x) * 180) / Math.PI;
    bearing = bearing + 90;

    while (bearing > 180) bearing -= 360;
    while (bearing < -180) bearing += 360;

    if (bearing < -90 || bearing > 90) {
      bearing = bearing + 180;
      if (bearing > 180) bearing -= 360;
    }

    return bearing;
  }

  const polylines = React.useMemo(
    () =>
      (layerState.edges || layerState.routeColors) &&
      edges.map((edge, i) => {
        const coords = edge.geojson_data || [];
        if (coords.length < 2) return null;
        const line = turf.lineString(coords);
        const length = turf.length(line, { units: "meters" });

        const offsetMeters = pixelOffsetToMeters(offsetPixel, lat, currentZoom);

        let offsetLineCoords = coords;
        let labelPos = null;
        let labelRotation = 0;

        try {
          const offsetLine = turf.lineOffset(line, -offsetMeters, {
            units: "meters",
          });

          if (offsetLine?.geometry?.coordinates?.length >= 2) {
            offsetLineCoords = offsetLine.geometry.coordinates;

            const labelOffsetLine = turf.lineOffset(line, -offsetMeters * 2, {
              units: "meters",
            });

            const mid = turf.along(labelOffsetLine, length * alongPercent, {
              units: "meters",
            }).geometry.coordinates;
            labelPos = [mid[1], mid[0]];

            const offsetCoords = offsetLine.geometry.coordinates;
            const midIndex = Math.floor(offsetCoords.length * alongPercent);
            const prevIndex = Math.max(0, midIndex - 1);
            const nextIndex = Math.min(offsetCoords.length - 1, midIndex + 1);

            labelRotation = calculateBearing(
              offsetCoords[prevIndex],
              offsetCoords[nextIndex]
            );
          } else {
            const midIndex = Math.floor(coords.length / 2);
            labelPos = [coords[midIndex][1], coords[midIndex][0]];

            const prevIndex = Math.max(0, midIndex - 1);
            const nextIndex = Math.min(coords.length - 1, midIndex + 1);
            labelRotation = calculateBearing(
              coords[prevIndex],
              coords[nextIndex]
            );
          }
        } catch (err) {
          console.warn(`Offset failed for edge ${edge.id || i}:`, err);
          const midIndex = Math.floor(coords.length / 2);
          labelPos = [coords[midIndex][1], coords[midIndex][0]];

          const prevIndex = Math.max(0, midIndex - 1);
          const nextIndex = Math.min(coords.length - 1, midIndex + 1);
          labelRotation = calculateBearing(
            coords[prevIndex],
            coords[nextIndex]
          );
        }

        const color = layerState.routeColors
          ? hexToLeafletColor(edge.colors?.[0] || "00FF00") // Route-color mode
          : "#58AB39"; // Single-color (green) mode
        const weight = Math.max(
          2,
          Math.min(12, Math.round(2 + (edge.trip_count || 1) / 10))
        );

        return (
          <React.Fragment key={edge.id || i}>
            <Polyline
              pane="routes-pane"
              positions={swapLatLng(offsetLineCoords)}
              pathOptions={{ color, weight, opacity: 0.85 }}
              eventHandlers={{ click: () => onRouteSelect(edge.route_groups) }}
              renderer={canvasRenderer}
            />
            {layerState.serviceFrequency && countHitApi > 0 && labelPos && (
              <Marker
                position={labelPos}
                interactive={false}
                icon={L.divIcon({
                  className: "",
                  html: `<span style="
                    font-weight:700;
                    color:${color};
                    font-size:${fontSize}px;
                    text-shadow:
                      0 0 2px #fff,
                      0 0 4px #fff,
                      0 0 6px #fff,
                      1px 1px 0 #fff,
                      -1px -1px 0 #fff,
                      1px -1px 0 #fff,
                      -1px 1px 0 #fff;
                    white-space:nowrap;
                    line-height:1;
                    padding:0;
                    margin:0;
                    transform: rotate(${labelRotation}deg);
                    display: inline-block;
                    transform-origin: center center;
                  ">${edge.trip_count}</span>`,
                  iconSize: [36, 24],
                  iconAnchor: [18, 12],
                })}
              />
            )}
          </React.Fragment>
        );
      }),
    [
      layerState.edges,
      layerState.routeColors,
      edges,
      layerState.serviceFrequency,
      onRouteSelect,
      currentZoom,
      center,
      countHitApi,
      lat,
      canvasRenderer,
      fontSize,
    ]
  );
  const poisMarkers = React.useMemo(() => {
    if (!layerState.pois || !pois.length) return null;
    return <PoiLayer pois={pois} />;
  }, [pois, layerState.pois]);

  return (
    <>
      <MapAutoCenter center={center} />

      {selectedTile === "pale" ? (
        <ProxiedGrayTileLayer
          upstreamTemplate={GSI_TILE_URLS.pale}
          attribution={tileAttr}
          tileLayerRef={tileLayerRef}
          pane="tilePane"
        />
      ) : (
        <TileLayer
          key={selectedTile}
          url={tileUrl}
          attribution={tileAttr}
          ref={(tl) => {
            if (tl) tileLayerRef.current = tl;
          }}
          crossOrigin="anonymous"
        />
      )}

      {polylines}
      <StopMarkerLayer
        stopGeojson={stopGeojson}
        show={layerState.stops}
        showLabels={layerState.stopLabels}
        onStopSelect={onStopSelect}
      />
      {poisMarkers}
    </>
  );
});

// ----------------- legend -----------------
function CombinedLegend({ edges, onClose, layerState, populationData }) {
  const allTripCounts = useMemo(
    () =>
      edges
        .map((e) => e.trip_count || 0)
        .filter((v) => typeof v === "number" && !Number.isNaN(v)),
    [edges]
  );

  const [vmin, vmax] = useMemo(() => {
    if (!allTripCounts.length) return [0, 0];
    return [Math.min(...allTripCounts), Math.max(...allTripCounts)];
  }, [allTripCounts]);

  const calculateWeight = (tripCount) =>
    Math.max(2, Math.min(12, Math.round(2 + (tripCount || 1) / 10)));

  const steps = 5;
  const edges_bins = allTripCounts.length
    ? Array.from({ length: steps + 1 }, (_, i) =>
      Math.round(vmin + (i * (vmax - vmin)) / steps)
    )
    : [];

  const hasZero = allTripCounts.some((v) => v === 0);
  const hasNonZero = allTripCounts.some((v) => v > 0);

  const activePopKey = [
    "population",
    "population0_14",
    "population15_64",
    "population65_up",
  ].find((k) => layerState[k]);
  const hasPopulation = populationData && activePopKey;

  const popLabel =
    activePopKey === "population0_14"
      ? VISUALIZATION.common.map.populationLegend.title.age0To14
      : activePopKey === "population15_64"
        ? VISUALIZATION.common.map.populationLegend.title.age15To64
        : activePopKey === "population65_up"
          ? VISUALIZATION.common.map.populationLegend.title.age65Up
          : VISUALIZATION.common.map.populationLegend.title.total;

  const popBins = getPopulationBins(activePopKey);
  const popColors = POPULATION_COLORS;

  const showTripCount = edges.length > 0;
  const rangeSep = VISUALIZATION.common.dateParts.rangeSeparator;

  return (
    <Paper
      elevation={0}
      data-pop-iso-legend-card
      sx={{
        p: 1.25,
        border: "1px solid #E6E8EC",
        borderRadius: 2,
        bgcolor: "#ffffff",
        minWidth: 220,
        maxWidth: 280,
        boxShadow: "none",
        position: "absolute",
        right: 100,
        zIndex: 1950,
        bottom: 33,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
        <Typography
          sx={{ fontWeight: 700, fontSize: 14, color: "#111827", flex: 1 }}
        >
          {VISUALIZATION.common.map.labels.legendTitle}
        </Typography>
        <IconButton
          size="small"
          aria-label={VISUALIZATION.common.dialog.close}
          title={VISUALIZATION.common.dialog.close}
          onClick={onClose}
          sx={{ width: 24, height: 24, borderRadius: 1 }}
        >
          <CloseIcon sx={{ fontSize: 16, color: "#666" }} />
        </IconButton>
      </Box>

      {showTripCount && (
        <Box sx={{ mb: hasPopulation ? 2 : 0 }}>
          <Typography
            sx={{ fontWeight: 600, fontSize: 13, color: "#374151", mb: 1 }}
          >
            {VISUALIZATION.busRunningVisualization.components.mapLayerControl.layers.serviceFrequency}
          </Typography>
          {!allTripCounts.length ? (
            <Typography variant="body2" sx={{ color: "gray", fontSize: 12 }}>
              {VISUALIZATION.common.dateParts.noData}
            </Typography>
          ) : (
            <Box component="ul" sx={{ listStyle: "none", p: 0, m: 0 }}>
              {hasZero && (
                <Box
                  component="li"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    mb: "6px",
                    fontSize: "12px",
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      display: "inline-block",
                      width: 40,
                      height: 2,
                      background: "#58AB39",
                      border: "1px solid #4a9330",
                      mr: "8px",
                      opacity: 0.5,
                      borderRadius: 1,
                    }}
                  />
                  <Box component="span">{`0${VISUALIZATION.common.units.tripSuffix}`}</Box>
                </Box>
              )}
              {hasNonZero &&
                edges_bins.slice(0, -1).map((b, i) => {
                  if (b === 0 && edges_bins[i + 1] === 0) return null;
                  const from = Math.max(1, b);
                  const to = edges_bins[i + 1];
                  const weight = calculateWeight(b);
                  return (
                    <Box
                      key={i}
                      component="li"
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        mb: "6px",
                        fontSize: "12px",
                      }}
                    >
                      <Box
                        component="span"
                        sx={{
                          display: "inline-block",
                          width: 40,
                          height: weight,
                          background: "#58AB39",
                          border: "1px solid #4a9330",
                          mr: "8px",
                          borderRadius: 1,
                          transition: "height .2s",
                        }}
                      />
                      <Box component="span">{`${from}${rangeSep}${to} ${VISUALIZATION.common.units.frequencySuffix}`}</Box>
                    </Box>
                  );
                })}
            </Box>
          )}
        </Box>
      )}

      {hasPopulation && (
        <Box>
          <Typography
            sx={{ fontWeight: 600, fontSize: 13, color: "#374151", mb: 1 }}
          >
            {popLabel}
          </Typography>
          <Box component="ul" sx={{ listStyle: "none", p: 0, m: 0 }}>
            <Box
              component="li"
              sx={{
                display: "flex",
                alignItems: "center",
                mb: "6px",
                fontSize: "12px",
              }}
            >
              <Box
                component="span"
                sx={{
                  display: "inline-block",
                  width: 24,
                  height: 16,
                  background: "#ffffff",
                  opacity: 0.4,
                  border: "1px solid #ddd",
                  mr: "8px",
                  borderRadius: 1,
                }}
              />
              <Box component="span">{`0 ${VISUALIZATION.common.units.peopleSuffix}`}</Box>
            </Box>

            {popBins.slice(0, -1).map((bin, i) => (
              <Box
                key={i}
                component="li"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  mb: "6px",
                  fontSize: "12px",
                }}
              >
                <Box
                  component="span"
                  sx={{
                    display: "inline-block",
                    width: 24,
                    height: 16,
                    background: popColors[i],
                    opacity: 0.4,
                    border: "1px solid #ddd",
                    mr: "8px",
                    borderRadius: 1,
                  }}
                />
                <Box component="span">
                  {i === 0
                    ? `1${rangeSep}${popBins[i + 1]} ${VISUALIZATION.common.units.peopleSuffix}`
                    : `${bin + 1}${rangeSep}${popBins[i + 1]} ${VISUALIZATION.common.units.peopleSuffix}`}
                </Box>
              </Box>
            ))}

            <Box
              component="li"
              sx={{ display: "flex", alignItems: "center", fontSize: "12px" }}
            >
              <Box
                component="span"
                sx={{
                  display: "inline-block",
                  width: 24,
                  height: 16,
                  background: popColors[popColors.length - 1],
                  opacity: 0.4,
                  border: "1px solid #ddd",
                  mr: "8px",
                  borderRadius: 1,
                }}
              />
              <Box component="span">{`${popBins[popBins.length - 1] + 1} ${VISUALIZATION.common.units.peopleSuffix}${VISUALIZATION.common.units.orMoreSuffix}`}</Box>
            </Box>
          </Box>
        </Box>
      )}

      {!showTripCount && !hasPopulation && (
        <Typography variant="body2" sx={{ color: "gray", fontSize: 12 }}>
          {VISUALIZATION.busRunningVisualization.components.graphPanel.missingData}
        </Typography>
      )}
    </Paper>
  );
}

// ----------------- main component -----------------
export default function MapVisualization({
  edges = [],
  stops = [],
  containerWidth = 0,
  onRouteSelect = () => { },
  onStopSelect = () => { },
  pois = [],
  populationData = null,
  showTripNumbers = false,
  countHitApi = 0,
  isUsingStopParent = true,
  scenarioName = VISUALIZATION.common.scenarioFallbackName,
  screenName = VISUALIZATION.titles.busRunningVisualization,
}) {
  const allCoords = React.useMemo(() => getAllEdgeCoords(edges), [edges]);
  const center = React.useMemo(() => {
    if (!allCoords.length) return [35.71, 139.36];
    const avgLat =
      allCoords.reduce((sum, [lng, lat]) => sum + lat, 0) / allCoords.length;
    const avgLng =
      allCoords.reduce((sum, [lng, lat]) => sum + lng, 0) / allCoords.length;
    return [avgLat, avgLng];
  }, [allCoords]);

  const [layerState, setLayerState] = React.useState({
    edges: true,
    routeColors: false,
    stops: true,
    routeLabels: false,
    stopLabels: false,
    serviceFrequency: true,
    population: true,
    population0_14: false,
    population15_64: false,
    population65_up: false,
    pois: true,
  });

  const [selectedTile, setSelectedTile] = React.useState("pale");
  const [minimized, setMinimized] = React.useState(true);
  const [showLegend, setShowLegend] = useState(false);
  const [lastInteractionTime, setLastInteractionTime] = useState(0);

  const canvasRenderer = useMemo(
    () => L.canvas({ padding: 0.5, pane: "routes-pane" }),
    []
  );
  const populationRenderer = useMemo(
    () => L.canvas({ padding: 0.5, pane: "population-pane" }),
    []
  );

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);

  // Shared fullscreen hook
  const refreshMapOnFullscreen = useCallback(() => {
    window.dispatchEvent(new Event("resize"));
    mapRef.current?.invalidateSize?.({ animate: false });
  }, []);

  const { isFullscreen: isFs, toggleFullscreen: toggleFullScreen } = useFullscreen({
    containerRef,
    onFullscreenChange: refreshMapOnFullscreen,
  });

  // Shared map export hook
  const getFilename = useCallback(
    () => buildFilename(scenarioName, screenName, "map", undefined, "png"),
    [scenarioName, screenName]
  );

  const { exporting, exportPng } = useMapExport({
    containerRef,
    mapRef,
    tileLayerRef,
    getFilename,
    lastInteractionTime,
    cooldownMs: 5000,
    postTilesDelayMs: 3000,
  });

  const handleDownloadPNG = useCallback(async () => {
    try {
      await exportPng();
    } catch (err) {
      console.error("[Export PNG]", err);
      alert(VISUALIZATION.common.map.errors.pngExportFailedPrefix + (err?.message || err));
    }
  }, [exportPng]);

  const stopOptions = useMemo(
    () =>
      (stops || []).map((s) => ({
        id: s.stop_id,
        label: s.stop_name,
        lat: s.stop_lat,
        lng: s.stop_lon,
      })),
    [stops]
  );
  const [selectedStop, setSelectedStop] = useState(null);
  const [searchInput, setSearchInput] = useState("");

  const handleStopSelectCombined = (stop) => {
    if (!stop) return;
    setSelectedStop({
      id: stop.stop_id,
      label: stop.stop_name,
      lat: stop.stop_lat,
      lng: stop.stop_lon,
    });
    onStopSelect?.(stop);
  };

  const labelToBest = new Map();

  edges.forEach((edge) => {
    if (!Array.isArray(edge.route_groups) || !edge.route_groups.length) return;
    const coords = edge.geojson_data || [];
    if (!coords.length) return;
    const mid = coords[Math.floor(coords.length / 2)];
    if (!mid) return;

    const sharingCount = edge.route_groups.length;

    edge.route_groups.forEach((label) => {
      if (!label) return;
      const current = labelToBest.get(label);
      const color = getLabelColorFromEdge(edge, label);
      if (!current || sharingCount < current.score) {
        labelToBest.set(label, {
          label,
          coordinates: mid,
          color,
          score: sharingCount,
        });
      }
    });
  });

  const labels = Array.from(labelToBest.values()).map(({ score, ...rest }) => rest);

  const prevShowRef = React.useRef(showTripNumbers);
  React.useEffect(() => {
    if (!prevShowRef.current && showTripNumbers) {
      setLayerState((s) => ({ ...s, serviceFrequency: true }));
    }
    if (!showTripNumbers) {
      setLayerState((s) => ({ ...s, serviceFrequency: false }));
    }
    prevShowRef.current = showTripNumbers;
  }, [showTripNumbers]);

  const handleLayerToggle = (key) =>
    setLayerState((s) => {
      if (key === "edges") {
        const nextEdges = !s.edges;
        return {
          ...s,
          edges: nextEdges,
          routeColors: nextEdges ? false : true,
        };
      }
      if (key === "routeColors") {
        const nextRouteColors = !s.routeColors;
        return {
          ...s,
          routeColors: nextRouteColors,
          edges: nextRouteColors ? false : true,
        };
      }
      return { ...s, [key]: !s[key] };
    });

  const handleTileSelect = (key) => setSelectedTile(key);

  const TILE_URLS = {
    pale: GSI_TILE_URLS.pale,
    std: GSI_TILE_URLS.std,
    blank: GSI_TILE_URLS.blank,
    photo: GSI_TILE_URLS.photo,
    osm: OSM_TILE_URL_TEMPLATE,
  };
  const TILE_ATTRS = {
    pale: VISUALIZATION.common.map.attributions.gsi,
    std: VISUALIZATION.common.map.attributions.gsi,
    blank: VISUALIZATION.common.map.attributions.gsi,
    photo: VISUALIZATION.common.map.attributions.gsi,
    osm: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  };
  const tileUrl = TILE_URLS[selectedTile] || TILE_URLS.osm;
  const tileAttr = TILE_ATTRS[selectedTile] || TILE_ATTRS.osm;


  const PopulationLayer = ({ renderer }) => {
    const activeKey = [
      "population",
      "population0_14",
      "population15_64",
      "population65_up",
    ].find((k) => layerState[k]);
    if (!populationData || !activeKey) return null;

    const getValue = (props) => {
      switch (activeKey) {
        case "population0_14":
          return props.age_0_14 ?? 0;
        case "population15_64":
          return props.age_15_64 ?? 0;
        case "population65_up":
          return props.age_65_up ?? 0;
        default:
          return props.total ?? 0;
      }
    };

    return (
      <GeoJSON
        data={populationData}
        renderer={renderer}
        interactive={false}
        bubblingMouseEvents={false}
        style={(feature) => {
          const v = getValue(feature.properties || {});
          return {
            fillColor: pickPopulationColor(v, activeKey),
            fillOpacity: 0.4,
            color: "#ddd",
            weight: 0,
          };
        }}
      />
    );
  };

  const renderStopSearch = (extraSx = {}, key) => (
    <Autocomplete
      key={key}
      options={stopOptions}
      value={selectedStop}
      onChange={(e, val) => setSelectedStop(val)}
      inputValue={searchInput}
      onInputChange={(e, val) => setSearchInput(val)}
      isOptionEqualToValue={(opt, val) => opt?.id === val?.id}
      getOptionLabel={(opt) => (opt ? `${opt.label}` : "")}
      clearOnEscape
      disablePortal
      data-html2canvas-ignore
      componentsProps={{ popper: { sx: { zIndex: POPPER_Z } } }}
      slotProps={{ popper: { sx: { zIndex: POPPER_Z } } }}
      sx={{
        width: 300,
        position: "absolute",
        top: 25,
        left: 55,
        zIndex: POPPER_Z,
        background: "#fff",
        boxShadow: 2,
        borderRadius: 2,
        ...extraSx,
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          label={
            isUsingStopParent
              ? VISUALIZATION.common.map.labels.stopSelect
              : VISUALIZATION.common.map.labels.poleSelect
          }
        />
      )}
    />
  );

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        minWidth: 0,
        position: "relative",
        "& .leaflet-container": {
          width: "100%",
          height: "100%",
          borderRadius: 2,
        },
        "& .leaflet-control-attribution": {
          marginRight: "16px",
          marginBottom: "11px",
        },
      }}
      ref={containerRef}
    >
      {/* fullscreen button */}
      <IconButton
        data-html2canvas-ignore
        onClick={toggleFullScreen}
        sx={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 1100,
          bgcolor: "#fff",
          boxShadow: 1,
        }}
        size="large"
        aria-label="fullscreen"
      >
        {isFs ? (
          <span className="material-symbols-outlined outlined">
            fullscreen_exit
          </span>
        ) : (
          <span className="material-symbols-outlined outlined">fullscreen</span>
        )}
      </IconButton>

      {/* download button */}
      <IconButton
        data-html2canvas-ignore
        onClick={handleDownloadPNG}
        disabled={exporting}
        sx={{
          position: "absolute",
          top: 16,
          right: 70,
          zIndex: 1100,
          bgcolor: "#fff",
          boxShadow: 1,
          opacity: exporting ? 0.6 : 1,
        }}
        size="large"
        aria-label="download-png"
      >
        <span className="material-symbols-outlined outlined">download</span>
      </IconButton>

      {exporting && (
        <div
          id="exportOverlay"
          data-html2canvas-ignore
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1200,
            display: "grid",
            placeItems: "center",
            background: "rgba(255,255,255,0.35)",
            backdropFilter: "blur(0.5px)",
            fontWeight: 700,
          }}
        >
          {VISUALIZATION.common.map.actions.downloading}
        </div>
      )}

      {/* legend toggle (outside capture) */}
      <Box
        sx={{
          position: "absolute",
          bottom: 33,
          right: 100,
          zIndex: 1000,
          pointerEvents: "auto",
        }}
      >
        <IconButton
          data-html2canvas-ignore
          onClick={() => setShowLegend((s) => !s)}
          aria-label={showLegend ? VISUALIZATION.common.map.labels.legendHide : VISUALIZATION.common.map.labels.legendShow}
          title={showLegend ? VISUALIZATION.common.map.labels.legendHide : VISUALIZATION.common.map.labels.legendShow}
          sx={{
            width: 48,
            height: 48,
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
          <span className="material-symbols-outlined outlined">info</span>
        </IconButton>
      </Box>

      {/* stop search */}
      {renderStopSearch({}, "search")}

      {/* map area */}
      <div style={{ position: "absolute", inset: 0 }}>
        <MapContainer
          center={center}
          zoom={13}
          scrollWheelZoom
          style={{ width: "100%", height: "100%" }}
          whenCreated={(m) => {
            mapRef.current = m;
          }}
          preferCanvas={true}
        >
          <Pane name="population-pane" style={{ zIndex: 200 }} />
          <Pane name="routes-pane" style={{ zIndex: 500 }} />
          <Pane name="route-labels-pane" style={{ zIndex: 745 }} />
          <Pane name="labels-tooltip-pane" style={{ zIndex: 760 }} />
          <Pane name="route-tooltip-pane" style={{ zIndex: 755 }} />

          <InvalidateSizeOnResize
            targetRef={containerRef}
            deps={[minimized, isFs]}
          />
          <FocusOnStop stop={selectedStop} />
          <MapEvents
            onMoveOrZoomEnd={() => setLastInteractionTime(Date.now())}
          />

          <MapContent
            containerWidth={containerWidth}
            center={center}
            tileUrl={tileUrl}
            tileAttr={tileAttr}
            selectedTile={selectedTile}
            layerState={layerState}
            edges={edges}
            stops={stops}
            pois={pois}
            onRouteSelect={onRouteSelect}
            onStopSelect={handleStopSelectCombined}
            countHitApi={countHitApi}
            canvasRenderer={canvasRenderer}
            tileLayerRef={tileLayerRef}
          />

          {layerState.routeLabels &&
            labels.map((item, index) => (
              <Marker
                key={`route-label-${index}`}
                position={
                  item.coordinates
                    ? [item.coordinates[1], item.coordinates[0]]
                    : [0, 0]
                }
                icon={BLANK_DIVICON}
                pane="route-labels-pane"
                interactive={false}
              >
                <RouteLabelTooltip
                  label={item.label}
                  color={layerState.routeColors ? item.color : "#58AB39"}
                  direction="center"
                  offset={item._offset}
                />
              </Marker>
            ))}

          <PopulationLayer renderer={populationRenderer} />

          {/* legend INSIDE MapContainer so it is captured */}
          {showLegend && (
            <CombinedLegend
              edges={edges}
              layerState={layerState}
              populationData={populationData}
              onClose={() => setShowLegend(false)}
            />
          )}
        </MapContainer>
      </div>

      {/* control panel (not captured) */}
      <div data-html2canvas-ignore>
        <MapLayerControlPanel
          additionalLayerItems={[
            {
              key: "routeColors",
              icon: RouteIcon,
              label:
                VISUALIZATION.busRunningVisualization.components.mapLayerControl
                  .layers.routeColors,
            },
            {
              key: "serviceFrequency",
              icon: NumberBusIcon,
              label:
                VISUALIZATION.busRunningVisualization.components.mapLayerControl
                  .layers.serviceFrequency,
            },
          ]}
          populationItems={[
            {
              key: "population",
              icon: <span className="material-symbols-outlined">groups</span>,
              label:
                VISUALIZATION.busRunningVisualization.components.mapLayerControl
                  .populationFilters.all,
            },
            {
              key: "population0_14",
              icon: <span className="material-symbols-outlined">groups</span>,
              label:
                VISUALIZATION.busRunningVisualization.components.mapLayerControl
                  .populationFilters.age0To14,
            },
            {
              key: "population15_64",
              icon: <span className="material-symbols-outlined">groups</span>,
              label:
                VISUALIZATION.busRunningVisualization.components.mapLayerControl
                  .populationFilters.age15To64,
            },
            {
              key: "population65_up",
              icon: <span className="material-symbols-outlined">groups</span>,
              label:
                VISUALIZATION.busRunningVisualization.components.mapLayerControl
                  .populationFilters.age65Up,
            },
          ]}
          layerState={layerState}
          onLayerToggle={handleLayerToggle}
          selectedTile={selectedTile}
          onTileSelect={handleTileSelect}
          minimized={minimized}
          setMinimized={setMinimized}
        />
      </div>
    </Box>
  );
}
