// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Marker,
  Popup,
  useMapEvents,
  Pane,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import MapLayerControlPanel from "../bus-running-visualization/MapLayerControlPanel";
import { Box } from "@mui/material";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import { PoiLayer } from "../../poi/PoiLayer";
import PopulationAndIsochroneLegend from "../PopulationAndIsochroneLegend";
import {
  BLANK_DIVICON,
  lineLabelLatLng,
  toColor,
  ORIGIN_ICON,
} from "../buffer-analysis/BufferAnalysisMap";
import { MapEvents } from "../map/MapEvents";
import PopulationLegendButton from "../PopulationLegendButton";
import StopMarkerLayer from "../StopMarkerLayer";
import RouteLabelTooltip from "../RouteLabelTooltip";
import StopLabelTooltip from "../StopLabelTooltip";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { POPPER_Z } from "../bus-running-visualization/MapVisualization";
import "../MapVisualization.css"; // provides .grayscale-map for pale tiles
import { buildFilename } from "../buildFilename";
import ViewportPoiLayer from "../ViewportPoiLayer";
import { spreadLabelOffsets } from "../SpreadLabelOffset";
import RouteIcon from "../../../assets/logo/route-color-layer.png";
import "leaflet/dist/leaflet.css";
import { ProxiedGrayTileLayer } from "../map/ProxiedGrayTileLayer";
import { FocusOnStop, PopulationLayer } from "../map/MapSharedComponents";
import { useMapExport } from "../map/useMapExport";
import { VISUALIZATION } from "@/strings";
import { GSI_TILE_URLS, OSM_TILE_URL_TEMPLATE } from "../map/tileUrls";

function buildIsoLegendMinutes(features) {
  const minutes = (features || [])
    .map((f) => (f?.properties?.time ?? 0) / 60)
    .filter((v) => Number.isFinite(v))
    .map((v) => Math.round(v));

  const uniq = Array.from(new Set(minutes)).sort((a, b) => a - b);
  if (!uniq.length) return [];

  const min = uniq[0];
  const max = uniq[uniq.length - 1];

  const start = Math.ceil(min / 10) * 10;
  const end = Math.floor(max / 10) * 10;

  const grid = [];
  for (let m = end; m >= start; m -= 10) grid.push(m);

  if (max > end) grid.unshift(max);
  if (min < start) grid.push(min);

  const existing = new Set(uniq);
  const filtered = grid.filter((m) => existing.has(m));

  return Array.from(new Set(filtered)).sort((a, b) => a - b);
}

// Component to apply grayscale filter directly to tile pane
/** Interaction sensor: mark when the user starts zoom/move so we don't fight them */
function UseMapInteractionSensor({ markInteracted }) {
  useMapEvents({
    zoomstart() {
      markInteracted();
    },
    movestart() {
      markInteracted();
    },
    dragstart() {
      markInteracted();
    },
  });
  return null;
}

/** Fit map view on routes when they arrive/meaningfully change. Skip if user recently interacted. 
 * Uses fitBounds to automatically calculate optimal zoom level to show all routes/stops.
 */
function FitOnRoutes({ routeGeojson, stopGeojson, scenarioId, onDidFit, recentlyInteracted }) {
  const map = useMap();
  const lastBoundsStrRef = React.useRef(null);
  const lastScenarioRef = React.useRef(null);

  // Create a fingerprint of the actual route data (not just length)
  const routeFingerprint = React.useMemo(() => {
    if (!routeGeojson?.features?.length) return null;

    try {
      const bounds = L.geoJSON(routeGeojson).getBounds();
      if (!bounds.isValid()) return null;
      return bounds.toBBoxString();
    } catch {
      return null;
    }
  }, [routeGeojson]);

  useEffect(() => {
    if (!map || !routeGeojson?.features?.length || !routeFingerprint) return;
    if (recentlyInteracted?.()) return;

    const scenarioChanged = lastScenarioRef.current !== scenarioId;
    const dataChanged = lastBoundsStrRef.current !== routeFingerprint;

    if (!scenarioChanged && !dataChanged) return;

    if (scenarioChanged && !dataChanged) {
      lastScenarioRef.current = scenarioId;
      return;
    }

    try {
      let bounds;

      if (stopGeojson?.features?.length) {
        bounds = L.geoJSON(stopGeojson).getBounds();
      } else {
        bounds = L.geoJSON(routeGeojson).getBounds();
      }

      if (!bounds.isValid()) {
        return;
      }

      map.fitBounds(bounds, {
        padding: [50, 50],
        animate: true,
        duration: 0.5,
        maxZoom: 16,
      });


      lastBoundsStrRef.current = routeFingerprint;
      lastScenarioRef.current = scenarioId;
      onDidFit?.();
    } catch (error) {
      console.error("[FitOnRoutes] Error fitting bounds:", error);
    }
  }, [
    map,
    routeGeojson,
    stopGeojson,
    scenarioId,
    routeFingerprint,
    onDidFit,
    recentlyInteracted,
  ]);

  return null;
}

