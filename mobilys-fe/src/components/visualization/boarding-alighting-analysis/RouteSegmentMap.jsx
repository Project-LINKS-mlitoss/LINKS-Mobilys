import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  FeatureGroup,
  useMap,
  Polyline,
  CircleMarker,
  Pane,
  Marker,
} from "react-leaflet";
import { BLANK_DIVICON } from "../buffer-analysis/BufferAnalysisMap";
import RouteLabelTooltip from "../RouteLabelTooltip";
import * as turf from "@turf/turf";
import "leaflet/dist/leaflet.css";
import "../MapVisualization.css";
import {
  Box,
  Typography,
  IconButton,
  Tooltip as MuiTooltip,
  Paper,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";


import PaleMap from "../../../assets/photos/pale.png";
import StdMap from "../../../assets/photos/std.png";
import BlankMap from "../../../assets/photos/blank.png";
import PhotoMap from "../../../assets/photos/photo.jpg";

import MapLayerControlPanel from "../bus-running-visualization/MapLayerControlPanel";
import StopLabelTooltip from "../StopLabelTooltip";
import {
  FocusOnStop,
} from "../bus-running-visualization/MapVisualization";

import { buildFilename } from "../buildFilename";
import { VISUALIZATION } from "@/strings";
import { ProxiedGrayTileLayer } from "../map/ProxiedGrayTileLayer";
import { useMapExport } from "../map/useMapExport";
import { useFullscreen } from "../map/useFullscreen";

// Helpers
import { StopSearchAutocomplete } from "./helpers/StopSearchAutocomplete";
import {
  FullscreenButton,
  DownloadButton,
  ExportingOverlay,
  LegendToggleButton,
} from "./helpers/MapControls";

import L from "leaflet";
L.Control.Attribution.prototype.options.prefix =
  '<a href="https://leafletjs.com" target="_blank" rel="noreferrer noopener">Leaflet</a>';

const TOP_TOOLTIP_PANE = "top-tooltip-pane";
const SCREEN_NAME =
  VISUALIZATION.boardingAlightingAnalysis.exports.maps.routeSegment.screenName;

// Helper: convert pixel offset to meters for turf.lineOffset
function pixelOffsetToMeters(pixel, lat, zoom) {
  return (
    (pixel * 40075016.686 * Math.abs(Math.cos((lat * Math.PI) / 180))) /
    (256 * Math.pow(2, zoom))
  );
}

export default function RouteSegmentMap({
  RouteSegmentData,
  selectedMode = "in_car",
  setSelectedMode,
  selectedSegment,
  setSelectedSegment,
  allRoutesData,
  scenarioName,
}) {
  //base-map options
  const mapBaseItems = [
    {
      key: "pale",
      thumb: PaleMap,
      label: VISUALIZATION.common.map.baseMaps.pale,
      url: "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png",
      attribution: VISUALIZATION.common.map.attributions.gsi,
    },
    {
      key: "std",
      thumb: StdMap,
      label: VISUALIZATION.common.map.baseMaps.std,
      url: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
      attribution: VISUALIZATION.common.map.attributions.gsi,
    },
    {
      key: "blank",
      thumb: BlankMap,
      label: VISUALIZATION.common.map.baseMaps.blank,
      url: "https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png",
      attribution: VISUALIZATION.common.map.attributions.gsi,
    },
    {
      key: "photo",
      thumb: PhotoMap,
      label: VISUALIZATION.common.map.baseMaps.photo,
      url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
      attribution: VISUALIZATION.common.map.attributions.gsi,
    },
  ];
  const [selectedTile, setSelectedTile] = useState("pale");
  const [tilePanelMinimized, setTilePanelMinimized] = useState(true);

  const [showLegend, setShowLegend] = useState(false);

  const mode = setSelectedMode ? selectedMode : fallbackMode;

  const routeFeatures =
    allRoutesData?.routesGeoJSON?.features?.filter(
      (f) => f.geometry?.type === "LineString"
    ) || [];
  const stopFeatures =
    allRoutesData?.stopsGeoJSON?.features?.filter(
      (f) => f.geometry?.type === "Point"
    ) || [];
  const hasBase = Array.isArray(routeFeatures) && routeFeatures.length > 0;

  const selectedBase = useMemo(
    () => mapBaseItems.find((m) => m.key === selectedTile) || mapBaseItems[0],
    [selectedTile]
  );

  const { lineFeatures, pointFeatures, bounds } = useMemo(() => {
    const fcs =
      RouteSegmentData &&
        RouteSegmentData.type === "FeatureCollection" &&
        Array.isArray(RouteSegmentData.features)
        ? RouteSegmentData.features
        : [];

    const lines = [];
    const points = [];
    const allLatLngs = [];

    for (const f of fcs) {
      if (!f || f.type !== "Feature" || !f.geometry) continue;
      const { geometry, properties } = f;

      if (geometry.type === "LineString" && Array.isArray(geometry.coordinates)) {
        const latlngs = geometry.coordinates
          .filter((c) => Array.isArray(c) && c.length >= 2)
          .map(([lng, lat]) => [lat, lng]);
        if (latlngs.length > 1) {
          lines.push({ latlngs, properties: properties || {} });
          allLatLngs.push(...latlngs);
        }
      } else if (geometry.type === "Point" && Array.isArray(geometry.coordinates)) {
        const [lng, lat] = geometry.coordinates;
        if (typeof lat === "number" && typeof lng === "number") {
          points.push({ lat, lng, properties: properties || {} });
          allLatLngs.push([lat, lng]);
        }
      }
    }

    let b = null;
    if (allLatLngs.length) {
      const lats = allLatLngs.map(([lat]) => lat);
      const lngs = allLatLngs.map(([, lng]) => lng);
      b = [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ];
    }

    return { lineFeatures: lines, pointFeatures: points, bounds: b };
  }, [RouteSegmentData]);

  const stopOptions = useMemo(() => {
    const features = stopFeatures || [];
    const opts = features
      .map((s) => {
        const props = s.properties || {};
        const coords = s.geometry?.coordinates || [NaN, NaN];
        const [lng, lat] = coords;
        const label =
          props.parent_stop || props.stop_name || props.stop_id || "";
        const id = props.parent_stop || props.stop_id || label;
        return { id, label, lat, lng };
      })
      .filter(
        (o) => Number.isFinite(o.lat) && Number.isFinite(o.lng) && o.label
      );
    const dedup = new Map();
    for (const o of opts) if (!dedup.has(o.id)) dedup.set(o.id, o);
    return Array.from(dedup.values());
  }, [stopFeatures]);

  const [selectedStop, setSelectedStop] = useState(null);
  const [searchInput, setSearchInput] = useState("");

  // Track zoom level for offset
  const [currentZoom, setCurrentZoom] = useState(13);

  useEffect(() => {
    if (!selectedStop) return;
    const exist = stopOptions.some((o) => o.id === selectedStop.id);
    if (!exist) setSelectedStop(null);
  }, [stopOptions, selectedStop]);

  // Stop search now uses StopSearchAutocomplete component

  const getLegendObj = (properties) => properties?.legend ?? properties ?? {};
  const getValueByMode = (legendObj) => {
    if (mode === "in_car") return legendObj.in_car_total;
    if (mode === "boarding") return legendObj.boarding_total;
    if (mode === "alighting") return legendObj.alighting_total;
    return undefined;
  };

  const allValues = useMemo(() => {
    if (!Array.isArray(lineFeatures)) return [];
    const vals = lineFeatures
      .map((ln) => getValueByMode(getLegendObj(ln.properties)))
      .filter((v) => typeof v === "number" && !Number.isNaN(v));
    return vals;
  }, [lineFeatures, mode]);

  const [vmin, vmax] = useMemo(() => {
    if (!allValues.length) return [0, 0];
    return [Math.min(...allValues), Math.max(...allValues)];
  }, [allValues]);

  const scaleWeight = (val) => {
    if (vmin === vmax) return 8;
    return 3 + 11 * ((val - vmin) / (vmax - vmin)); // 3–14 px
  };

  const modeColorConfig = {
    in_car: "#FF9800",
    boarding: "#1976d2",
    alighting: "#e53935",
  };
  const modeBorderColorConfig = {
    in_car: "#e0a040",
    boarding: "#1565c0",
    alighting: "#b71c1c",
  };
  const baseColor = modeColorConfig[mode] || "#FF9800";
  const borderColor = modeBorderColorConfig[mode] || "#e0a040";

  /* Hover state */
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const [layers, setLayers] = useState({
    edges: true,
    stops: true,
    routeLabels: false,
    stopLabels: false,
    routeColors: false,
  });
  const handleLayerToggle = (key) =>
    setLayers((s) => ({ ...s, [key]: !s[key] }));

  // Offset lineFeatures based on zoom to separate from base route
  const offsetLineFeatures = useMemo(() => {
    if (!Array.isArray(lineFeatures) || !bounds) return lineFeatures;

    const centerLat = bounds ? (bounds[0][0] + bounds[1][0]) / 2 : 0;
    const offsetPixel = 7;
    const offsetMeters = pixelOffsetToMeters(
      offsetPixel,
      centerLat,
      currentZoom
    );

    return lineFeatures.map((ln) => {
      try {
        const coords = ln.latlngs.map(([lat, lng]) => [lng, lat]);
        const line = turf.lineString(coords);
        const offsetLine = turf.lineOffset(line, -offsetMeters, {
          units: "meters",
        });

        if (offsetLine?.geometry?.coordinates?.length >= 2) {
          const offsetLatLngs = offsetLine.geometry.coordinates.map(
            ([lng, lat]) => [lat, lng]
          );
          return { ...ln, latlngs: offsetLatLngs };
        }
      } catch (err) {
        console.warn("Offset failed for line:", err);
      }
      return ln;
    });
  }, [lineFeatures, currentZoom, bounds]);

  // compute unique route labels & positions
  const uniqueRouteLabels = useMemo(() => {
    if (!hasBase || !routeFeatures) return [];
    const seen = new Set();
    const result = [];

    for (const feature of routeFeatures) {
      const rawLabels = feature.properties?.keywords;
      const label =
        Array.isArray(rawLabels) && rawLabels.length
          ? String(rawLabels[0]).trim()
          : null;
      if (!label) continue;
      const norm = label.toLowerCase();
      if (seen.has(norm)) continue;
      seen.add(norm);

      const coords = feature.geometry?.coordinates;
      if (!Array.isArray(coords) || !coords.length) continue;
      const midIdx = Math.floor(coords.length / 2);
      const [lng, lat] = coords[midIdx];
      if (
        typeof lat === "number" &&
        typeof lng === "number" &&
        !Number.isNaN(lat) &&
        !Number.isNaN(lng)
      ) {
        result.push({ label, latlng: [lat, lng] });
      }
    }
    return result;
  }, [hasBase, routeFeatures]);

  // ===== legend panel =====
  function LegendPanel() {
    const modeLabel =
      mode === "in_car"
        ? VISUALIZATION.boardingAlightingAnalysis.components.routeSegmentVisualization
          .series.inVehicle
        : mode === "boarding"
          ? VISUALIZATION.boardingAlightingAnalysis.components.routeSegmentVisualization
            .series.boarding
          : mode === "alighting"
            ? VISUALIZATION.boardingAlightingAnalysis.components.routeSegmentVisualization
              .series.alighting
            : "";

    const steps = 5;
    const edgesArr = allValues.length
      ? Array.from(
        { length: steps + 1 },
        (_, i) => vmin + (i * (vmax - vmin)) / steps
      )
      : [];

    const hasZero = allValues.some((v) => v === 0);
    const hasNonZero = allValues.some((v) => v > 0);

    return (
      <Paper
        className="map-legend-card"
        elevation={0}
        sx={{
          p: 1.25,
          border: "none",
          borderRadius: 2,
          bgcolor: "#ffffff",
          minWidth: 170,
          boxShadow: "none",
          position: "absolute",
          right: 80,
          zIndex: 1950,
          bottom: 20,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: 14,
              color: "#111827",
              flex: 1,
            }}
          >
            {modeLabel}
          </Typography>
          <IconButton
            size="small"
            aria-label={VISUALIZATION.common.dialog.close}
            title={VISUALIZATION.common.dialog.close}
            onClick={() => setShowLegend(false)}
            sx={{
              width: 24,
              height: 24,
              borderRadius: 1,
            }}
          >
            <CloseIcon sx={{ fontSize: 16, color: "#666" }} />
          </IconButton>
        </Box>

        {!allValues.length ? (
          <Typography variant="body2" sx={{ color: "gray", mt: 0.5 }}>
            {VISUALIZATION.common.dateParts.noData}
          </Typography>
        ) : (
          <Box component="ul" sx={{ listStyle: "none", p: 0, m: "8px 0 0 0" }}>
            {hasZero && (
              <Box
                component="li"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  mb: "4px",
                  fontSize: "14px",
                }}
              >
                <Box
                  component="span"
                  sx={{
                    display: "inline-block",
                    width: 40,
                    height: 6,
                    background: "#ccc",
                    border: "1px solid #eee",
                    mr: "8px",
                    opacity: 0.7,
                    borderRadius: 1,
                  }}
                />
                <Box component="span">
                  0（{VISUALIZATION.common.dateParts.noData}）
                </Box>
              </Box>
            )}
            {hasNonZero &&
              edgesArr.slice(0, -1).map((b, i) => {
                if (Math.round(b) === 0 && Math.round(edgesArr[i + 1]) === 0)
                  return null;
                const from = Math.max(1, Math.round(b));
                const to = Math.round(edgesArr[i + 1]);
                const weight = scaleWeight(b);
                return (
                  <Box
                    key={i}
                    component="li"
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      mb: "4px",
                      fontSize: "14px",
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        display: "inline-block",
                        width: 40,
                        height: weight,
                        background: baseColor,
                        border: `1px solid ${borderColor}`,
                        mr: "8px",
                        borderRadius: 1,
                        transition: "height .2s",
                      }}
                    />
                    <Box component="span">
                      {`${from}${VISUALIZATION.common.dateParts.rangeSeparator}${to}`}
                    </Box>
                  </Box>
                );
              })}
          </Box>
        )}
      </Paper>
    );
  }

  //fullscreen & export
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
    cooldownMs: 5000,
    postTilesDelayMs: 3000,
    getFilename: () => buildFilename(scenarioName, SCREEN_NAME, "map", undefined, "png"),
  });

  const handleDownloadPNG = async () => {
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
  };
  useEffect(() => {
    const handler = () => {
      // setIsFullscreen(!!document.fullscreenElement); // Handled by useFullscreen
      requestAnimationFrame(() => {
        mapRef.current?.invalidateSize?.({ animate: false });
        tileLayerRef.current?.redraw?.();
      });
    };
    document.addEventListener("fullscreenchange", handler);
    return () => {
      document.removeEventListener("fullscreenchange", handler);
    };
  }, []);



  // shared Canvas renderer for all route segments 
  const segmentsRenderer = useMemo(
    () => L.canvas({ padding: 0.5, pane: "route-segment-pane" }),
    []
  );

  return (
    <Box
      ref={containerRef}
      id="route-seg-map-root"
      data-map-root
      sx={{
        width: "100%",
        height: "100%",
        position: "relative",
        backgroundColor: "#fff",
        "& .leaflet-container": {
          width: "100%",
          height: "100%",
          borderRadius: 2,
        },
        "&:fullscreen .leaflet-container": { borderRadius: 0 },
        "&:-webkit-full-screen .leaflet-container": { borderRadius: 0 },
        "& .leaflet-control-attribution": {
          marginRight: "16px",
          marginBottom: "11px",
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
        loading={stopOptions.length === 0}
      />

      <LegendToggleButton showLegend={showLegend} setShowLegend={setShowLegend} />

      <Box data-html2canvas-ignore sx={{ display: "contents" }}>
        <MapLayerControlPanel
          layerState={layers}
          onLayerToggle={handleLayerToggle}
          selectedTile={selectedTile}
          onTileSelect={setSelectedTile}
          minimized={tilePanelMinimized}
          setMinimized={setTilePanelMinimized}
        />
      </Box>

      <BaseMap
        bounds={bounds}
        tileUrl={selectedBase.url}
        tileAttr={selectedBase.attribution}
        selectedTile={selectedTile}
        mapRef={mapRef}
        tileLayerRef={tileLayerRef}
        selectedStop={selectedStop}
        onZoomChange={setCurrentZoom}
        onMoveOrZoomEnd={() => setLastInteractionTime(Date.now())}
        showLegend={showLegend}
        LegendComponent={LegendPanel}
        segmentsRenderer={segmentsRenderer}
        layers={layers}
        lineFeatures={offsetLineFeatures}
        baseColor={baseColor}
        selectedSegment={selectedSegment}
        setSelectedSegment={setSelectedSegment}
        routeFeatures={routeFeatures}
        uniqueRouteLabels={uniqueRouteLabels}
        pointFeatures={pointFeatures}
        mode={mode}
      />
    </Box>
  );
}

/* ============== Map helpers ============== */

// Track zoom level inside MapContainer
function ZoomTracker({ onZoomChange, onMoveOrZoomEnd }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !onZoomChange) return;
    const handleZoomEnd = () => {
      onZoomChange(map.getZoom());
      onMoveOrZoomEnd?.();
    };

    const handleMoveEnd = () => {
      onMoveOrZoomEnd?.();
    };

    onZoomChange(map.getZoom());
    map.on("zoomend", handleZoomEnd);
    map.on("moveend", handleMoveEnd);

    return () => {
      map.off("zoomend", handleZoomEnd);
      map.off("moveend", handleMoveEnd);
    };
  }, [map, onZoomChange, onMoveOrZoomEnd]);

  return null;
}

