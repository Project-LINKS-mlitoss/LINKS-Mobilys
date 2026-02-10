import React, { useState, useMemo, useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import "../MapVisualization.css";
import { blue, orange, red } from "@mui/material/colors";

import { Box } from "@mui/material";
import {
  POPPER_Z,
} from "../bus-running-visualization/MapVisualization";
import { buildFilename } from "../buildFilename";
import { VISUALIZATION } from "@/strings";
import { useFullscreen } from "../map/useFullscreen";
import { useMapExport } from "../map/useMapExport";
import { GSI_TILE_URLS } from "../map/tileUrls";
import ODMapActions from "./components/ODMapActions";
import ODStopSearch from "./components/ODStopSearch";
import ODLeafletMap from "./components/ODLeafletMap";
import ODOverlayControls from "./components/ODOverlayControls";

const MAP_UI_Z = 1800;
const DOWNLOAD_COOLDOWN_MS = 5000;
const POST_TILES_EXTRA_MS = 3000;
const R_MIN = 3,
  R_MAX = 14;

// === helpers ===
const makeRadiusScale = (minV, maxV) => {
  if (!isFinite(minV) || !isFinite(maxV) || maxV <= 0) return () => R_MIN;
  const a = Math.sqrt(Math.max(minV, 0));
  const b = Math.sqrt(maxV);
  return (v) => {
    const x = Math.sqrt(Math.max(v, 0));
    const t = (x - a) / Math.max(1e-6, b - a);
    return R_MIN + (R_MAX - R_MIN) * Math.max(0, Math.min(1, t));
  };
};

const odFilenameTabLabel = (vis, usageMode, flowMode) => {
  const mapStr = VISUALIZATION.odAnalysis.components.map;
  if (vis === 0) {
    const base = mapStr.visualizations.usageDistribution;
    const suffix =
      usageMode === "origin"
        ? mapStr.suffixes.origin
        : usageMode === "dest"
          ? mapStr.suffixes.dest
          : mapStr.suffixes.sum;
    return `${base}${suffix}`;
  }
  if (vis === 1) {
    const base = mapStr.visualizations.flowMap;
    const suffix =
      flowMode === "first_stop" ? mapStr.suffixes.firstStop : mapStr.suffixes.lastStop;
    return `${base}${suffix}`;
  }
  if (vis === 2) return mapStr.visualizations.busVolume;
  return mapStr.visualizations.default;
};

const GSI_ATTR = VISUALIZATION.common.map.attributions.gsi;
const mapBaseItems = [
  { key: "pale", url: GSI_TILE_URLS.pale, attribution: GSI_ATTR },
  { key: "std", url: GSI_TILE_URLS.std, attribution: GSI_ATTR },
  { key: "blank", url: GSI_TILE_URLS.blank, attribution: GSI_ATTR },
  { key: "photo", url: GSI_TILE_URLS.photo, attribution: GSI_ATTR },
];

export default function ODMap({
  selectedVisualization,
  // vis=0
  oDUsageDistributionData,
  oDUsageDistributionSelectedPoint,
  oDUsageDistributionSelectedMode,
  setODUsageDistributionSelectedMode,
  // vis=1
  oDLastFirstStopData,
  setODLastFirstStopSelectedPoint,
  oDLastFirstStopSelectedPoint,
  oDLastFirstStopSelectedMode,
  setODLastFirstStopSelectedMode,
  // vis=2
  oDBusStopData,
  oDBusStopSelectedPoint,
  setODBusStopSelectedPoint,
  oDBusStopLayer,
  // base
  allRoutesData,
  // for filename standardization
  scenarioName = VISUALIZATION.common.scenarioFallbackName,
  screenName = VISUALIZATION.titles.odAnalysis,
}) {
  const initialCenter = [35.681236, 139.767125];

  const [legendMinimized, setLegendMinimized] = useState(true);

  // base routes
  const routeFeatures =
    allRoutesData?.routesGeoJSON?.features?.filter(
      (f) => f.geometry?.type === "LineString"
    ) || [];
  const stopFeatures =
    allRoutesData?.stopsGeoJSON?.features?.filter(
      (f) => f.geometry?.type === "Point"
    ) || [];
  const hasBase = routeFeatures.length > 0;

  // ===== vis=0 points
  const points = useMemo(() => {
    const fc = oDUsageDistributionData;
    if (!fc?.features) return [];
    return fc.features
      .filter((f) => f.geometry?.type === "Point")
      .map((f) => {
        const [lng, lat] = f.geometry.coordinates || [NaN, NaN];
        const p = f.properties || {};
        let val;
        if (oDUsageDistributionSelectedMode === "origin")
          val = Number(p.total_geton ?? 0);
        else if (oDUsageDistributionSelectedMode === "dest")
          val = Number(p.total_getoff ?? 0);
        else val = Number(p.total_geton_getoff ?? 0);
        return {
          lat,
          lng,
          name: p.stop_name ?? "-",
          val,
          on: Number(p.total_geton ?? 0),
          off: Number(p.total_getoff ?? 0),
        };
      })
      .filter((p) => isFinite(p.lat) && isFinite(p.lng));
  }, [oDUsageDistributionData, oDUsageDistributionSelectedMode]);

  // ===== vis=1 points
  const lastFirstPoints = useMemo(() => {
    if (selectedVisualization !== 1 || !oDLastFirstStopData?.features)
      return [];
    return oDLastFirstStopData.features
      .filter((f) => f.geometry?.type === "Point")
      .map((f) => {
        const [lng, lat] = f.geometry.coordinates || [NaN, NaN];
        const p = f.properties || {};
        return { lat, lng, name: p.stop_name ?? "-", val: Number(p.total ?? 0) };
      })
      .filter((p) => isFinite(p.lat) && isFinite(p.lng));
  }, [selectedVisualization, oDLastFirstStopData]);

  // ===== vis=2 lines
  const busStopLines = useMemo(() => {
    if (selectedVisualization !== 2 || !Array.isArray(oDBusStopData)) return [];
    return oDBusStopData
      .filter(
        (d) =>
          d.stopid_geton &&
          d.stopid_getoff &&
          isFinite(d.stopid_geton.stop_lat) &&
          isFinite(d.stopid_geton.stop_long) &&
          isFinite(d.stopid_getoff.stop_lat) &&
          isFinite(d.stopid_getoff.stop_long)
      )
      .map((d) => ({
        from: [d.stopid_geton.stop_lat, d.stopid_geton.stop_long],
        to: [d.stopid_getoff.stop_lat, d.stopid_getoff.stop_long],
        count: Number(d.count ?? 0),
        fromName: d.stopid_geton.stop_keyword,
        toName: d.stopid_getoff.stop_keyword,
      }));
  }, [selectedVisualization, oDBusStopData]);

  const [busMin, busMax] = useMemo(() => {
    const vals = busStopLines.map((l) => l.count).filter((v) => isFinite(v));
    return vals.length ? [Math.min(...vals), Math.max(...vals)] : [0, 0];
  }, [busStopLines]);

  const busLineWeight = (count) => {
    if (!isFinite(busMin) || !isFinite(busMax) || busMax <= 0) return 2;
    const t = (count - busMin) / Math.max(1e-6, busMax - busMin);
    return 2 + Math.round(8 * t); // 2..10
  };

  const busStopLinesWithGroup = useMemo(() => {
    const sorted = [...busStopLines].sort((a, b) => (b.count || 0) - (a.count || 0));
    return sorted.map((line, i) => ({
      ...line,
      group: i < 10 ? 10 : i < 20 ? 20 : i < 30 ? 30 : i < 40 ? 40 : 999,
    }));
  }, [busStopLines]);

  const filteredBusStopLines = useMemo(() => {
    if (!oDBusStopLayer) return busStopLinesWithGroup;
    return busStopLinesWithGroup.filter(
      (l) =>
        (oDBusStopLayer.top10 && l.group === 10) ||
        (oDBusStopLayer.top20 && l.group === 20) ||
        (oDBusStopLayer.top30 && l.group === 30) ||
        (oDBusStopLayer.top40 && l.group === 40) ||
        (oDBusStopLayer.others && l.group === 999)
    );
  }, [busStopLinesWithGroup, oDBusStopLayer]);

  const currentStopOptions = useMemo(() => {
    if (selectedVisualization === 2) {
      const m = new Map();
      for (const l of filteredBusStopLines) {
        const k1 = `${l.from[0].toFixed(6)},${l.from[1].toFixed(6)}`;
        const k2 = `${l.to[0].toFixed(6)},${l.to[1].toFixed(6)}`;
        if (!m.has(k1))
          m.set(k1, {
            id: k1,
            label: l.fromName,
            lat: l.from[0],
            lng: l.from[1],
          });
        if (!m.has(k2))
          m.set(k2, {
            id: k2,
            label: l.toName,
            lat: l.to[0],
            lng: l.to[1],
          });
      }
      return Array.from(m.values());
    }
    const opts =
      stopFeatures
        ?.map((s) => {
          const props = s.properties || {};
          const coords = s.geometry?.coordinates || [NaN, NaN];
          const lng = coords[0],
            lat = coords[1];
          const label = props.parent_stop || props.stop_name || props.stop_id || "";
          const id = props.parent_stop || props.stop_id || label;
          return { id, label, lat, lng };
        })
        .filter((o) => Number.isFinite(o.lat) && Number.isFinite(o.lng) && o.label) || [];

    const dedup = new Map();
    for (const o of opts) if (!dedup.has(o.id)) dedup.set(o.id, o);
    return Array.from(dedup.values());
  }, [selectedVisualization, filteredBusStopLines, stopFeatures]);

  const [selectedStop, setSelectedStop] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    if (!selectedStop) return;
    const exist = currentStopOptions.some((o) => o.id === selectedStop.id);
    if (!exist) setSelectedStop(null);
  }, [currentStopOptions, selectedStop]);

  // scale for vis=0
  const [minV, maxV] = useMemo(() => {
    const vals = points.map((p) => p.val).filter((v) => isFinite(v));
    return vals.length ? [Math.min(...vals), Math.max(...vals)] : [0, 0];
  }, [points]);
  const radiusFor = useMemo(() => makeRadiusScale(minV, maxV), [minV, maxV]);

  // UI state
  const [layerState, setLayerState] = useState({
    edges: true,
    routeLabels: false,
    stopLabels: false,
    stops: true,
    relation: true,
    routeColors: false,
  });
  const [selectedTile, setSelectedTile] = useState("pale");
  const [minimized, setMinimized] = useState(true);
  const [lastInteractionTime, setLastInteractionTime] = useState(0);

  const handleLayerToggle = (key) =>
    setLayerState((s) => {
      // Exclusive: edges (green) vs routeColors (colored by keyword).
      if (key === "edges") {
        const nextEdges = !s.edges;

        return {
          ...s,
          edges: nextEdges,
          // When edges is ON, routeColors must be OFF (and vice versa).
          routeColors: nextEdges ? false : true,
        };
      }

      if (key === "routeColors") {
        const nextRouteColors = !s.routeColors;

        return {
          ...s,
          routeColors: nextRouteColors,
          // When routeColors is ON, edges must be OFF (and vice versa).
          edges: nextRouteColors ? false : true,
        };
      }

      // For other layers, toggle normally.
      return { ...s, [key]: !s[key] };
    });

  const handleTileSelect = (k) => setSelectedTile(k);

  const tileUrl = useMemo(
    () =>
      mapBaseItems.find((i) => i.key === selectedTile)?.url ??
      mapBaseItems[0].url,
    [selectedTile]
  );
  const tileAttr = useMemo(
    () =>
      mapBaseItems.find((i) => i.key === selectedTile)?.attribution ??
      mapBaseItems[0].attribution,
    [selectedTile]
  );

  // ===== Fullscreen & Export parity =====
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);

  // Shared fullscreen hook
  const { isFullscreen: isFs, toggleFullscreen: toggleFullScreen } = useFullscreen({
    containerRef,
    onFullscreenChange: () => {
      if (mapRef.current) {
        setTimeout(() => mapRef.current.invalidateSize({ animate: false }), 60);
        setTimeout(() => mapRef.current.invalidateSize({ animate: false }), 250);
      }
    },
  });

  const { exporting, exportPng } = useMapExport({
    containerRef,
    mapRef,
    tileLayerRef,
    lastInteractionTime,
    cooldownMs: DOWNLOAD_COOLDOWN_MS,
    postTilesDelayMs: POST_TILES_EXTRA_MS,
    rootSelector: "#od-map-root",
    legendSelector: ".map-legend-card",
    getFilename: () => {
      const tabLabel = odFilenameTabLabel(
        selectedVisualization,
        oDUsageDistributionSelectedMode,
        oDLastFirstStopSelectedMode
      );
      const screenWithTab = `${screenName}_${tabLabel}`;
      return buildFilename(scenarioName, screenWithTab, "map", undefined, "png");
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
      alert(VISUALIZATION.common.map.errors.pngExportFailedPrefix + (err?.message || err));
    }
  };

  // color mode
  const markerColor =
    oDUsageDistributionSelectedMode === "origin"
      ? blue[600]
      : oDUsageDistributionSelectedMode === "dest"
        ? red[600]
        : orange[600];
  const lastFirstMarkerColor =
    oDLastFirstStopSelectedMode === "first_stop" ? blue[600] : red[600];

  // Unique route labels (dedupe by label, prefer line midpoint)
  const uniqueRouteLabels = useMemo(() => {
    const out = [];
    const seen = new Set();

    const lineMidLatLng = (geometry) => {
      if (!geometry) return null;
      const { type, coordinates } = geometry;

      if (type === "LineString" && coordinates?.length) {
        const mid = Math.floor(coordinates.length / 2);
        const [lng, lat] = coordinates[mid];
        return [lat, lng];
      }

      if (type === "MultiLineString" && coordinates?.length) {
        const longest = coordinates.reduce(
          (a, b) => (b.length > (a?.length || 0) ? b : a),
          null
        );
        if (longest?.length) {
          const mid = Math.floor(longest.length / 2);
          const [lng, lat] = longest[mid];
          return [lat, lng];
        }
      }

      return null;
    };

    for (const f of routeFeatures) {
      const g = f?.geometry;
      if (!g || (g.type !== "LineString" && g.type !== "MultiLineString"))
        continue;

      const labels = f.properties?.keywords || f.properties?.route_groups || [];
      const kwColors = f.properties?.keyword_colors || [];

      const anchor = lineMidLatLng(g);

      labels.forEach((label, idx) => {
        if (label == null || seen.has(label)) return;
        seen.add(label);

        let rawColor = kwColors[idx] || kwColors[0] || null;
        let labelColor =
          rawColor && typeof rawColor === "string"
            ? rawColor.startsWith("#")
              ? rawColor
              : `#${rawColor}`
            : null;

        out.push({
          label,
          latlng: anchor,
          color: labelColor,
        });
      });
    }

    return out;
  }, [routeFeatures]);

  return (
    <Box
      ref={containerRef}
      id="od-map-root"
      data-map-root
      sx={{
        width: "100%",
        height: "100%",
        position: "relative",
        "& .leaflet-container": {
          width: "100%",
          height: "100%",
          borderRadius: 2,
        },
        "&:fullscreen .leaflet-container": { borderRadius: 0 },
        "&:-webkit-full-screen .leaflet-container": { borderRadius: 0 },
        "& .leaflet-control-attribution": {
          marginRight: "16px",
          marginBottom: "11px",  // tweak 70–90px if you want it higher/lower
        },
      }}
    >
      <ODMapActions
        isFullscreen={isFs}
        onToggleFullscreen={toggleFullScreen}
        onDownloadPng={handleDownloadPNG}
        exporting={exporting}
        mapUiZIndex={MAP_UI_Z}
      />

      <ODStopSearch
        options={currentStopOptions}
        value={selectedStop}
        loading={selectedVisualization !== 2 && stopFeatures.length === 0}
        onChange={(e, val) => setSelectedStop(val)}
        inputValue={searchInput}
        onInputChange={(e, val) => setSearchInput(val)}
        label={VISUALIZATION.common.map.labels.stopSelect}
        popperZIndex={MAP_UI_Z - 1}
        sx={{
          width: 300,
          position: "absolute",
          top: 25,
          left: 55,
          zIndex: POPPER_Z,
          background: "#fff",
          boxShadow: 2,
          borderRadius: 2,
        }}
      />

      <ODLeafletMap
        initialCenter={initialCenter}
        selectedTile={selectedTile}
        tileUrl={tileUrl}
        tileAttr={tileAttr}
        tileLayerRef={tileLayerRef}
        mapRef={mapRef}
        onMoveOrZoomEnd={() => setLastInteractionTime(Date.now())}
        selectedStop={selectedStop}
        hasBase={hasBase}
        routeFeatures={routeFeatures}
        layerState={layerState}
        uniqueRouteLabels={uniqueRouteLabels}
        currentStopOptions={currentStopOptions}
        selectedVisualization={selectedVisualization}
        points={points}
        radiusFor={radiusFor}
        oDUsageDistributionSelectedPoint={oDUsageDistributionSelectedPoint}
        oDUsageDistributionSelectedMode={oDUsageDistributionSelectedMode}
        lastFirstPoints={lastFirstPoints}
        oDLastFirstStopData={oDLastFirstStopData}
        oDLastFirstStopSelectedPoint={oDLastFirstStopSelectedPoint}
        setODLastFirstStopSelectedPoint={setODLastFirstStopSelectedPoint}
        oDLastFirstStopSelectedMode={oDLastFirstStopSelectedMode}
        lastFirstMarkerColor={lastFirstMarkerColor}
        filteredBusStopLines={filteredBusStopLines}
        busLineWeight={busLineWeight}
        busStopLines={busStopLines}
        oDBusStopSelectedPoint={oDBusStopSelectedPoint}
        setODBusStopSelectedPoint={setODBusStopSelectedPoint}
      />

      <ODOverlayControls
        selectedVisualization={selectedVisualization}
        layerState={layerState}
        onLayerToggle={handleLayerToggle}
        selectedTile={selectedTile}
        onTileSelect={handleTileSelect}
        minimized={minimized}
        setMinimized={setMinimized}
        legendMinimized={legendMinimized}
        setLegendMinimized={setLegendMinimized}
        mapUiZIndex={MAP_UI_Z}
        oDUsageDistributionSelectedMode={oDUsageDistributionSelectedMode}
        setODUsageDistributionSelectedMode={setODUsageDistributionSelectedMode}
        oDLastFirstStopSelectedMode={oDLastFirstStopSelectedMode}
        setODLastFirstStopSelectedMode={setODLastFirstStopSelectedMode}
        points={points}
        lastFirstPoints={lastFirstPoints}
        oDLastFirstStopSelectedPoint={oDLastFirstStopSelectedPoint}
        filteredBusStopLines={filteredBusStopLines}
      />
    </Box>
  );
}
