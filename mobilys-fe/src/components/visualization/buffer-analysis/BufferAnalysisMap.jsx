// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
// BufferAnalysisMap.jsx
import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
  Marker,
  Popup,
  useMapEvents,
  Pane,
  FeatureGroup,
} from "react-leaflet";
import L from "leaflet";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

import MapLayerControlPanel from "../bus-running-visualization/MapLayerControlPanel";
import IconButton from "@mui/material/IconButton";

import { PoiLayer } from "../../poi/PoiLayer";
import StopMarkerLayer from "../StopMarkerLayer";
import RouteLabelTooltip from "../RouteLabelTooltip";
import StopLabelTooltip from "../StopLabelTooltip";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { FocusOnStop, POPPER_Z } from "../bus-running-visualization/MapVisualization";

import { buildFilename } from "../buildFilename";
import ViewportPoiLayer from "../ViewportPoiLayer";
import PopulationAndIsochroneLegend from "../PopulationAndIsochroneLegend";
import RouteIcon from "../../../assets/logo/route-color-layer.png";
import "leaflet/dist/leaflet.css";
import { Box } from "@mui/material";
import "../../poi/POIMap.css";
import { VISUALIZATION } from "@/strings";
import { ProxiedGrayTileLayer } from "../map/ProxiedGrayTileLayer";
import { InvalidateSizeOnResize } from "../map/InvalidateSizeOnResize";
import { MapEvents } from "../map/MapEvents";
import { GSI_TILE_URLS, OSM_TILE_URL } from "../map/tileUrls";
import { useFullscreen } from "../map/useFullscreen";
import { useMapExport } from "../map/useMapExport";


L.Control.Attribution.prototype.options.prefix =
  '<a href="https://leafletjs.com" target="_blank" rel="noreferrer noopener">Leaflet</a>';

// ----- Leaflet default marker assets -----
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});


const DEFAULT_CENTER = { lat: 36.6958, lng: 137.2137 };
const DEFAULT_ZOOM = 13;

export const BLANK_DIVICON = new L.DivIcon({
  html: "",
  className: "blank-divicon",
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});

