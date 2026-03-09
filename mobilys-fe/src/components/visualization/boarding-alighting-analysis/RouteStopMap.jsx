// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
// src/components/visualization/boarding_alighting_analysis/RouteStopMap.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  FeatureGroup,
  useMap,
  Polyline,
  CircleMarker,
  Tooltip as LeafletTooltip,
  Pane,
  Marker,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "../MapVisualization.css";
import {
  Box,
  Typography,
  IconButton,
  Tooltip as MuiTooltip,
  Table,
  TableBody,
  TableRow,
  TableCell,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import PaleMap from "../../../assets/photos/pale.png";
import StdMap from "../../../assets/photos/std.png";
import BlankMap from "../../../assets/photos/blank.png";
import PhotoMap from "../../../assets/photos/photo.jpg";
import MapLayerControlPanel from "../bus-running-visualization/MapLayerControlPanel";
import { FocusOnStop } from "../bus-running-visualization/MapVisualization";
import StopLabelTooltip from "../StopLabelTooltip";
import RouteLabelTooltip from "../RouteLabelTooltip";
import { BLANK_DIVICON } from "../buffer-analysis/BufferAnalysisMap";
import L from "leaflet";
import { VISUALIZATION } from "@/strings";
import { ProxiedGrayTileLayer } from "../map/ProxiedGrayTileLayer";
import { useMapExport } from "../map/useMapExport";
import { useFullscreen } from "../map/useFullscreen";

// Utils
import { midpointLatLng } from "./utils";

// Helpers  
import { StopSearchAutocomplete } from "./helpers/StopSearchAutocomplete";
import {
  FullscreenButton,
  DownloadButton,
  ExportingOverlay,
  LegendToggleButton,
} from "./helpers/MapControls";
import { RouteStopModeSelector } from "./helpers/RouteStopModeSelector";

export default function RouteStopMap({
  RouteSegmentData,
  selectedMode = "in_car",
  setSelectedMode,
  selectedStop,
  setSelectedStop,
  allRoutesData,
  scenarioName,
}) {

  const COOLDOWN_MS = 5000;
  const POST_TILES_DELAY_MS = 3000;
  // ============== Basemap choices ==============
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

  const [fallbackMode, setFallbackMode] = useState(selectedMode);
  const mode = setSelectedMode ? selectedMode : fallbackMode;
  const handleModeChange = (val) => {
    if (setSelectedMode) setSelectedMode(val);
    else setFallbackMode(val);
  };

  const selectedBase = useMemo(
    () => mapBaseItems.find((m) => m.key === selectedTile) || mapBaseItems[0],
    [selectedTile]
  );
  const [localSelectedStop, setLocalSelectedStop] = useState(null);

  const overlayStop = selectedStop || localSelectedStop;

  const [selectedStopText, setSelectedStopText] = useState(null);
  const [searchInput, setSearchInput] = useState("");



  const setStopUnified = (stopObj) => {
    if (!stopObj) return;
    const id =
      stopObj.id ||
      stopObj.properties?.stop_keyword ||
      stopObj.properties?.stop_id ||
      `${stopObj.lat},${stopObj.lng}`;

    const full = { ...stopObj, id };

    setSelectedStop?.(full);
    setLocalSelectedStop(full);

    setSelectedStopText({
      id,
      label:
        stopObj.properties?.stop_keyword ||
        stopObj.properties?.stop_name ||
        id,
      lat: stopObj.lat,
      lng: stopObj.lng,
    });
  };

  useEffect(() => {
    if (selectedStop) setLocalSelectedStop(selectedStop);
    else setLocalSelectedStop(null);
  }, [selectedStop]);

  useEffect(() => {
    const hasStops =
      Array.isArray(allRoutesData?.stopsGeoJSON?.features) &&
      allRoutesData.stopsGeoJSON.features.length > 0;
    if (!hasStops) {
      setLocalSelectedStop(null);
      setSelectedStopText(null);
    }
  }, [allRoutesData]);

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

  const routeFeatures =
    allRoutesData?.routesGeoJSON?.features?.filter((f) => f.geometry?.type === "LineString");
  const stopFeatures =
    allRoutesData?.stopsGeoJSON?.features?.filter((f) => f.geometry?.type === "Point") || [];
  const hasBase = Array.isArray(routeFeatures) && routeFeatures.length > 0;

  const stopOptions = useMemo(() => {
    const features = stopFeatures || [];
    const opts = features
      .map((s) => {
        const props = s.properties || {};
        const coords = s.geometry?.coordinates || [NaN, NaN];
        const [lng, lat] = coords;
        const label = props.parent_stop || props.stop_name || props.stop_id || "";
        const id = props.parent_stop || props.stop_id || label;
        return { id, label, lat, lng };
      })
      .filter((o) => Number.isFinite(o.lat) && Number.isFinite(o.lng) && o.label);
    const dedup = new Map();
    for (const o of opts) if (!dedup.has(o.id)) dedup.set(o.id, o);
    return Array.from(dedup.values());
  }, [stopFeatures]);

  // safe name for filenames
  const safeScenarioName = React.useMemo(() => {
    const base = (scenarioName && String(scenarioName).trim()) || "scenario";
    return base.replace(/[\\/:*?"<>|]+/g, "_");
  }, [scenarioName]);

  // unique route labels
  const uniqueRouteLabels = useMemo(() => {
    if (!hasBase) return [];
    const out = [];
    const seen = new Set();

    // midLatLng now imported from utils

    for (const f of routeFeatures || []) {
      const labels = f?.properties?.keywords || f?.properties?.route_groups || [];
      if (!labels?.length) continue;

      const anchor =
        midpointLatLng(f.geometry) ||
        (Array.isArray(f.geometry?.coordinates) && f.geometry.coordinates[0]
          ? [f.geometry.coordinates[0][1], f.geometry.coordinates[0][0]]
          : null);

      for (const label of labels) {
        if (label == null) continue;
        const key = String(label).trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ label, latlng: anchor });
      }
    }
    return out;
  }, [hasBase, routeFeatures]);

  useEffect(() => {
    if (!selectedStop) {
      setSelectedStopText(null);
      return;
    }
    const label =
      selectedStop.properties?.stop_keyword ||
      selectedStop.properties?.stop_name ||
      selectedStop.properties?.stop_id ||
      "";
    setSelectedStopText(
      label
        ? {
          id: selectedStop.id || label,
          label,
          lat: selectedStop.lat,
          lng: selectedStop.lng,
        }
        : null
    );
  }, [selectedStop]);

  // Stop search now uses StopSearchAutocomplete component

  const getLegendObj = (properties) => properties?.legend ?? properties ?? {};
  const getValueByMode = (legendObj) => {
    if (mode === "both") return legendObj.boarding_alighting_total;
    if (mode === "boarding") return legendObj.boarding_total;
    if (mode === "alighting") return legendObj.alighting_total;
    return undefined;
  };

  const allValues = useMemo(() => {
    if (!Array.isArray(pointFeatures)) return [];
    return pointFeatures
      .map((pt) => getValueByMode(getLegendObj(pt.properties)))
      .filter((v) => typeof v === "number" && !Number.isNaN(v));
  }, [pointFeatures, mode]);

  const [vmin, vmax] = useMemo(() => {
    if (!allValues.length) return [0, 0];
    return [Math.min(...allValues), Math.max(...allValues)];
  }, [allValues]);

  const scaleRadius = (val) => {
    if (vmin === vmax) return 14;
    return 7 + 15 * ((val - vmin) / (vmax - vmin)); // 7–22 px
  };

  const [layers, setLayers] = useState({
    edges: true,
    stops: true,
  });
  const handleLayerToggle = (key) => setLayers((s) => ({ ...s, [key]: !s[key] }));

  const modeMarkerColor = {
    in_car: "#f59e0b",
    boarding: "#1976d2",
    alighting: "#e53935",
    both: "#f59e0b",
  };
  const markerColor = modeMarkerColor[mode] || "#f59e0b";

  function LegendPanelRef({ onClose }) {
    const modeLabel =
      mode === "both"
        ? VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization
          .series.boardingPlusAlighting
        : mode === "boarding"
          ? VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization
            .series.boarding
          : mode === "alighting"
            ? VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization
              .series.alighting
            : VISUALIZATION.boardingAlightingAnalysis.components.routeSegmentVisualization
              .series.inVehicle;

    const legendBreaks = [5000, 1000, 500, 100, 50, 1];
    const hasZero = allValues.some((v) => v === 0);
    const hasPositive = allValues.some((v) => v > 0);
    const vmaxEff = Math.max(1, vmax);

    const scaleLegend = (val) => scaleRadius(Math.min(val, vmaxEff));
    const activeBreaks = legendBreaks
      .filter((b) => b <= Math.max(vmaxEff, 1))
      .sort((a, b) => b - a);

    const legendColor = markerColor;

    const DOT_COL_W = 44;
    const cellSx = { py: 0.75, px: 1.25, borderBottom: "1px solid #EAECEF" };
    const dotCellSx = { ...cellSx, width: DOT_COL_W, px: 0.5, textAlign: "center" };
    const textCellSx = { ...cellSx, whiteSpace: "nowrap", fontSize: 14, pr: 1.5 };

    return (
      <Paper
        className="map-legend-card"
        elevation={0}
        sx={{
          p: 1.25,
          border: "none",
          borderRadius: 2,
          bgcolor: "#ffffff",
          width: "fit-content",
          minWidth: 220,
          maxWidth: 280,
          "& table": { width: "auto" },
          boxShadow: "none",
          position: "absolute",
          right: 90,
          bottom: 20,
          zIndex: 1950,
        }}
      // data-html2canvas-ignore
      >
        <Box sx={{ display: "flex", alignItems: "center", mb: 0.75 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14, color: "#111827", flex: 1 }}>
            {modeLabel}
          </Typography>
          <IconButton
            size="small"
            aria-label={VISUALIZATION.common.dialog.close}
            title={VISUALIZATION.common.dialog.close}
            onClick={() => (typeof onClose === "function" ? onClose() : setShowLegend(false))}
            sx={{ width: 24, height: 24, borderRadius: 1 }}
          >
            <CloseIcon sx={{ fontSize: 16, color: "#666" }} />
          </IconButton>
        </Box>

        {!allValues.length ? (
          <Typography variant="body2" sx={{ color: "gray", mt: 0.5 }}>
            {VISUALIZATION.common.dateParts.noData}
          </Typography>
        ) : (
          <Table size="small" sx={{ tableLayout: "fixed", width: "auto" }}>
            <TableBody>
              {hasPositive &&
                activeBreaks.map((b, i) => {
                  const r = scaleLegend(b);
                  return (
                    <TableRow key={i}>
                      <TableCell sx={dotCellSx}>
                        <Box
                          sx={{
                            mx: "auto",
                            width: r * 2,
                            height: r * 2,
                            borderRadius: "50%",
                            background: legendColor,
                            border: "1px solid #fff",
                            opacity: 0.95,
                          }}
                        />
                      </TableCell>
                      <TableCell sx={textCellSx}>
                        {`${b}${VISUALIZATION.common.dateParts.rangeSeparator}`}
                      </TableCell>
                    </TableRow>
                  );
                })}
              {hasZero && (
                <TableRow>
                  <TableCell sx={dotCellSx}>
                    <Box
                      sx={{
                        mx: "auto",
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: "#DADDE3",
                        border: "1px solid #fff",
                      }}
                    />
                  </TableCell>
                  <TableCell sx={textCellSx}>
                    0（{VISUALIZATION.common.dateParts.noData}）
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Paper>
    );
  }

  // ===== Fullscreen & Export =====
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
    cooldownMs: COOLDOWN_MS,
    postTilesDelayMs: POST_TILES_DELAY_MS,
    rootSelector: "#route-stop-map-root",
    getFilename: () => {
      let middlePart =
        VISUALIZATION.boardingAlightingAnalysis.exports.maps.routeStop.total;
      if (mode === "boarding") {
        middlePart =
          VISUALIZATION.boardingAlightingAnalysis.exports.maps.routeStop.boarding;
      } else if (mode === "alighting") {
        middlePart =
          VISUALIZATION.boardingAlightingAnalysis.exports.maps.routeStop.alighting;
      }
      const baseName = `${safeScenarioName}_${VISUALIZATION.boardingAlightingAnalysis.exports.screenName}_${middlePart}_${VISUALIZATION.boardingAlightingAnalysis.exports.mapSuffix}`;
      return `${baseName}.png`;
    },
    onClone: (doc) => {
      const extraIgnore = [
        ".MuiBackdrop-root",
        ".MuiModal-backdrop",
        ".loading-dim",
        ".importing-overlay",
      ];
      doc.querySelectorAll(extraIgnore.join(",")).forEach((el) => el.remove());

      doc.querySelectorAll("img.leaflet-tile").forEach((img) => {
        img.style.opacity = "1";
        img.crossOrigin = "anonymous";
      });

      doc.querySelectorAll(".leaflet-pane").forEach((pane) => {
        pane.style.opacity = "1";
        pane.style.mixBlendMode = "normal";
      });
    },
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

  // ============== Map ==============
  return (
    <Box
      ref={containerRef}
      id="route-stop-map-root"
      data-map-root
      sx={{
        width: "100%",
        height: "100%",
        position: "relative",
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
        selectedStop={selectedStopText}
        setSelectedStop={(val) => {
          setSelectedStopText(val);
          if (val) {
            setStopUnified({
              lat: val.lat,
              lng: val.lng,
              properties: { stop_keyword: val.label },
              id: val.id,
            });
          }
        }}
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        keyProp={isFullscreen ? "fs" : "inline"}
        loading={stopOptions.length === 0}
      />

      <RouteStopModeSelector mode={mode} onChange={handleModeChange} />

      <LegendToggleButton showLegend={showLegend} setShowLegend={setShowLegend} />



      <div data-html2canvas-ignore>
        <MapLayerControlPanel
          layerState={layers}
          onLayerToggle={handleLayerToggle}
          selectedTile={selectedTile}
          onTileSelect={setSelectedTile}
          minimized={tilePanelMinimized}
          setMinimized={setTilePanelMinimized}
        />
      </div>

      {/* Map */}
      <BaseMap
        bounds={bounds}
        tileUrl={selectedBase.url}
        tileAttr={selectedBase.attribution}
        selectedTile={selectedTile}
        mapRef={mapRef}
        tileLayerRef={tileLayerRef}
        onMoveOrZoomEnd={() => setLastInteractionTime(Date.now())}
      >
        <Pane name="routes" style={{ zIndex: 800 }}>
          {hasBase &&
            layers.edges &&
            routeFeatures.map((feature, idx) => {
              const positions = feature.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
              const finalColor = "#58AB39";
              return (
                <Polyline
                  key={feature.properties?.route_id || feature.properties?.shape_id || idx}
                  positions={positions}
                  pathOptions={{ color: finalColor, weight: 5, opacity: 0.7 }}
                />
              );
            })}

          {/* Unique route labels (deduped) */}
          {hasBase &&
            layers.routeLabels &&
            uniqueRouteLabels.map((item, i) => {
              if (!item.latlng) return null;
              const finalColor = "#58AB39";
              return (
                <Marker
                  key={`route-stop-unique-label-${i}`}
                  position={item.latlng}
                  icon={BLANK_DIVICON}
                  pane="route-stop-labels-pane"
                  interactive={false}
                >
                  <RouteLabelTooltip
                    pane="route-stop-labels-tooltip-pane"
                    labels={Array.isArray(item.label) ? item.label : [item.label]}
                    color={finalColor}
                    direction="center"
                    offset={[0, 0]}
                  />
                </Marker>
              );
            })}
        </Pane>

        {/* Base point markers */}
        {layers.stops && (
          <Pane name="stops" style={{ zIndex: 900 }}>
            <FeatureGroup>
              {pointFeatures.map((pt, idx) => {
                const v = getValueByMode(getLegendObj(pt.properties));
                const radius = typeof v === "number" ? scaleRadius(v) : 7;
                const isZero = v === 0;
                return (
                  <CircleMarker
                    key={`pt-${idx}`}
                    center={[pt.lat, pt.lng]}
                    radius={isZero ? 5 : radius}
                    pathOptions={{
                      weight: 2,
                      color: "#fff",
                      fillColor: isZero ? "#DADDE3" : markerColor,
                      fillOpacity: isZero ? 0.8 : 0.9,
                      opacity: 1,
                    }}
                    eventHandlers={{
                      click: () => {
                        setStopUnified(pt);
                      },
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
                );
              })}
            </FeatureGroup>
          </Pane>
        )}

        {/* Selected stop overlay (non-interactive) */}
        {overlayStop?.lat != null && overlayStop?.lng != null && (
          <Pane name="selected" style={{ zIndex: 1100, pointerEvents: "none" }}>
            <FeatureGroup>
              <CircleMarker
                center={[overlayStop.lat, overlayStop.lng]}
                radius={16}
                pathOptions={{
                  weight: 0,
                  color: "transparent",
                  fillColor: "#FFD400",
                  fillOpacity: 0.2,
                }}
              />
              <CircleMarker
                center={[overlayStop.lat, overlayStop.lng]}
                radius={12}
                pathOptions={{
                  weight: 4,
                  color: "#fff",
                  opacity: 1,
                  fillColor: "#FFD400",
                  fillOpacity: 0.95,
                }}
              >
                {overlayStop.properties && (
                  <LeafletTooltip direction="top" offset={[0, -2]} permanent>
                    <PropsTable
                      properties={overlayStop.properties}
                      title={VISUALIZATION.common.map.labels.selectedStopTitle}
                    />
                  </LeafletTooltip>
                )}
              </CircleMarker>
            </FeatureGroup>
          </Pane>
        )}
        {showLegend && <LegendPanelRef />}
      </BaseMap>
    </Box>
  );
}

function MoveZoomTracker({ onMoveOrZoomEnd }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !onMoveOrZoomEnd) return;

    const handler = () => {
      onMoveOrZoomEnd();
    };

    map.on("moveend", handler);
    map.on("zoomend", handler);

    return () => {
      map.off("moveend", handler);
      map.off("zoomend", handler);
    };
  }, [map, onMoveOrZoomEnd]);

  return null;
}


function BaseMap({
  bounds,
  tileUrl,
  tileAttr,
  selectedTile,
  children,
  mapRef,
  tileLayerRef,
  selectedStopText,
  onMoveOrZoomEnd,
}) {
  const defaultCenter = [36.2048, 138.2529];
  const defaultZoom = 6;
  const isPale = selectedTile === "pale";

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
      <MoveZoomTracker onMoveOrZoomEnd={onMoveOrZoomEnd} />
      {isPale ? (
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

      {selectedStopText && <FocusOnStop stop={selectedStopText} />}
      <FitToBounds bounds={bounds} />

      <Pane name="route-stop-labels-pane" style={{ zIndex: 760 }} />
      <Pane name="route-stop-route-pane" style={{ zIndex: 755 }} />
      <Pane
        name="route-stop-labels-tooltip-pane"
        style={{ zIndex: 100001, pointerEvents: "none" }}
      />

      {children}

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

function PropsTable({ properties, title }) {
  const stopKeyword = properties?.stop_keyword;
  if (!stopKeyword) return <span>{title}</span>;
  return (
    <div style={{ fontSize: 12, lineHeight: 1.3 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>
      <table>
        <tbody>
          <tr>
            <td style={{ paddingRight: 8, opacity: 0.7, whiteSpace: "nowrap" }}>
              {VISUALIZATION.common.map.labels.stopFallback}
            </td>
            <td style={{ fontWeight: 500 }}>{stopKeyword}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
