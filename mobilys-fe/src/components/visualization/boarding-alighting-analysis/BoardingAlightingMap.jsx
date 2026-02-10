// src/components/visualization/boarding_alighting_analysis/BoardingAlightingMap.jsx
import React, { useState, useMemo, useRef } from "react";
import {
  Box,
  Tooltip as MuiTooltip,
} from "@mui/material";

import PaleMap from "../../../assets/photos/pale.png";
import StdMap from "../../../assets/photos/std.png";
import BlankMap from "../../../assets/photos/blank.png";
import PhotoMap from "../../../assets/photos/photo.jpg";

import RouteIcon from "../../../assets/logo/route-color-layer.png";
import StopLabelTooltip from "../StopLabelTooltip";
import RouteLabelTooltip from "../RouteLabelTooltip";
import { BLANK_DIVICON } from "../buffer-analysis/BufferAnalysisMap";

import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Pane,
} from "react-leaflet";
import "../MapVisualization.css";
import MapLayerControlPanel from "../bus-running-visualization/MapLayerControlPanel";
import { FocusOnStop } from "../map/MapSharedComponents";
import { useMapExport } from "../map/useMapExport";
import { VISUALIZATION } from "@/strings";
import { ProxiedGrayTileLayer } from "../map/ProxiedGrayTileLayer";
import { GSI_TILE_URLS } from "../map/tileUrls";

// Utils
import { buildThresholds, makeRamp, roundCoordinate, midpointLatLng } from "./utils";

// Helpers
import { LegendPanel, METRIC_BASE } from "./helpers/LegendPanel";
import { HighlightPolyline } from "./helpers/HighlightPolyline";
import { AutoZoomToRoutes, MapInteractionTracker } from "./helpers/MapHelpers";
import { StopsLayer } from "./helpers/StopsLayer";
import { SegmentsLayer } from "./helpers/SegmentsLayer";
import { StopSearchAutocomplete } from "./helpers/StopSearchAutocomplete";
import {
  MetricSelector,
  LegendToggleButton,
  FullscreenButton,
  DownloadButton,
  ExportingOverlay,
} from "./helpers/MapControls";
import { useFullscreen } from "../map/useFullscreen";

// ---------- base maps ----------
const mapBaseItems = [
  {
    key: "pale",
    thumb: PaleMap,
    label: VISUALIZATION.common.map.baseMaps.pale,
    url: GSI_TILE_URLS.pale,
    attribution: VISUALIZATION.common.map.attributions.gsi,
  },
  {
    key: "std",
    thumb: StdMap,
    label: VISUALIZATION.common.map.baseMaps.std,
    url: GSI_TILE_URLS.std,
    attribution: VISUALIZATION.common.map.attributions.gsi,
  },
  {
    key: "blank",
    thumb: BlankMap,
    label: VISUALIZATION.common.map.baseMaps.blank,
    url: GSI_TILE_URLS.blank,
    attribution: VISUALIZATION.common.map.attributions.gsi,
  },
  {
    key: "photo",
    thumb: PhotoMap,
    label: VISUALIZATION.common.map.baseMaps.photo,
    url: GSI_TILE_URLS.photo,
    attribution: VISUALIZATION.common.map.attributions.gsi,
  },
];