/** Fit map view to the isochrone when it arrives. Skip if user recently interacted. */
function FitOnIsochrone({ isochroneGeojson, onDidFit, recentlyInteracted }) {
  const map = useMap();
  const lastBoundsStrRef = React.useRef(null);

  useEffect(() => {
    if (!map || !isochroneGeojson?.features?.length) return;
    if (recentlyInteracted?.()) return;

    let bounds;
    try {
      bounds = L.geoJSON(isochroneGeojson).getBounds();
    } catch {
      return;
    }

    if (!bounds.isValid()) return;

    const boundsStr = bounds.toBBoxString();
    if (lastBoundsStrRef.current === boundsStr) return;

    const padding = [40, 40];
    const targetZoom = map.getBoundsZoom(bounds, false, padding);
    const clampedZoom = Math.max(targetZoom, 12);

    map.setView(bounds.getCenter(), clampedZoom, {
      animate: true,
      duration: 0.5,
    });

    lastBoundsStrRef.current = boundsStr;
    onDidFit?.();
  }, [map, isochroneGeojson, onDidFit, recentlyInteracted]);

  return null;
}

/** Recenter map when center prop changes (preserve zoom; guard with epsilon + cooldown) */
function RecenterOnCenterChange({ center, disabledUntilRef, recentlyInteracted }) {
  const map = useMap();
  const lastAppliedRef = React.useRef({ lat: null, lng: null });

  useEffect(() => {
    if (!center) return;
    const lat = parseFloat(center.lat);
    const lng = parseFloat(center.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    if (recentlyInteracted?.()) return;
    if (disabledUntilRef?.current && Date.now() < disabledUntilRef.current) return;

    const eps = 1e-6;
    const curr = map.getCenter();
    const sameAsCurrent =
      Math.abs(curr.lat - lat) < eps && Math.abs(curr.lng - lng) < eps;
    const sameAsLast =
      Math.abs((lastAppliedRef.current.lat ?? NaN) - lat) < eps &&
      Math.abs((lastAppliedRef.current.lng ?? NaN) - lng) < eps;

    if (sameAsCurrent || sameAsLast) return;

    map.setView([lat, lng], map.getZoom(), { animate: true });
    lastAppliedRef.current = { lat, lng };
  }, [center?.lat, center?.lng, map, disabledUntilRef, recentlyInteracted]);
  return null;
}

const RoadNetworkMap = ({
  scenarioId,
  center,
  isochroneGeojson,
  onMapClick = null,
  poiData,
  routeGeojson = null,
  stopGeojson = null,
  populationData = null,
  onIsochroneMinutesChange,
  isCalculating = false,
  showCalculateButton = false,
  onCalculate,
  scenarioName = VISUALIZATION.common.scenarioFallbackName,
  screenName = VISUALIZATION.roadNetworkAnalysisOsm.screenName,
}) => {
  const DEFAULT_ZOOM = 13;

  const isochroneRenderer = useMemo(
    () => L.canvas({ padding: 0.5, pane: "road-network-isochrone-pane" }),
    []
  );
  const routesRenderer = useMemo(
    () => L.canvas({ padding: 0.5, pane: "road-network-routes-pane" }),
    []
  );
  const populationRenderer = useMemo(
    () => L.canvas({ padding: 0.5, pane: "population-pane" }),
    []
  );

  const [internalCalculating, setInternalCalculating] = useState(false);
  const calculating = isCalculating || internalCalculating;

  const [isochroneOpacity, setIsochroneOpacity] = useState(0.3);

  const routesKey = useMemo(
    () => `routes-${scenarioId}-${routeGeojson?.features?.length || 0}`,
    [scenarioId, routeGeojson]
  );
  const stopsKey = useMemo(
    () => `stops-${scenarioId}-${stopGeojson?.features?.length || 0}`,
    [scenarioId, stopGeojson]
  );

  const recenterCooldownUntilRef = useRef(0);
  const startRecenterCooldown = () => {
    recenterCooldownUntilRef.current = Date.now() + 500;
  };

  const sortedFeatures = useMemo(() => {
    if (!isochroneGeojson?.features) return [];
    return [...isochroneGeojson.features].sort(
      (a, b) => a.properties.time - b.properties.time
    );
  }, [isochroneGeojson]);

  const times = sortedFeatures.map((f) => f.properties.time);
  const minTime = times[0] ?? 0;
  const maxTime = times[times.length - 1] ?? 0;

  const getColor = (minutes) => {
    if (maxTime === minTime) return "rgb(255,255,0)";
    const ratio = 1 - (minutes - minTime) / (maxTime - minTime);
    const g = 255 - Math.round(ratio * 255);
    return `rgb(255,${g},0)`;
  };

  const [sliderValue, setSliderValue] = useState(sortedFeatures.length - 1);
  useEffect(() => {
    setSliderValue(sortedFeatures.length ? sortedFeatures.length - 1 : 0);
  }, [sortedFeatures.length]);

  const visibleItem =
    sortedFeatures.length > 0
      ? sortedFeatures[Math.min(sliderValue, sortedFeatures.length - 1)]
      : null;

  const legendMinutes = useMemo(
    () => buildIsoLegendMinutes(sortedFeatures),
    [sortedFeatures]
  );

  const parseRgb = (rgbStr) => {
    const m =
      /rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i.exec(rgbStr || "");
    return m
      ? [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)]
      : [255, 255, 255];
  };

  const composite = (under, over, alpha) => [
    Math.round(over[0] * alpha + under[0] * (1 - alpha)),
    Math.round(over[1] * alpha + under[1] * (1 - alpha)),
    Math.round(over[2] * alpha + under[2] * (1 - alpha)),
  ];

  const allMinutesAsc = useMemo(
    () => sortedFeatures.map((f) => Math.round((f?.properties?.time ?? 0) / 60)),
    [sortedFeatures]
  );

  const cutoffLegendMinutes = useMemo(
    () =>
      visibleItem?.properties?.time != null
        ? Math.round(visibleItem.properties.time / 60)
        : null,
    [visibleItem]
  );

  const getIsoLegendColor = useMemo(() => {
    return (m) => {
      if (!Number.isFinite(m)) return "rgba(255,255,0,1)";
      const drawList = allMinutesAsc
        .filter((t) =>
          cutoffLegendMinutes != null
            ? t >= m && t <= cutoffLegendMinutes
            : t >= m
        )
        .sort((a, b) => b - a);

      let acc = [255, 255, 255];
      for (const t of drawList) {
        const over = parseRgb(getColor(t * 60));
        acc = composite(acc, over, isochroneOpacity);
      }
      return `rgba(${acc[0]}, ${acc[1]}, ${acc[2]}, 1)`;
    };
  }, [allMinutesAsc, cutoffLegendMinutes, isochroneOpacity, getColor]);

  const handleSliderChange = (e) => {
    setSliderValue(Number(e.target.value));
  };
  const handleOpacityChange = (e) => {
    setIsochroneOpacity(Number(e.target.value));
  };

  const handleSetOriginFromPOI = (lat, lon) => {
    onMapClick?.({ lat, lng: lon });
  };

  const colorMapping = useMemo(() => {
    const map = {};
    sortedFeatures.forEach((feature) => {
      map[feature.id] = getColor(feature.properties.time);
    });
    return map;
  }, [sortedFeatures, minTime, maxTime]);

  const [layerState, setLayerState] = useState({
    edges: true, // route edges
    routeColors: false, // per-route colors
    stops: true,
    pois: true,
    isochrone: true,
    population: true,
    population0_14: false,
    population15_64: false,
    population65_up: false,
  });

  const [selectedTile, setSelectedTile] = useState("pale");
  const [minimized, setMinimized] = useState(true);

  const isochroneActive = layerState.isochrone && sortedFeatures.length > 0;

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

  const ZINDEX = {
    base: 200,
    population: 220,
    isochrone: 240,
    routes: 300,
    stops: 560,
    poi: 580,
    marker: 620,
    info: 740,
  };

  function ClickHandler({ onClick }) {
    const map = useMapEvents({
      click(e) {
        onClick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
        map.panTo(e.latlng);
      },
    });
    return null;
  }

  const isValidCoords = (coord) =>
    coord &&
    !isNaN(parseFloat(coord.lat)) &&
    !isNaN(parseFloat(coord.lng)) &&
    isFinite(coord.lat) &&
    isFinite(coord.lng);

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const [lastInteractionTime, setLastInteractionTime] = useState(0);

  const { exporting, exportPng } = useMapExport({
    containerRef,
    mapRef,
    tileLayerRef,
    lastInteractionTime,
    getFilename: () =>
      buildFilename(
        scenarioName,
        screenName,
        "map",
        screenName,
        "png"
      ),
    solidifyMaterialSymbolsInLeafletDivIcons: true,
    legendSelector: "[data-pop-iso-legend-card]",
  });

  const [isFs, setIsFs] = useState(false);
  useEffect(() => {
    const onFsChange = async () => {
      setIsFs(!!document.fullscreenElement);
      await refreshMap();
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  function stopLikeDiameter(zoomLevel) {
    const size = Math.max(6, Math.min(9, Math.round(6 + 0.9 * (zoomLevel - 12))));
    const border = Math.max(1, Math.round(size * 0.22));
    return size + 2 * border;
  }
  const poiRadius = useMemo(() => stopLikeDiameter(zoom), [zoom]);

  const activePopulationKey = useMemo(() => {
    return ["population", "population0_14", "population15_64", "population65_up"].find(
      (k) => layerState[k]
    );
  }, [
    layerState.population,
    layerState.population0_14,
    layerState.population15_64,
    layerState.population65_up,
  ]);

  const stopOptions = useMemo(
    () =>
      (stopGeojson?.features || []).map((s) => ({
        id: s.properties.parent_stop,
        label: s.properties.parent_stop,
        lat: s.geometry.coordinates[1],
        lng: s.geometry.coordinates[0],
      })),
    [stopGeojson]
  );

  const [selectedStop, setSelectedStop] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    setSelectedStop(null);
    setSearchInput("");
  }, [stopGeojson]);

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
      slotProps={{
        popper: {
          sx: { zIndex: POPPER_Z },
          modifiers: [
            { name: "computeStyles", options: { adaptive: false, gpuAcceleration: false } },
            { name: "preventOverflow", options: { altBoundary: true } },
            { name: "flip", options: { fallbackPlacements: ["top-start"] } },
          ],
        },
      }}
      sx={{
        width: 300,
        position: "absolute",
        top: 25,
        left: 55,
        zIndex: POPPER_Z,
        background: "#fff",
        boxShadow: 2,
        borderRadius: 2,
        transform: "none",
        ...extraSx,
      }}
      renderInput={(params) => (
        <TextField {...params} size="small" label={VISUALIZATION.common.map.labels.stopSelect} />
      )}
    />
  );

  const minutes =
    sortedFeatures.length > 0
      ? Math.round(
          sortedFeatures[Math.min(sliderValue, sortedFeatures.length - 1)]
            ?.properties?.time / 60
        )
      : null;

  const uniqueRouteLabels = React.useMemo(() => {
    const res = [];
    const seen = new Set();
    const feats = routeGeojson?.features || [];

    for (const f of feats) {
      if (!f?.geometry || f.geometry.type !== "LineString") continue;

      const labels = f?.properties?.keywords || [];
      const labelColor = f?.properties?.keyword_colors || [];

      const coords = Array.isArray(f.geometry.coordinates)
        ? f.geometry.coordinates
        : null;
      const midCoord =
        coords && coords.length
          ? coords[Math.floor(coords.length / 2)]
          : null;

      labels.forEach((label, i) => {
        if (label == null || seen.has(label)) return;
        seen.add(label);

        const rawColor = labelColor[i];
        const color =
          rawColor && rawColor.startsWith?.("#")
            ? rawColor
            : rawColor
            ? `#${rawColor}`
            : null;

        res.push({
          label,
          coordinates: midCoord,
          color,
        });
      });
    }
    return res;
  }, [routeGeojson]);

  const routeLabelsWithOffsets = React.useMemo(() => {
    return spreadLabelOffsets(uniqueRouteLabels, {
      precision: 6,
      baseRadiusPx: 10,
      stepPx: 6,
      perRing: 8,
      sortKey: (x) => String(x.label),
    });
  }, [uniqueRouteLabels]);

  useEffect(() => {
    onIsochroneMinutesChange?.(minutes);
  }, [minutes, onIsochroneMinutesChange]);

  const handleClickCalculate = async () => {
    if (!onCalculate) return;
    try {
      setInternalCalculating(true);
      await onCalculate();
    } finally {
      setInternalCalculating(false);
    }
  };

  async function refreshMap() {
    window.dispatchEvent(new Event("resize"));
    mapRef.current?.invalidateSize({ animate: false });
    tileLayerRef.current?.redraw?.();
    mapRef.current?.eachLayer?.((l) => l?.redraw?.());
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }

  async function handleDownloadPNG() {
    if (exporting) return;
    try {
      await exportPng();
    } catch (err) {
      console.error("[Export PNG]", err);
      alert(
        VISUALIZATION.common.map.errors.pngExportFailedPrefix +
          (err?.message || err)
      );
    }
  }

  const userInteractedAtRef = useRef(0);
  const markUserInteracted = () => {
    userInteractedAtRef.current = Date.now();
  };
  const recentlyInteracted = (ms = 2000) =>
    Date.now() - (userInteractedAtRef.current || 0) < ms;

  const handleLayerToggle = (key) =>
    setLayerState((s) => {
      // Exclusive toggles: edges vs per-route colors
      if (key === "edges") {
        const nextEdges = !s.edges;

        return {
          ...s,
          edges: nextEdges,
          routeColors: nextEdges ? false : true, // edges OFF -> routeColors ON
        };
      }

      if (key === "routeColors") {
        const nextRouteColors = !s.routeColors;

        return {
          ...s,
          routeColors: nextRouteColors,
          edges: nextRouteColors ? false : true, // routeColors ON -> edges OFF
        };
      }

      // Toggle other layers
      return { ...s, [key]: !s[key] };
    });


  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        minWidth: 0,
        position: "relative",
        transform: "none !important",
        "& .leaflet-container": {
          width: "100%",
          height: "100%",
          borderRadius: 2,
          pointerEvents: calculating ? "none" : "auto",
        },
        "& .leaflet-control-attribution": {
          marginRight: "16px", 
          marginBottom: "11px", 
        },
      }}
      ref={containerRef}
    >
      {/* fullscreen */}
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
          <span className="material-symbols-outlined outlined">
            fullscreen
          </span>
        )}
      </IconButton>

      {/* download */}
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

      {/* exporting overlay */}
      {exporting && (
        <div
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

      {/* Optional local calculate button */}
      {showCalculateButton && (
        <Button
          data-html2canvas-ignore
          variant="contained"
          size="small"
          onClick={handleClickCalculate}
          disabled={calculating}
          sx={{
            position: "absolute",
            top: 16,
            right: 72 + 54,
            zIndex: 1100,
            boxShadow: 1,
          }}
        >
          {VISUALIZATION.roadNetworkAnalysisOsm.components.filterPanel.actions.calculate}
        </Button>
      )}

      {renderStopSearch({}, isFs ? "fs" : "inline")}

      {/* time slider (isochrone) */}
      {sortedFeatures.length > 1 && (
        <div
          data-html2canvas-ignore
          style={{
            position: "absolute",
            bottom: 20,
            left: 10,
            zIndex: 1000,
            backgroundColor: "rgba(255,255,255,0.9)",
            padding: "8px 16px",
            borderRadius: "8px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            textAlign: "center",
            width: "min(260px, calc(100% - 26px))",
          }}
        >
          <div style={{ fontSize: 14, marginBottom: 4 }}>
            {VISUALIZATION.bufferAnalysis.components.map.time.travelTime}: {minutes ?? 0}
            {VISUALIZATION.bufferAnalysis.components.map.time.withinMinutesSuffix}
          </div>
          <input
            type="range"
            min={0}
            max={sortedFeatures.length - 1}
            step={1}
            value={Math.min(
              sliderValue,
              Math.max(sortedFeatures.length - 1, 0)
            )}
            onChange={handleSliderChange}
            style={{ width: "100%", marginBottom: "8px" }}
          />
          {layerState.isochrone && (
            <>
              <div style={{ fontSize: 13, marginBottom: 4, marginTop: 4 }}>
                {VISUALIZATION.bufferAnalysis.components.map.opacity.label}:{" "}
                {Math.round(isochroneOpacity * 100)}
                {VISUALIZATION.bufferAnalysis.components.map.opacity.percentSuffix}
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isochroneOpacity}
                onChange={handleOpacityChange}
                style={{ width: "100%" }}
              />
            </>
          )}
        </div>
      )}

      <div data-html2canvas-ignore>
        <MapLayerControlPanel
          additionalLayerItems={[
            {
              key: "routeColors",
              icon: RouteIcon,
              label: VISUALIZATION.common.map.labels.routeColors,
            },
            {
              key: "pois",
              icon: (
                <span className="material-symbols-outlined outlined">
                  location_on
                </span>
              ),
              label: VISUALIZATION.bufferAnalysis.components.map.layers.pois,
            },
            {
              key: "isochrone",
              icon: (
                <span className="material-symbols-outlined outlined">radar</span>
              ),
              label: VISUALIZATION.bufferAnalysis.components.map.layers.buffer,
            },
          ]}
          populationItems={[
            {
              key: "population",
              icon: (
                <span className="material-symbols-outlined outlined">groups</span>
              ),
              label: VISUALIZATION.bufferAnalysis.components.map.ageGroups.all,
            },
            {
              key: "population0_14",
              icon: (
                <span className="material-symbols-outlined outlined">groups</span>
              ),
              label: VISUALIZATION.bufferAnalysis.components.map.ageGroups.age0To14,
            },
            {
              key: "population15_64",
              icon: (
                <span className="material-symbols-outlined outlined">groups</span>
              ),
              label: VISUALIZATION.bufferAnalysis.components.map.ageGroups.age15To64,
            },
            {
              key: "population65_up",
              icon: (
                <span className="material-symbols-outlined outlined">groups</span>
              ),
              label: VISUALIZATION.bufferAnalysis.components.map.ageGroups.age65Up,
            },
          ]}
          layerState={layerState}
          onLayerToggle={handleLayerToggle}
          selectedTile={selectedTile}
          onTileSelect={setSelectedTile}
          minimized={minimized}
          setMinimized={setMinimized}
        />
      </div>

      <MapContainer
        key={scenarioId ?? "map"}
        center={center}
        zoom={DEFAULT_ZOOM}
        style={{ height: "100%", width: "100%" }}
        whenCreated={(map) => {
          mapRef.current = map;
        }}
        preferCanvas={true}
      >
        <UseMapInteractionSensor markInteracted={markUserInteracted} />

        <Pane style={{ display: "none" }} />

        {selectedTile === "pale" ? (
          // ✅ pale uses server-side greyscale tiles
          <ProxiedGrayTileLayer
            upstreamTemplate={GSI_TILE_URLS.pale}
            attribution={TILE_ATTRS.pale}
            tileLayerRef={tileLayerRef}
            pane="tilePane"
          />
        ) : (
          // other styles use normal TileLayer
          <TileLayer
            key={selectedTile}
            ref={tileLayerRef}
            url={TILE_URLS[selectedTile]}
            attribution={TILE_ATTRS[selectedTile]}
            crossOrigin="anonymous"
          />
        )}


        <RecenterOnCenterChange
          center={center}
          disabledUntilRef={recenterCooldownUntilRef}
          recentlyInteracted={recentlyInteracted}
        />

        <Pane
          name="road-network-origin-marker-pane"
          style={{ zIndex: ZINDEX.marker }}
        />
        <Pane name="poi-pane" style={{ zIndex: ZINDEX.poi }} />
        <Pane
          name="road-network-routes-pane"
          style={{ zIndex: ZINDEX.routes }}
        />
        <Pane
          name="road-network-stops-pane"
          style={{ zIndex: ZINDEX.stops }}
        />
        <Pane name="poi-popup-pane" style={{ zIndex: ZINDEX.info }} />
        <Pane name="population-pane" style={{ zIndex: ZINDEX.population }} />
        <Pane
          name="road-network-isochrone-pane"
          style={{ zIndex: ZINDEX.isochrone }}
        />

        <FocusOnStop stop={selectedStop} />

        <MapEvents
          onZoomChange={setZoom}
          onMoveOrZoomEnd={() => setLastInteractionTime(Date.now())}
        />
        {onMapClick && <ClickHandler onClick={(ll) => onMapClick?.(ll)} />}

        <FitOnRoutes
          key={routesKey}
          routeGeojson={routeGeojson}
          stopGeojson={stopGeojson}
          scenarioId={scenarioId}
          onDidFit={startRecenterCooldown}
          recentlyInteracted={recentlyInteracted}
        />
        <FitOnIsochrone
          isochroneGeojson={isochroneGeojson}
          onDidFit={startRecenterCooldown}
          recentlyInteracted={recentlyInteracted}
        />

        <Pane
          name="road-network-route-labels-pane"
          style={{ zIndex: ZINDEX.info }}
        />
        <Pane
          name="road-network-stop-labels-pane"
          style={{ zIndex: ZINDEX.info }}
        />
        <Pane
          name="road-network-labels-tooltip-pane"
          style={{ zIndex: ZINDEX.info }}
        />
        <Pane
          name="road-network-routes-tooltip-pane"
          style={{ zIndex: ZINDEX.info }}
        />

        {layerState.routeLabels &&
          routeLabelsWithOffsets.map((item, index) => {
            const pos = item.coordinates
              ? [item.coordinates[1], item.coordinates[0]]
              : null;
            if (!pos) return null;
            const color =
              layerState.routeColors && item.color ? toColor(item.color) : "#58AB39";
            return (
              <Marker
                key={`route-label-${index}`}
                position={pos}
                icon={BLANK_DIVICON}
                pane="road-network-route-labels-pane"
                interactive={false}
              >
                <RouteLabelTooltip
                  pane="road-network-routes-tooltip-pane"
                  labels={
                    Array.isArray(item.label) ? item.label : [item.label]
                  }
                  color={color}
                  direction="center"
                  offset={item._offset}
                />
              </Marker>
            );
          })}

        {layerState.stopLabels &&
          stopGeojson?.features?.map((f, i) => {
            if (f.geometry?.type !== "Point") return null;
            const [lng, lat] = f.geometry.coordinates || [];
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
            const name =
              f.properties?.parent_stop || f.properties?.stop_name || "";
            if (!name) return null;
            return (
              <Marker
                key={`stop-label-${i}`}
                position={[lat, lng]}
                icon={BLANK_DIVICON}
                pane="road-network-stop-labels-pane"
              >
                <StopLabelTooltip
                  stopName={name}
                  direction="top"
                  offset={[0, -10]}
                />
              </Marker>
            );
          })}

        {center && (
          <Marker
            pane="road-network-origin-marker-pane"
            position={
              isValidCoords(center)
                ? [parseFloat(center.lat), parseFloat(center.lng)]
                : [center.lat, center.lng]
            }
            icon={ORIGIN_ICON}  
          >
            <Popup className="tn-popup">
              {VISUALIZATION.roadNetworkAnalysisOsm.components.filterPanel.labels.origin}
            </Popup>
          </Marker>
        )}


        {layerState.isochrone &&
          (() => {
            if (!sortedFeatures.length) return null;

            const clampedIndex = Math.min(
              Math.max(sliderValue, 0),
              sortedFeatures.length - 1
            );

            const cutoffFeature = sortedFeatures[clampedIndex];
            const cutoffTime = cutoffFeature?.properties?.time;
            if (!Number.isFinite(cutoffTime)) return null;

            const visibleFeatures = sortedFeatures.filter(
              (f) => f.properties.time <= cutoffTime
            );

            const ordered = visibleFeatures
              .slice()
              .sort((a, b) => b.properties.time - a.properties.time);

            return ordered.map((feature, idx) => (
              <GeoJSON
                key={`${feature.id ?? idx}-${clampedIndex}`}
                data={feature}
                renderer={isochroneRenderer}
                pane="road-network-isochrone-pane"
                style={{
                  fillColor: colorMapping[feature.id],
                  fillOpacity: isochroneOpacity,
                  color: "#444",
                  weight: 1,
                }}
              />
            ));
          })()}

        {routeGeojson && (layerState.edges || layerState.routeColors) && (
          <GeoJSON
            key={routesKey}
            data={routeGeojson}
            renderer={routesRenderer}
            pane="road-network-routes-pane"
            style={(feature) => {
              const props = feature?.properties || {};
              let color = "#58AB39";

              if (
                layerState.routeColors &&
                Array.isArray(props.keyword_colors) &&
                props.keyword_colors.length > 0
              ) {
                const raw = props.keyword_colors[0];
                color = toColor(raw);
              }

              return {
                color,
                weight: 4,
                opacity: 0.7,
              };
            }}
          />
        )}

        {stopGeojson && layerState.stops && (
          <StopMarkerLayer
            key={stopsKey}
            stopGeojson={stopGeojson}
            pane="road-network-stops-pane"
            tooltipPane="road-network-stop-labels-pane"
          />
        )}

        {layerState.pois && (
          <>
            <PoiLayer
              pane="poi-pane"
              style={{ zIndex: 250 }}
              pois={poiData}
              radius={poiRadius}
              onSelectOrigin={handleSetOriginFromPOI}
              popupPaneName="poi-popup-pane"
            />
            {!isochroneActive && (
              <ViewportPoiLayer
                scenarioId={scenarioId}
                datasetId={undefined}
                categories={undefined}
                showMLIT={true}
                showCustom={true}
                minPointZoom={9}
                radius={poiRadius}
                onSelectOrigin={handleSetOriginFromPOI}
                popupPaneName="poi-popup-pane"
              />
            )}
          </>
        )}

        <PopulationLayer
          populationData={populationData}
          activeKey={activePopulationKey}
          renderer={populationRenderer}
          pane="population-pane"
          fillOpacity={0.3}
          weight={0.2}
          outlineColor="#ccc"
        />
        <PopulationAndIsochroneLegend
          activeKey={activePopulationKey}
          isoMinutes={legendMinutes}
          getIsoColor={getIsoLegendColor}
          isoOpacity={isochroneOpacity}
          isoCutoffMinutes={
            visibleItem?.properties?.time
              ? visibleItem.properties.time / 60
              : null
          }
          openDefault={false}
          showToggleButton={true}
          position={{ bottom: 33, right: 100 }}
          cardWidth={220}
          zIndex={1100}
        />
      </MapContainer>
    </Box>
  );
};

export default RoadNetworkMap;