// BaseMap: defines panes and common map wiring
function BaseMap({
  bounds,
  tileUrl,
  tileAttr,
  selectedTile,
  mapRef,
  tileLayerRef,
  selectedStop,
  onZoomChange,
  onMoveOrZoomEnd,
  showLegend,
  LegendComponent,
  segmentsRenderer,
  layers,
  lineFeatures,
  baseColor,
  selectedSegment,
  setSelectedSegment,
  routeFeatures,
  uniqueRouteLabels,
  pointFeatures,
  mode,
}) {
  const defaultCenter = [36.2048, 138.2529];
  const defaultZoom = 6;

  return (
    <MapContainer
      style={{ width: "100%", height: "100%" }}
      center={defaultCenter}
      zoom={defaultZoom}
      scrollWheelZoom
      preferCanvas={true}
      whenCreated={(m) => {
        if (mapRef) mapRef.current = m;
        setTimeout(() => m.invalidateSize(false), 0);
      }}
    >
      <Pane name="route-segment-pane" style={{ zIndex: 500 }} />
      <Pane
        name="route-segment-labels-pane"
        style={{ zIndex: 745, pointerEvents: "none" }}
      />
      <Pane
        name={TOP_TOOLTIP_PANE}
        style={{ zIndex: 760, pointerEvents: "none" }}
      />
      <Pane name="stops" style={{ zIndex: 550 }} />

      <ZoomTracker
        onZoomChange={onZoomChange}
        onMoveOrZoomEnd={onMoveOrZoomEnd}
      />

      {/* Tiles: pale uses proxied greyscale, others normal */}
      {selectedTile === "pale" ? (
        <ProxiedGrayTileLayer
          upstreamTemplate={
            "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png"
          }
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
      <FitToBounds bounds={bounds} />

      {/* --- SEGMENTS (clickable) --- */}
      {layers.edges && (
        <FeatureGroup>
          {(() => {
            // 1) compute all flags once
            const grouped = lineFeatures.map((ln, idx) => {
              const props = ln.properties || {};
              const legendObj = props.legend || props;
              let v;
              if (mode === "in_car") v = legendObj.in_car_total;
              else if (mode === "boarding") v = legendObj.boarding_total;
              else if (mode === "alighting") v = legendObj.alighting_total;

              const isZero = v === 0;
              const weightBase = 4;
              const weight = isZero ? weightBase : weightBase + 2;
              const isSelected =
                selectedSegment &&
                ln.properties &&
                selectedSegment.segment_key === ln.properties.segment_key;

              return { ln, idx, v, isZero, weight, isSelected };
            });

            // 2) split into buckets
            const zeros = grouped.filter((g) => g.isZero && !g.isSelected);
            const nonzeros = grouped.filter((g) => !g.isZero && !g.isSelected);
            const selected = grouped.filter((g) => g.isSelected);

            // 3) render in order: zeros -> nonzeros -> selected
            const zeroEls = zeros.map(({ ln, idx, weight }) => (
              <Polyline
                key={`line-zero-${idx}`}
                positions={ln.latlngs}
                pathOptions={{
                  weight,
                  opacity: 1,
                  color: "#9e9e9e",
                }}
                interactive={true}
                eventHandlers={{
                  click: () =>
                    setSelectedSegment && setSelectedSegment(ln.properties),
                }}
                renderer={segmentsRenderer}
              />
            ));

            const nonzeroEls = nonzeros.map(({ ln, idx, weight }) => (
              <Polyline
                key={`line-nonzero-${idx}`}
                positions={ln.latlngs}
                pathOptions={{
                  weight,
                  opacity: 1,
                  color: baseColor,
                }}
                interactive={true}
                eventHandlers={{
                  click: () =>
                    setSelectedSegment && setSelectedSegment(ln.properties),
                }}
                renderer={segmentsRenderer}
              />
            ));

            const selectedEls = selected.map(({ ln, idx, weight }) => (
              <Polyline
                key={`line-selected-${idx}`}
                positions={ln.latlngs}
                pathOptions={{
                  weight: weight + 2,
                  opacity: 1,
                  color: "#ffe600",
                }}
                interactive={true}
                eventHandlers={{
                  click: () =>
                    setSelectedSegment && setSelectedSegment(ln.properties),
                }}
                renderer={segmentsRenderer}
              />
            ));

            return (
              <>
                {zeroEls}
                {nonzeroEls}
                {selectedEls}
              </>
            );
          })()}
        </FeatureGroup>
      )}


      {/* --- BASE ROUTES (for labels only, invisible) --- */}
      {routeFeatures &&
        routeFeatures.map((feature, idx) => {
          const positions = feature.geometry.coordinates.map(
            ([lng, lat]) => [lat, lng]
          );
          return (
            <Polyline
              key={
                feature.properties?.route_id ||
                feature.properties?.shape_id ||
                idx
              }
              positions={positions}
              pathOptions={{ color: baseColor, weight: 5, opacity: 0 }}
              interactive={false}
              renderer={segmentsRenderer}
            />
          );
        })}

      {/* Route labels */}
      {layers.routeLabels &&
        uniqueRouteLabels.map((item, i) => {
          if (!item.latlng) return null;
          return (
            <Marker
              key={`route-seg-unique-label-${i}`}
              position={item.latlng}
              icon={BLANK_DIVICON}
              pane="route-segment-labels-pane"
              interactive={false}
            >
              <RouteLabelTooltip
                pane={TOP_TOOLTIP_PANE}
                labels={
                  Array.isArray(item.label) ? item.label : [item.label]
                }
                color="#58AB39"
                direction="center"
                offset={[0, 0]}
              />
            </Marker>
          );
        })}

      {/* --- STOPS --- */}
      {layers.stops && (
        <FeatureGroup pane="stops">
          {pointFeatures.map((pt, idx) => (
            <CircleMarker
              key={`pt-${idx}`}
              center={[pt.lat, pt.lng]}
              radius={5}
              pathOptions={{
                weight: 1,
                opacity: 1,
                color: "#888888",
                fillColor: "#666",
                fillOpacity: 0.9,
              }}
            >
              {pt.properties && layers.stopLabels && (
                <StopLabelTooltip
                  stopName={pt.properties.stop_keyword}
                  direction="top"
                  offset={[0, -8]}
                  permanent
                />
              )}
            </CircleMarker>
          ))}
        </FeatureGroup>
      )}

      {/* Legend inside MapContainer so export matches */}
      {showLegend && LegendComponent && <LegendComponent />}
    </MapContainer>
  );
}

function FitToBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    if (bounds && Array.isArray(bounds) && bounds.length === 2) {
      map.fitBounds(bounds, { padding: [24, 24] });
    }
  }, [map, bounds]);
  return null;
}