/* ============== Main ============== */
export default function BoardingAlightingMap({
  selectedVisualization,
  allRoutesData,
  boardingAlightingResult,
  metric,
  onMetricChange,
  onSegmentClick,
  onStopClick,
  scenarioName = "scenario",
}) {
  const [selectedTile, setSelectedTile] = useState("pale");
  const [tilePanelMinimized, setTilePanelMinimized] = useState(true);
  const [showLegend, setShowLegend] = useState(false);
  const [view, setView] = useState({ center: [36.701038, 137.21294], zoom: 13 });

  const [layers, setLayers] = useState({
    edges: true,
    routeLabels: false,
    routeColors: false,
    stops: true,
    stopLabels: false,
    segments: true,
    highlight: true,
  });

  const handleLayerToggle = (key) =>
    setLayers((s) => {
      // Mutual exclusion: edges (green) vs routeColors (multi-color)
      if (key === "edges") {
        const nextEdges = !s.edges;

        return {
          ...s,
          edges: nextEdges,
          // If edges is turned ON, turn routeColors OFF; if edges is OFF, turn routeColors ON.
          routeColors: nextEdges ? false : true,
        };
      }

      if (key === "routeColors") {
        const nextRouteColors = !s.routeColors;

        return {
          ...s,
          routeColors: nextRouteColors,
          // If routeColors is turned ON, turn edges OFF; if routeColors is OFF, turn edges ON.
          edges: nextRouteColors ? false : true,
        };
      }

      return { ...s, [key]: !s[key] };
    });

  const handleTileSelect = (key) => setSelectedTile(key);

  const defaultCenter = [36.701038, 137.21294];
  const defaultZoom = 13;

  // ===== Fullscreen & export refs =====
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const [lastInteractionTime, setLastInteractionTime] = useState(0);

  const { isFullscreen, toggleFullscreen } = useFullscreen({ containerRef, mapRef });

  const { exporting, exportPng } = useMapExport({
    containerRef,
    mapRef,
    tileLayerRef,
    lastInteractionTime,
    getFilename: () => {
      const metricLabelForName = (METRIC_BASE[metric] || METRIC_BASE.in_car).label;
      const scenarioPart = scenarioName || VISUALIZATION.common.scenarioFallbackName;
      return `${scenarioPart}_${VISUALIZATION.boardingAlightingAnalysis.exports.screenName}_${VISUALIZATION.boardingAlightingAnalysis.exports.maps.routeMap.title}(${metricLabelForName})_${VISUALIZATION.boardingAlightingAnalysis.exports.mapSuffix}.png`;
    },
  });

  // PNG export logic is centralized in useMapExport.

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

  // base routes & tiles
  const routeFeatures =
    selectedVisualization === 0 &&
    allRoutesData?.routesGeoJSON?.features?.filter((f) => f.geometry?.type === "LineString");
  const hasBase = Array.isArray(routeFeatures) && routeFeatures.length > 0;

  // Unique route labels (dedupe by text; pick a stable midpoint anchor)
  const uniqueRouteLabels = useMemo(() => {
    if (!hasBase) return [];
    const seen = new Set();
    const out = [];

    // Removed midpointLatLng - now imported from utils

    for (const f of routeFeatures) {
      const labels =
        f?.properties?.keywords || f?.properties?.route_groups || [];
      if (!labels?.length) continue;

      const colors = f?.properties?.keyword_colors || [];

      const anchor =
        midpointLatLng(f.geometry) ||
        (Array.isArray(f.geometry?.coordinates) && f.geometry.coordinates[0]
          ? [f.geometry.coordinates[0][1], f.geometry.coordinates[0][0]]
          : null);

      labels.forEach((label, idx) => {
        if (label == null) return;
        const key = String(label).trim().toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);

        let rawColor = colors[idx] || colors[0] || null;
        let color = null;
        if (typeof rawColor === "string" && rawColor.length) {
          color = `#${String(rawColor).replace(/^#?/, "")}`;
        }

        out.push({ label, latlng: anchor, color });
      });
    }

    return out;
  }, [hasBase, routeFeatures]);

  const tileUrl = useMemo(() => mapBaseItems.find((i) => i.key === selectedTile)?.url || mapBaseItems[0].url, [selectedTile]);
  const tileAttr = useMemo(() => mapBaseItems.find((i) => i.key === selectedTile)?.attribution || mapBaseItems[0].attribution, [selectedTile]);

  const highlightCoordsNonIncar = useMemo(() => {
    const feats = boardingAlightingResult?.data?.features;
    if (!Array.isArray(feats)) return null;
    const multi = feats.find((f) => f.geometry?.type === "MultiLineString");
    if (multi) return multi.geometry.coordinates;
    const line = feats.find((f) => f.geometry?.type === "LineString");
    if (line) return [line.geometry.coordinates];
    return null;
  }, [boardingAlightingResult]);

  const stopsFeatures = useMemo(() => {
    const feats = boardingAlightingResult?.data?.features;
    if (!Array.isArray(feats)) return [];
    const feature = feats.find((f) => f.geometry?.type === "MultiLineString" || f.geometry?.type === "LineString");
    return feature?.properties?.stops_features || [];
  }, [boardingAlightingResult]);

  const stopOptions = useMemo(
    () =>
      (stopsFeatures || []).map((s) => ({
        id: s?.properties?.keyword || "",
        label:
          s?.properties?.keyword || VISUALIZATION.common.map.labels.stopFallback,
        lat: s.geometry.coordinates[1],
        lng: s.geometry.coordinates[0],
      })), [stopsFeatures]
  );

  const [selectedStop, setSelectedStop] = useState(null);
  const [searchInput, setSearchInput] = useState("");



  const segmentLabels = useMemo(() => {
    const feats = boardingAlightingResult?.data?.features;
    if (!Array.isArray(feats)) return [];
    const feature = feats.find((f) => f.geometry?.type === "MultiLineString" || f.geometry?.type === "LineString");
    return feature?.properties?.segment_labels || [];
  }, [boardingAlightingResult]);

  const stopValueIndex = useMemo(() => {
    const idx = new Map();
    for (const s of stopsFeatures) {
      const [lng, lat] = s?.geometry?.coordinates || [];
      const key = `${roundCoordinate(lat)},${roundCoordinate(lng)}`;
      idx.set(key, {
        geton: Number(s?.properties?.count_geton ?? 0),
        getoff: Number(s?.properties?.count_getoff ?? 0),
      });
    }
    return idx;
  }, [stopsFeatures]);

  const { values, baseHex } = useMemo(() => {
    if (metric === "in_car") {
      return {
        values: segmentLabels.map((s) => Number(s?.properties?.value ?? 0)),
        baseHex: METRIC_BASE.in_car.base,
      };
    }
    if (metric === "boarding") {
      return {
        values: stopsFeatures.map((s) => Number(s?.properties?.count_geton ?? 0)),
        baseHex: METRIC_BASE.boarding.base,
      };
    }
    return {
      values: stopsFeatures.map((s) => Number(s?.properties?.count_getoff ?? 0)),
      baseHex: METRIC_BASE.alighting.base,
    };
  }, [metric, stopsFeatures, segmentLabels]);

  const { thresholds } = useMemo(() => buildThresholds(values, 5), [values]);
  const ramp = useMemo(() => makeRamp(baseHex), [baseHex]);



  const ToggleTile = ({ active, label, onClick, imgSrc, muiIcon }) => (
    <Box
      onClick={onClick}
      sx={{
        cursor: "pointer", userSelect: "none",
        borderRadius: 2,
        border: active ? "2px solid #222" : "2px solid #e5e7eb",
        boxShadow: active ? 2 : "none",
        background: "#fff",
        minWidth: 86, maxWidth: 120, p: 1, textAlign: "center", mr: 1.2, flex: "0 0 auto",
        transition: "border .15s, box-shadow .15s",
      }}
      title={label}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", mb: .5 }}>
        {imgSrc ? (
          <img src={imgSrc} alt={label} style={{ width: 22, height: 22, objectFit: "contain", opacity: active ? 1 : 0.55 }} />
        ) : (
          React.cloneElement(muiIcon, { sx: { fontSize: 22, color: active ? "#111" : "#999" } })
        )}
      </Box>
      <Typography sx={{ fontSize: 12, color: active ? "#111" : "#999" }}>{label}</Typography>
    </Box>
  );

  // --- effective base map (user choice vs forced pale) ---
  const selectedBase =
    mapBaseItems.find((i) => i.key === selectedTile) || mapBaseItems[0];

  // what the map actually uses:
  // - selectedVisualization === 0 → use user-selected tile
  // - otherwise → always pale (index 0)
  const effectiveUrl =
    selectedVisualization === 0 ? selectedBase.url : mapBaseItems[0].url;
  const effectiveAttr =
    selectedVisualization === 0
      ? selectedBase.attribution
      : mapBaseItems[0].attribution;
  const effectiveKey =
    selectedVisualization === 0 ? selectedTile : "default-pale";

  // is the effective tile the pale tile? (then use grayscale proxy)
  const isPaleEffective = effectiveUrl === mapBaseItems[0].url;


  return (
    <Box
      ref={containerRef}
      id="ba-map-root"
      data-map-root
      sx={{
        width: "100%", height: "100%", minHeight: 0, minWidth: 0, position: "relative",
        backgroundColor: "#fff",
        "& .leaflet-container": { width: "100%", height: "100%", borderRadius: 2 },
        "&:fullscreen .leaflet-container": { borderRadius: 0 },
        "&:-webkit-full-screen .leaflet-container": { borderRadius: 0 },
        "& .leaflet-control-attribution": {
          marginRight: "16px",
          marginBottom: "11px",  // tweak 70–90px if you want it higher/lower
        },
      }}
    >
      <FullscreenButton
        isFullscreen={isFullscreen}
        toggleFullscreen={toggleFullscreen}
        exporting={exporting}
      />

      <DownloadButton
        handleDownloadPNG={handleDownloadPNG}
        exporting={exporting}
      />

      <ExportingOverlay exporting={exporting} />

      <StopSearchAutocomplete
        stopOptions={stopOptions}
        selectedStop={selectedStop}
        setSelectedStop={setSelectedStop}
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        keyProp={isFullscreen ? "fs" : "inline"}
      />

      <MetricSelector metric={metric} onMetricChange={onMetricChange} />



      <LegendToggleButton showLegend={showLegend} setShowLegend={setShowLegend} />

      <div data-html2canvas-ignore>
        <MapLayerControlPanel
          additionalLayerItems={[
            {
              key: "routeColors",
              icon: RouteIcon,
              label: VISUALIZATION.common.map.labels.routeColors,
            },
          ]}
          layerState={layers}
          onLayerToggle={handleLayerToggle}
          selectedTile={selectedTile}
          onTileSelect={handleTileSelect}
          minimized={tilePanelMinimized}
          setMinimized={setTilePanelMinimized}
        />
      </div>

      {/* Map */}
      <MapContainer
        center={view?.center || defaultCenter}
        zoom={view?.zoom || defaultZoom}
        scrollWheelZoom
        whenCreated={(m) => { mapRef.current = m; }}
        style={{ width: "100%", height: "100%" }}
        preferCanvas={true}
      // zoomControl={false}          
      // attributionControl={false}   
      >
        <MapInteractionTracker
          onMoveOrZoomEnd={() => setLastInteractionTime(Date.now())}
        />
        {/* REMOVE className from TileLayer */}
        {/* Base tiles */}
        {isPaleEffective ? (
          // ✅ pale → server-side grayscale via proxy
          <ProxiedGrayTileLayer
            upstreamTemplate={effectiveUrl}
            attribution={effectiveAttr}
            tileLayerRef={tileLayerRef}
            pane="tilePane"
          />
        ) : (
          // other styles → normal color tiles
          <TileLayer
            ref={tileLayerRef}
            key={effectiveKey}
            url={effectiveUrl}
            attribution={effectiveAttr}
            crossOrigin="anonymous"
          />
        )}

        <AutoZoomToRoutes routeFeatures={routeFeatures} />


        <FocusOnStop stop={selectedStop} />
        {/* Renamed panes to avoid conflicts with MapVisualization */}
        <Pane name="boarding-labels-tooltip-pane" style={{ zIndex: 760 }} />
        <Pane name="boarding-route-tooltip-pane" style={{ zIndex: 755 }} />
        <Pane name="boarding-route-labels-pane" style={{ zIndex: 100000, pointerEvents: "none" }} />
        <Pane name="boarding-route-labels-tooltip-pane" style={{ zIndex: 100001, pointerEvents: "none" }} />

        {(() => {
          const routeFeatures =
            selectedVisualization === 0 &&
            allRoutesData?.routesGeoJSON?.features?.filter((f) => f.geometry?.type === "LineString");
          const hasBase = Array.isArray(routeFeatures) && routeFeatures.length > 0;

          return selectedVisualization === 0 &&
            hasBase &&
            (layers.edges || layers.routeColors) ? (
            <Pane name="api-base-routes" style={{ zIndex: 430 }}>
              {routeFeatures.map((feature, idx) => {
                const colorHex = feature.properties?.keyword_colors?.[0]
                  ? `#${String(feature.properties.keyword_colors[0]).replace(/^#?/, "")}`
                  : "#1976d2";

                // routeColors ON → per-route color
                // Otherwise -> green
                const finalColor = layers.routeColors ? colorHex : "#58AB39";

                const positions = feature.geometry.coordinates.map(([lng, lat]) => [
                  lat,
                  lng,
                ]);

                return (
                  <Polyline
                    key={feature.properties?.route_id || feature.properties?.shape_id || idx}
                    positions={positions}
                    pathOptions={{ color: finalColor, weight: 5, opacity: 0.7 }}
                  />
                );
              })}
            </Pane>
          ) : null;
        })()}

        {/* Unique route labels (deduped & anchored at midpoints) */}
        {layers.routeLabels &&
          uniqueRouteLabels.map((item, i) => {
            if (!item.latlng) return null;

            const finalColor =
              layers.routeColors && item.color ? item.color : "#58AB39";

            return (
              <Marker
                key={`boarding-unique-label-${i}`}
                position={item.latlng}
                icon={BLANK_DIVICON}
                pane="boarding-route-labels-pane"
                interactive={false}
              >
                <RouteLabelTooltip
                  pane="boarding-route-labels-tooltip-pane"
                  labels={Array.isArray(item.label) ? item.label : [item.label]}
                  color={finalColor}
                  direction="center"
                  offset={[0, 0]}
                />
              </Marker>
            );
          })}

        {/* Highlight per-segment */}
        {layers.highlight && metric === "in_car" && (() => {
          const feats = boardingAlightingResult?.data?.features;
          const segs = [];
          const feature = Array.isArray(feats) && feats.find((f) => f.geometry?.type === "MultiLineString" || f.geometry?.type === "LineString");
          const segmentLabels = feature?.properties?.segment_labels || [];
          const { thresholds } = buildThresholds(segmentLabels.map((s) => Number(s?.properties?.value ?? 0)), 5);

          segmentLabels.forEach((seg) => {
            const paths = seg?.properties?.paths;
            if (Array.isArray(paths)) {
              paths.forEach((line) => {
                if (Array.isArray(line) && line.length >= 2) {
                  segs.push({ line, value: Number(seg?.properties?.value ?? 0) });
                }
              });
            }
          });

          return segs.length ? (
            <HighlightPolyline
              coordinates={segs.map((s) => s.line)}
              values={segs.map((s) => s.value)}
              thresholds={thresholds}
              baseColor={METRIC_BASE.in_car.base}
            />
          ) : null;
        })()}

        {layers.highlight && metric !== "in_car" && (highlightCoordsNonIncar?.length > 0) && (
          <HighlightPolyline
            coordinates={highlightCoordsNonIncar}
            baseColor={METRIC_BASE[metric]?.base || "#FFD600"}
          />
        )}

        <StopsLayer
          layers={layers}
          metric={metric}
          stopsFeatures={stopsFeatures}
          thresholds={thresholds}
          ramp={ramp}
          onStopClick={onStopClick}
        />
        <SegmentsLayer
          layers={layers}
          metric={metric}
          segmentLabels={segmentLabels}
          stopValueIndex={stopValueIndex}
          onSegmentClick={onSegmentClick}
        />
        {showLegend && (
          <LegendPanel
            metric={metric}
            thresholds={thresholds}
            onClose={() => setShowLegend(false)}
          />
        )}
      </MapContainer>
      {/* Legend toggle */}

    </Box>
  );
}