// ---- Origin flag icon as inline SVG (flag_2 style) ----
export const ORIGIN_ICON = new L.DivIcon({
  html: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="40"
      height="40"
      viewBox="0 0 24 24"
      aria-hidden="true"
      style="display:block;"
    >
      <!-- flag pole -->
      <rect x="6" y="4" width="2" height="16" fill="#e53935" />

      <!-- flag body with triangular V-shaped tip (flag_2-ish) -->
      <path
        d="
          M8 5
          H17
          L14 8.5
          L17 12
          H8
          Z
        "
        fill="#e53935"
      />
    </svg>
  `,
  className: "",
  iconSize: [40, 40],
  iconAnchor: [20, 38],   // bottom center-ish
  popupAnchor: [0, -38],
});

const sampleLegendMinutes = (minutesArr, maxSteps = 8) => {
  const uniq = Array.from(new Set((minutesArr || []).filter(Number.isFinite))).sort((a, b) => a - b);
  if (uniq.length <= maxSteps) return uniq;
  const res = [];
  for (let i = 0; i < maxSteps; i++) {
    const idx = Math.round((uniq.length - 1) * (i / (maxSteps - 1)));
    res.push(uniq[idx]);
  }
  return Array.from(new Set(res)).sort((a, b) => a - b);
};

function ClickHandler({ onClick }) {
  useMapEvents({
    click(e) {
      onClick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
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

const getRawTime = (feat) => {
  const p = feat?.features?.[0]?.properties ?? {};
  return Number(p.max_travel_time ?? p.max_time ?? p.time ?? NaN);
};

const toMinutes = (raw) => {
  if (!Number.isFinite(raw)) return null;
  return raw > 180 ? Math.round(raw / 60) : Math.round(raw);
};

function AutoFocus({
  mapFocusTrigger,
  center,
  visibleBufferLayer,
  bufferVersion,
  maxBufferLayer,
  stopGeojson,
  routeGeojson,
  recenterZoom = 13,
}) {
  const map = useMap();
  const fittedRef = React.useRef(null);

  useEffect(() => {
    if (!map || !mapFocusTrigger) return;

    if (
      mapFocusTrigger === "coords" &&
      center &&
      !isNaN(parseFloat(center.lat)) &&
      !isNaN(parseFloat(center.lng))
    ) {
      map.setView([parseFloat(center.lat), parseFloat(center.lng)], recenterZoom);
    }

    if (mapFocusTrigger === "buffer" && fittedRef.current !== bufferVersion && maxBufferLayer) {
      try {
        const bounds = L.geoJSON(maxBufferLayer).getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [20, 20], maxZoom: 16 });
          fittedRef.current = bufferVersion;
        }
      } catch { }
    }

    if (mapFocusTrigger === "scenario" && routeGeojson?.features?.length > 0) {
      const bounds = L.geoJSON(routeGeojson).getBounds();
      if (bounds.isValid()) {
        const c = bounds.getCenter();
        map.setView(c, recenterZoom);
      }
    }
  }, [
    map,
    mapFocusTrigger,
    center,
    stopGeojson,
    visibleBufferLayer,
    recenterZoom,
    bufferVersion,
    maxBufferLayer,
    routeGeojson,
  ]);

  return null;
}

export const lineLabelLatLng = (geometry) => {
  if (!geometry) return null;
  const { type, coordinates } = geometry;
  if (type === "LineString" && Array.isArray(coordinates) && coordinates.length) {
    const mid = Math.floor(coordinates.length / 2);
    const [lng, lat] = coordinates[mid];
    return [lat, lng];
  }
  if (type === "MultiLineString" && Array.isArray(coordinates) && coordinates.length) {
    const longest = coordinates.reduce(
      (acc, cur) => (cur.length > (acc?.length || 0) ? cur : acc),
      null
    );
    if (longest && longest.length) {
      const mid = Math.floor(longest.length / 2);
      const [lng, lat] = longest[mid];
      return [lat, lng];
    }
  }
  return null;
};

export const toColor = (hexMaybe) => {
  if (!hexMaybe) return undefined;
  const t = String(hexMaybe).trim();
  return t.startsWith("#") ? t : `#${t}`;
};

const BufferAnalysisMap = ({
  center = DEFAULT_CENTER,
  routeGeojson = null,
  stopGeojson = null,
  onMapClick = null,
  mapFocusTrigger = null,
  bufferGeojsonLayers = [],
  pois = [],
  scenarioId = undefined,
  populationData = null,
  onCutoffIndexChange,
  bufferVersion = 0,
  scenarioName,
  screenName = VISUALIZATION.titles.bufferAnalysis,
}) => {
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [lastValidCoords, setLastValidCoords] = useState(null);
  const [bufferOpacity, setBufferOpacity] = useState(0.3);

  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const containerRef = useRef(null);
  const mapAreaRef = useRef(null);

  // track last pan/zoom time for cooldown
  const [lastInteractionTime, setLastInteractionTime] = useState(0);

  // Shared fullscreen hook
  const { isFullscreen: isFs, toggleFullscreen: toggleFullScreen } = useFullscreen({
    containerRef,
    onFullscreenChange: () => {
      window.dispatchEvent(new Event("resize"));
      mapRef.current?.invalidateSize?.({ animate: false });
    },
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
      alert(
        VISUALIZATION.common.map.errors.pngExportFailedPrefix +
        (err?.message || err)
      );
    }
  }, [exportPng]);

  // renderers
  const canvasRenderer = useMemo(() => L.canvas({ padding: 0.5 }), []);
  const routesRenderer = useMemo(
    () => L.canvas({ padding: 0.5, pane: "buffer-analysis-routes-pane" }),
    []
  );
  const populationRenderer = useMemo(
    () => L.canvas({ padding: 0.5, pane: "population-pane" }),
    []
  );

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

  const sortedFeatures = useMemo(() => {
    if (!Array.isArray(bufferGeojsonLayers)) return [];
    const items = bufferGeojsonLayers
      .map((f) => ({ feat: f, minutes: toMinutes(getRawTime(f)) }))
      .filter((x) => Number.isFinite(x.minutes) && x.minutes != null);
    items.sort((a, b) => a.minutes - b.minutes);
    return items;
  }, [bufferGeojsonLayers]);

  const minTime = sortedFeatures[0]?.minutes ?? 0;
  const maxTime = sortedFeatures[sortedFeatures.length - 1]?.minutes ?? 0;

  const getColor = (minutes) => {
    if (maxTime === minTime) return "rgb(255,255,0)";
    const ratio = 1 - (minutes - minTime) / (maxTime - minTime);
    const g = 255 - Math.round(ratio * 255);
    return `rgb(255,${g},0)`;
  };

  const colorMapping = useMemo(() => {
    const m = {};
    for (const it of sortedFeatures) m[it.minutes] = getColor(it.minutes);
    return m;
  }, [sortedFeatures, minTime, maxTime]);

  const [sliderValue, setSliderValue] = useState(Math.max(sortedFeatures.length - 1, 0));
  const visibleItem =
    sortedFeatures.length > 0
      ? sortedFeatures[Math.min(sliderValue, sortedFeatures.length - 1)]
      : null;

  const handleSliderChange = (e) => {
    const v = Number(e.target.value);
    setSliderValue(v);
    const mins = sortedFeatures[v]?.minutes ?? null;
    onCutoffIndexChange?.(v, mins);
  };

  const handleOpacityChange = (e) => setBufferOpacity(Number(e.target.value));

  useEffect(() => {
    const last = Math.max(sortedFeatures.length - 1, 0);
    setSliderValue(last);
    const mins = sortedFeatures[last]?.minutes ?? null;
    onCutoffIndexChange?.(last, mins);
  }, [bufferVersion, sortedFeatures.length]); // eslint-disable-line

  useEffect(() => {
    if (!center && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setMapCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => { }
      );
    }
  }, [center]);

  useEffect(() => {
    const lat = parseFloat(center?.lat);
    const lng = parseFloat(center?.lng);
    if (!isNaN(lat) && !isNaN(lng)) setLastValidCoords({ lat, lng });
  }, [center]);

  // layer toggles
  const [layerState, setLayerState] = React.useState({
    edges: true,          // green route lines
    routeColors: false,   // multi-color routes
    routeLabels: false,
    stopLabels: false,
    stops: true,
    pois: true,
    buffer: true,
    population: true,
    population0_14: false,
    population15_64: false,
    population65_up: false,
  });

  const [selectedTile, setSelectedTile] = React.useState("pale");
  const [minimized, setMinimized] = React.useState(true);

  const handleLayerToggle = (key) =>
    setLayerState((s) => {
      // Mutually exclusive: edges (green) vs routeColors (colored)
      if (key === "edges") {
        const nextEdges = !s.edges;

        // If turning edges OFF, force routeColors ON
        // If turning edges ON, force routeColors OFF
        return {
          ...s,
          edges: nextEdges,
          routeColors: nextEdges ? false : true,
        };
      }

      if (key === "routeColors") {
        const nextRouteColors = !s.routeColors;

        // If turning routeColors OFF, force edges ON
        // If turning routeColors ON, force edges OFF
        return {
          ...s,
          routeColors: nextRouteColors,
          edges: nextRouteColors ? false : true,
        };
      }

      // default behavior for other layer keys
      return { ...s, [key]: !s[key] };
    });

  const handleTileSelect = (key) => setSelectedTile(key);

  const isochroneActive = layerState.buffer && sortedFeatures.length > 0;

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
          label={VISUALIZATION.common.map.labels.stopSelect}
        />
      )}
      data-html2canvas-ignore
    />
  );

  // Build unique route labels
  const uniqueRouteLabels = useMemo(() => {
    const res = [];
    const seen = new Set();
    const feats = routeGeojson?.features || [];
    for (const f of feats) {
      if (f?.geometry?.type !== "LineString") continue;
      const labels = f?.properties?.keywords || [];
      const labelColor = f?.properties?.keyword_colors || [];
      const midLatLng = lineLabelLatLng(f.geometry);
      const anchorLngLat = midLatLng
        ? [midLatLng[1], midLatLng[0]]
        : (Array.isArray(f.geometry.coordinates) && f.geometry.coordinates[0]) || null;
      labels.forEach((label, i) => {
        if (label == null || seen.has(label)) return;
        seen.add(label);
        const rawColor = labelColor[i];
        const color = rawColor ? (rawColor.startsWith?.("#") ? rawColor : `#${rawColor}`) : null;
        res.push({ label, coordinates: anchorLngLat, color });
      });
    }
    return res;
  }, [routeGeojson]);

  // Tiles
  const TILE_URLS = {
    pale: GSI_TILE_URLS.pale,
    std: GSI_TILE_URLS.std,
    blank: GSI_TILE_URLS.blank,
    photo: GSI_TILE_URLS.photo,
    osm: OSM_TILE_URL,
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

  // sizing rule for poi markers
  function stopLikeDiameter(zoom) {
    const size = Math.max(6, Math.min(9, Math.round(6 + 0.9 * (zoom - 12))));
    const border = Math.max(1, Math.round(size * 0.22));
    return size + 2 * border;
  }

  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const poiRadius = useMemo(() => stopLikeDiameter(zoom), [zoom]);

  const handleSetOriginFromPOI = (lat, lon) => {
    setLastValidCoords({ lat, lng: lon });
    onMapClick?.({ lat, lng: lon });
  };

  const PopulationLayer = React.memo(
    ({ populationData, layerState, renderer }) => {
      const activeKey = ["population", "population0_14", "population15_64", "population65_up"].find(
        (k) => layerState[k]
      );
      if (!populationData || !activeKey) return null;
      const bins =
        activeKey === "population"
          ? [0, 200, 500, 800, 1000, 3000, 6000]
          : [0, 50, 100, 200, 400, 800, 1600];
      const getValue = (props = {}) => {
        switch (activeKey) {
          case "population0_14":
            return Number(props.age_0_14 ?? 0);
          case "population15_64":
            return Number(props.age_15_64 ?? 0);
          case "population65_up":
            return Number(props.age_65_up ?? 0);
          default:
            return Number(props.total ?? 0);
        }
      };
      const pickColor = (v) => {
        if (v <= bins[0]) return "#ffffff";
        if (v <= bins[1]) return "#fff2b2";
        if (v <= bins[2]) return "#f2d8a7";
        if (v <= bins[3]) return "#f0a4a4";
        if (v <= bins[4]) return "#e98f8f";
        if (v <= bins[5]) return "#de6c6c";
        if (v <= bins[6]) return "#cd4646";
        return "#b11e1e";
      };
      return (
        <GeoJSON
          key={`population-${activeKey}`}
          data={populationData}
          renderer={renderer}
          pane="population-pane"
          style={(feature) => {
            const v = getValue(feature?.properties);
            return { fillColor: pickColor(v), fillOpacity: 0.3, color: "#ccc", weight: 0.2 };
          }}
        />
      );
    },
    (prev, next) => {
      const k = (ls) =>
        ["population", "population0_14", "population15_64", "population65_up"].find((x) => ls[x]);
      return prev.populationData === next.populationData && k(prev.layerState) === k(next.layerState);
    }
  );


  const legendMinutes = useMemo(
    () => sampleLegendMinutes(sortedFeatures.map((x) => x.minutes), 8),
    [sortedFeatures]
  );

  const populationLegendActive = ["population", "population0_14", "population15_64", "population65_up"]
    .some((k) => layerState[k]);

  return (
    <Box
      ref={containerRef}
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        "& .leaflet-control-attribution": {
          marginRight: "16px",
          marginBottom: "11px",
        },
      }}
    >
      {/* Controls */}
      <IconButton
        data-html2canvas-ignore
        onClick={toggleFullScreen}
        sx={{ position: "absolute", top: 16, right: 16, zIndex: 1100, bgcolor: "#fff", boxShadow: 1 }}
        size="large"
        aria-label="fullscreen"
        disabled={exporting}
        title="Fullscreen"
      >
        {isFs ? (
          <span className="material-symbols-outlined outlined">fullscreen_exit</span>
        ) : (
          <span className="material-symbols-outlined outlined">fullscreen</span>
        )}
      </IconButton>

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
        title="Download PNG"
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

      {renderStopSearch({}, isFs ? "fs" : "inline")}

      {/* Layer panel */}
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
              icon: <span className="material-symbols-outlined outlined">location_on</span>,
              label: VISUALIZATION.bufferAnalysis.components.map.layers.pois,
            },
            {
              key: "buffer",
              icon: <span className="material-symbols-outlined outlined">radar</span>,
              label: VISUALIZATION.bufferAnalysis.components.map.layers.buffer,
            },
          ]}
          populationItems={[
            {
              key: "population",
              icon: <span className="material-symbols-outlined outlined">groups</span>,
              label: VISUALIZATION.common.filters.all,
            },
            {
              key: "population0_14",
              icon: <span className="material-symbols-outlined outlined">groups</span>,
              label: VISUALIZATION.bufferAnalysis.components.map.ageGroups.age0To14,
            },
            {
              key: "population15_64",
              icon: <span className="material-symbols-outlined outlined">groups</span>,
              label: VISUALIZATION.bufferAnalysis.components.map.ageGroups.age15To64,
            },
            {
              key: "population65_up",
              icon: <span className="material-symbols-outlined outlined">groups</span>,
              label: VISUALIZATION.bufferAnalysis.components.map.ageGroups.age65Up,
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

      {/* Slider & opacity */}
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
            {VISUALIZATION.bufferAnalysis.components.map.time.travelTime}:{" "}
            {Math.round(visibleItem?.minutes ?? 0)}
            {VISUALIZATION.bufferAnalysis.components.map.time.withinMinutesSuffix}
          </div>
          <input
            type="range"
            min={0}
            max={sortedFeatures.length - 1}
            step={1}
            value={Math.min(sliderValue, Math.max(sortedFeatures.length - 1, 0))}
            onChange={handleSliderChange}
            style={{ width: "100%", marginBottom: "8px" }}
          />
          {layerState.buffer && (
            <>
              <div style={{ fontSize: 13, marginBottom: 4, marginTop: 4 }}>
                {VISUALIZATION.bufferAnalysis.components.map.opacity.label}:{" "}
                {Math.round(bufferOpacity * 100)}
                {VISUALIZATION.bufferAnalysis.components.map.opacity.percentSuffix}
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={bufferOpacity}
                onChange={handleOpacityChange}
                style={{ width: "100%" }}
              />
            </>
          )}
        </div>
      )}

      {/* Map area */}
      <div ref={mapAreaRef} style={{ position: "absolute", inset: 0 }}>
        <MapContainer
          key={`map-${bufferVersion}`}
          center={
            isValidCoords(center)
              ? [parseFloat(center.lat), parseFloat(center.lng)]
              : [mapCenter.lat, mapCenter.lng]
          }
          zoom={DEFAULT_ZOOM}
          style={{ height: "100%", width: "100%" }}
          whenCreated={(map) => {
            mapRef.current = map;
          }}
          preferCanvas={true}
        >
          <InvalidateSizeOnResize targetRef={containerRef} deps={[minimized, isFs]} />
          <FocusOnStop stop={selectedStop} />

          {/* Panes */}
          <Pane name="buffer-analysis-origin-marker-pane" style={{ zIndex: 705 }} />
          <Pane name="buffer-analysis-route-labels-pane" style={{ zIndex: 745 }} />
          <Pane name="buffer-analysis-stop-labels-pane" style={{ zIndex: 780 }} />
          <Pane name="buffer-analysis-labels-tooltip-pane" style={{ zIndex: 755 }} />
          <Pane name="buffer-analysis-route-tooltip-pane" style={{ zIndex: 770 }} />
          <Pane name="buffer-analysis-routes-pane" style={{ zIndex: 600 }} />
          <Pane name="buffer-analysis-routes-colored-pane" style={{ zIndex: 610 }} />
          <Pane name="buffer-analysis-stops-pane" style={{ zIndex: 680 }} />
          <Pane name="population-pane" style={{ zIndex: 200 }} />

          {/* track last pan/zoom for cooldown */}
          <MapEvents
            onZoomChange={setZoom}
            onMoveOrZoomEnd={() => setLastInteractionTime(Date.now())}
          />

          {/* Base tiles:
              - "pale": greyscale via backend proxy
              - others: direct URLs
           */}
          {selectedTile === "pale" ? (
            <ProxiedGrayTileLayer
              upstreamTemplate={GSI_TILE_URLS.pale}
              attribution={TILE_ATTRS.pale}
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

          <PopulationLayer
            populationData={populationData}
            layerState={layerState}
            renderer={populationRenderer}
          />

          <AutoFocus
            mapFocusTrigger={mapFocusTrigger}
            center={center}
            stopGeojson={stopGeojson}
            visibleBufferLayer={visibleItem?.feat}
            recenterZoom={DEFAULT_ZOOM}
            bufferVersion={bufferVersion}
            routeGeojson={routeGeojson}
            maxBufferLayer={sortedFeatures[sortedFeatures.length - 1]?.feat}
          />

          {onMapClick && <ClickHandler onClick={onMapClick} />}

          {lastValidCoords && (
            <Marker
              pane="buffer-analysis-origin-marker-pane"
              position={
                isValidCoords(center)
                  ? [parseFloat(center.lat), parseFloat(center.lng)]
                  : [lastValidCoords.lat, lastValidCoords.lng]
              }
              icon={ORIGIN_ICON}
            >

              <Popup>
                {!isNaN(parseFloat(center?.lat)) && !isNaN(parseFloat(center?.lng))
                  ? VISUALIZATION.bufferAnalysis.components.map.originLabel
                  : ""}
              </Popup>
            </Marker>
          )}

          {layerState.buffer && sortedFeatures.length > 0 && (
            <FeatureGroup key={`buffers-${bufferVersion}`}>
              {sortedFeatures
                .filter((it) => {
                  const cutoff = visibleItem?.minutes ?? null;
                  return Number.isFinite(cutoff) ? it.minutes <= cutoff : false;
                })
                .reverse()
                .map((it, idx) => (
                  <GeoJSON
                    key={`buf-${bufferVersion}-${it.minutes}-${idx}`}
                    data={it.feat}
                    pane={`bufferPane-${bufferVersion}-${it.minutes}`}
                    renderer={canvasRenderer}
                    style={{
                      fillColor: colorMapping[it.minutes] || "#444",
                      fillOpacity: bufferOpacity,
                      color: "#444",
                      weight: 1,
                    }}
                  />
                ))}
            </FeatureGroup>
          )}

          {/* 1) Base green route layer (edges toggle) */}
          {routeGeojson && layerState.edges && (
            <GeoJSON
              data={routeGeojson}
              pane="buffer-analysis-routes-pane"
              renderer={routesRenderer}
              style={() => ({
                color: "#58AB39",     // always green
                weight: 3,            // base thickness
                opacity: 0.7,
              })}
            />
          )}

          {/* 2) Colored route overlay (routeColors toggle) */}
          {routeGeojson && layerState.routeColors && (
            <GeoJSON
              data={routeGeojson}
              pane="buffer-analysis-routes-colored-pane"
              renderer={routesRenderer}
              style={(feature) => {
                const props = feature?.properties || {};
                let color = "#58AB39";

                if (Array.isArray(props.keyword_colors) && props.keyword_colors.length > 0) {
                  const raw = props.keyword_colors[0];
                  color = toColor(raw) || "#58AB39";
                }

                return {
                  color,
                  weight: 4,          // slightly thicker so it stands out above green
                  opacity: 0.9,
                };
              }}
            />
          )}

          {stopGeojson && layerState.stops && (
            <StopMarkerLayer
              stopGeojson={stopGeojson}
              pane="buffer-analysis-stops-pane"
              tooltipPane="buffer-analysis-labels-tooltip-pane"
            />
          )}

          {layerState.routeLabels &&
            uniqueRouteLabels.map((item, i) => {
              const pos = item.coordinates ? [item.coordinates[1], item.coordinates[0]] : null;
              if (!pos) return null;
              const color = layerState.routeColors ? toColor(item.color || "#58AB39") : "#58AB39";
              return (
                <Marker
                  key={`route-label-${i}`}
                  position={pos}
                  icon={BLANK_DIVICON}
                  pane="buffer-analysis-route-labels-pane"
                  interactive={false}
                >
                  <RouteLabelTooltip
                    pane="buffer-analysis-route-tooltip-pane"
                    labels={Array.isArray(item.label) ? item.label : [item.label]}
                    color={color}
                    direction="center"
                    offset={[0, 0]}
                  />
                </Marker>
              );
            })}

          {layerState.stopLabels &&
            stopGeojson?.features?.map((f, i) => {
              if (f.geometry?.type !== "Point") return null;
              const [lng, lat] = f.geometry.coordinates || [];
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
              const name = f.properties?.parent_stop || f.properties?.stop_name || "";
              if (!name) return null;
              return (
                <Marker
                  key={`stop-label-${i}`}
                  position={[lat, lng]}
                  icon={BLANK_DIVICON}
                  pane="buffer-analysis-stop-labels-pane"
                >
                  <StopLabelTooltip
                    pane="buffer-analysis-labels-tooltip-pane"
                    stopName={name}
                    direction="top"
                    offset={[0, -10]}
                  />
                </Marker>
              );
            })}

          {/* POI & Population */}
          <Pane name="poi-pane" style={{ zIndex: 690 }} />

          <PopulationAndIsochroneLegend
            activeKey={[
              "population",
              "population0_14",
              "population15_64",
              "population65_up",
            ].find((k) => layerState[k])}
            isoMinutes={legendMinutes}
            getIsoColor={getColor}
            isoOpacity={bufferOpacity ?? 0.3}
            isoCutoffMinutes={visibleItem?.minutes}
            openDefault={false}
            showToggleButton={true}
            position={{ bottom: 33, right: 100 }}
            cardWidth={220}
            zIndex={1000}
          />

          {layerState.pois && (
            <>
              <PoiLayer
                pane="poi-pane"
                pois={Array.isArray(pois) ? pois : []}
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
        </MapContainer>
      </div>
    </Box>
  );
};

export default BufferAnalysisMap;
