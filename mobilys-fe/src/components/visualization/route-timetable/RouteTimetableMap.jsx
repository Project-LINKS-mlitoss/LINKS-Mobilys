// components/visualization/route_timetable/RouteTimetableMap.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Autocomplete, TextField, IconButton } from "@mui/material";
import { MapContainer, TileLayer, Polyline, Marker, Pane, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../MapVisualization.css";
import MapLayerControlPanel from "../bus-running-visualization/MapLayerControlPanel";
import StopMarkerLayer from "../StopMarkerLayer";
import RouteLabelTooltip from "../RouteLabelTooltip";
import { BLANK_DIVICON, lineLabelLatLng, toColor } from "../buffer-analysis/BufferAnalysisMap";
import RouteIcon from "../../../assets/logo/route-color-layer.png";
import { POPPER_Z } from "../bus-running-visualization/MapVisualization";
import { buildFilename } from "../buildFilename";
import "leaflet/dist/leaflet.css";
import { ProxiedGrayTileLayer } from "../map/ProxiedGrayTileLayer";
import { VISUALIZATION } from "@/strings";
import { InvalidateSizeOnResize } from "../map/InvalidateSizeOnResize";
import { MapEvents } from "../map/MapEvents";
import { GSI_TILE_URLS } from "../map/tileUrls";
import { useMapExport } from "../map/useMapExport";


// Tiles
const TILE_PRESETS = {
  pale: {
    url: GSI_TILE_URLS.pale,
    attribution: VISUALIZATION.common.map.attributions.gsi,
  },
  std: {
    url: GSI_TILE_URLS.std,
    attribution: VISUALIZATION.common.map.attributions.gsi,
  },
  blank: {
    url: GSI_TILE_URLS.blank,
    attribution: VISUALIZATION.common.map.attributions.gsi,
  },
  photo: {
    url: GSI_TILE_URLS.photo,
    attribution: VISUALIZATION.common.map.attributions.gsi,
  },
};

// Fit to all features (routes + stops)
function deriveBounds(features = []) {
  const bounds = L.latLngBounds([]);
  features.forEach((f) => {
    const g = f?.geometry;
    if (!g?.coordinates) return;
    if (g.type === "LineString") g.coordinates.forEach(([lng, lat]) => bounds.extend([lat, lng]));
    else if (g.type === "MultiLineString")
      g.coordinates.forEach((seg) => seg.forEach(([lng, lat]) => bounds.extend([lat, lng])));
    else if (g.type === "Point") {
      const [lng, lat] = g.coordinates;
      bounds.extend([lat, lng]);
    }
  });
  return bounds.isValid() ? bounds : null;
}
function AutoFitBounds({ features }) {
  const map = useMap();
  useEffect(() => {
    const b = deriveBounds(features);
    if (!b) return;
    map.fitBounds(b, { padding: [32, 32] });
  }, [features, map]);
  return null;
}

function PanToStop({ stop }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !stop) return;
    map.panTo([stop.lat, stop.lng], { animate: true });
  }, [map, stop]);
  return null;
}

// Normalize click/search → { stop_id, stop_name, ... }
const normalizeStopPayload = (props = {}) => {
  const type = props.feature_type;
  if (type === "parent_stop") {
    const sid = props.stop_group_id ?? props.parent_stop_id;
    const name = props.parent_stop_name ?? props.parent_stop ?? String(sid || "");
    return { ...props, stop_id: String(sid || ""), stop_name: String(name || "") };
  }
  const sid = props.stop_id ?? props.stop_code ?? "";
  const name = props.stop_name ?? String(sid);
  return { ...props, stop_id: String(sid), stop_name: String(name) };
};

// --- MapContent (tiles + routes + stops) ---
const MapContent = React.memo(function MapContent({
  selectedTile,
  tileLayerRef,
  routeFeatures,
  stopGeojson,
  onStopSelect,
  layerState,
  canvasRenderer,
  routeLabelsData = [],
}) {
  const tileCfg = TILE_PRESETS[selectedTile] || TILE_PRESETS.pale;
  return (
    <>
      {selectedTile === "pale" ? (
        <ProxiedGrayTileLayer
          upstreamTemplate={VISUALIZATION.routeTimetable.components.timetableMap.upstreamTemplate}
          attribution={tileCfg.attribution}
          tileLayerRef={tileLayerRef}
          pane={VISUALIZATION.routeTimetable.components.timetableMap.proxiedGrayTilePane}
        />
      ) : (
        <TileLayer
          key={selectedTile}
          url={tileCfg.url}
          attribution={tileCfg.attribution}
          whenCreated={(tl) => (tileLayerRef.current = tl)}
          crossOrigin="anonymous"
        />
      )}

    {(layerState.edges || layerState.routeColors) &&
      routeFeatures.map((feature, idx) => {
        const coords = feature.geometry?.coordinates || [];
        const props = feature.properties || {};

        let color = VISUALIZATION.routeTimetable.components.timetableMap.defaultColor; 
        if (
          layerState.routeColors &&
          Array.isArray(props.keyword_colors) &&
          props.keyword_colors.length > 0
        ) {
          const raw = props.keyword_colors[0];
          color = raw?.startsWith("#") ? raw : `#${raw}`;
        }

        return (
          <Polyline
            key={`route-${idx}`}
            positions={coords.map(([lng, lat]) => [lat, lng])}
            pathOptions={{ color, weight: 4, opacity: 0.85 }}
            renderer={canvasRenderer}
          />
        );
      })}

      {layerState.routeLabels &&
        routeLabelsData.map((item, index) => {
          const coords = Array.isArray(item.coordinates) ? item.coordinates : null;
          if (!coords || coords.length < 2) return null;
          const position = [coords[1], coords[0]];
          const labels = Array.isArray(item.label) ? item.label : [item.label];
          const labelColor = layerState.routeColors ? toColor(item.color) : VISUALIZATION.routeTimetable.components.timetableMap.defaultColor;
          if (!labels.filter(Boolean).length) return null;
          return (
            <Marker
              key={`route-label-${index}`}
              position={position}
              icon={BLANK_DIVICON}
              pane={VISUALIZATION.routeTimetable.components.timetableMap.routeLabelsPane}
              interactive={false}
            >
              <RouteLabelTooltip
                pane={VISUALIZATION.routeTimetable.components.timetableMap.routeTooltipPane}
                labels={labels}
                color={labelColor}
                direction="center"
                offset={[0, 0]}
              />
            </Marker>
          );
        })}

      <StopMarkerLayer
        stopGeojson={stopGeojson}
        show={layerState.stops}
        showLabels={layerState.stopLabels}
        onStopSelect={(props) => onStopSelect?.(normalizeStopPayload(props))}
        tooltipPane={VISUALIZATION.routeTimetable.components.timetableMap.stopLabelsPane}
      />
    </>
  );
});

// ===================== MAIN =====================
export default function RouteTimetableMap({
  allRouteAndStopData,
  onStopSelect,
  selectedStopId,
  containerWidth = 0,
  scenarioName,
  screenName = VISUALIZATION.routeTimetable.components.timetableMap.screenName,
}) {
  const features = allRouteAndStopData?.features || [];

  const routeFeatures = useMemo(
    () => features.filter((f) => f?.geometry?.type === "LineString" && f?.properties?.feature_type === "route"),
    [features]
  );

  const stopFeatures = useMemo(
    () =>
      features.filter(
        (f) =>
          f?.geometry?.type === "Point" &&
          (f?.properties?.feature_type === "parent_stop" || f?.properties?.feature_type === "stop")
      ),
    [features]
  );

  const stopGeojson = useMemo(() => ({ type: "FeatureCollection", features: stopFeatures }), [stopFeatures]);
  const routeLabelsData = useMemo(() => {
    const res = [];
    const seen = new Set();
    routeFeatures.forEach((feature) => {
      const geom = feature?.geometry;
      if (!geom || !geom.coordinates) return;
      const props = feature.properties || {};
      const labelsSource =
        (Array.isArray(props.keywords) && props.keywords.length > 0 && props.keywords) ||
        props.route_groups ||
        [];
      if (!Array.isArray(labelsSource) || labelsSource.length === 0) return;
      const midLatLng = lineLabelLatLng(geom);
      let anchor = null;
      if (midLatLng) {
        anchor = [midLatLng[1], midLatLng[0]];
      } else if (geom.type === "LineString" && Array.isArray(geom.coordinates) && geom.coordinates.length) {
        anchor = geom.coordinates[Math.floor(geom.coordinates.length / 2)];
      } else if (
        geom.type === "MultiLineString" &&
        Array.isArray(geom.coordinates) &&
        geom.coordinates.length &&
        Array.isArray(geom.coordinates[0]) &&
        geom.coordinates[0].length
      ) {
        anchor = geom.coordinates[0][Math.floor(geom.coordinates[0].length / 2)];
      }
      const rawColor =
        Array.isArray(props.keyword_colors) && props.keyword_colors.length > 0 ? props.keyword_colors[0] : null;
      const labelColor = rawColor ? toColor(rawColor) : "#58AB39";
      labelsSource.forEach((label) => {
        if (label == null || seen.has(label)) return;
        seen.add(label);
        res.push({ label, coordinates: anchor, color: labelColor });
      });
    });
    return res;
  }, [routeFeatures]);

  // Search options
  const stopOptions = useMemo(
    () =>
      stopFeatures
        .map((f) => {
          const p = f.properties || {};
          const [lng, lat] = f.geometry?.coordinates || [];
          const isParent = p.feature_type === "parent_stop";
          const id = isParent ? p.stop_group_id ?? p.parent_stop_id : p.stop_id ?? p.stop_code;
          const label = isParent ? p.parent_stop_name ?? p.parent_stop ?? String(id || "") : p.stop_name ?? String(id || "");
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || !id) return null;
          return { id: String(id), label, lat: Number(lat), lng: Number(lng), raw: p };
        })
        .filter(Boolean),
    [stopFeatures]
  );
  const selectedStopOption = useMemo(
    () => stopOptions.find((o) => String(o.id) === String(selectedStopId || "")) || null,
    [stopOptions, selectedStopId]
  );
  const selectedStopLatLng = useMemo(
    () => (selectedStopOption ? { lat: selectedStopOption.lat, lng: selectedStopOption.lng } : null),
    [selectedStopOption]
  );
  const isActiveStop = useMemo(() => {
    if (!selectedStopId) return null;
    const target = String(selectedStopId);
    return (props = {}) => {
      const candidates = [
        props.stop_id,
        props.stop_code,
        props.stop_group_id,
        props.parent_stop_id,
      ];
      return candidates.some((value) => value && String(value) === target);
    };
  }, [selectedStopId]);

  // Layers / tiles
  const [selectedTile, setSelectedTile] = useState(VISUALIZATION.routeTimetable.components.timetableMap.defaultSelectedTile);
  const [layerState, setLayerState] = useState({
    edges: true,
    routeLabels: false,
    stops: true,
    stopLabels: false,
    routeColors: false,
  });
  const [minimized, setMinimized] = useState(true);

  // Fullscreen infra (native FS on container)
  const containerRef = useRef(null);
  const inlineCaptureRef = useRef(null);
  const fsCaptureRef = useRef(null);
  const mapRefInline = useRef(null);
  const mapRefFs = useRef(null);
  const tileLayerRefInline = useRef(null);
  const tileLayerRefFs = useRef(null);
  const canvasRendererInline = useMemo(() => L.canvas({ padding: 0.5 }), []);
  const canvasRendererFs = useMemo(() => L.canvas({ padding: 0.5 }), []);
  const [isSelfFullscreen, setIsSelfFullscreen] = useState(false);
  const [lastInteractionTime, setLastInteractionTime] = useState(0);

  const inlineExport = useMapExport({
    containerRef: inlineCaptureRef,
    mapRef: mapRefInline,
    tileLayerRef: tileLayerRefInline,
    lastInteractionTime,
    cooldownMs: 5000,
    postTilesDelayMs: 3000,
    rootSelector: "[data-rtm-root]",
    getFilename: () => buildFilename(scenarioName, screenName, "map", undefined, "png"),
  });

  const fsExport = useMapExport({
    containerRef: fsCaptureRef,
    mapRef: mapRefFs,
    tileLayerRef: tileLayerRefFs,
    lastInteractionTime,
    cooldownMs: 5000,
    postTilesDelayMs: 3000,
    rootSelector: "[data-rtm-root]",
    getFilename: () => buildFilename(scenarioName, screenName, "map", undefined, "png"),
  });

  const exporting = inlineExport.exporting || fsExport.exporting;

  const zoomMapsToStop = (lat, lng, zoomLevel = 17) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const target = [lat, lng];
    [mapRefInline.current, mapRefFs.current].forEach((mapInstance) => {
      if (!mapInstance) return;
      const currentZoom = typeof mapInstance.getZoom === "function" ? mapInstance.getZoom() : null;
      const nextZoom =
        typeof currentZoom === "number" && currentZoom > zoomLevel ? currentZoom : zoomLevel;
      mapInstance.setView(target, nextZoom, { animate: true });
    });
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsSelfFullscreen(document.fullscreenElement === containerRef.current);
      requestAnimationFrame(() => {
        mapRefInline.current?.invalidateSize?.({ animate: false });
        mapRefFs.current?.invalidateSize?.({ animate: false });
        tileLayerRefInline.current?.redraw?.();
        tileLayerRefFs.current?.redraw?.();
      });
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullScreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement === el) document.exitFullscreen?.();
    else el.requestFullscreen?.();
  };

  // Show search inline only if not occluded
  const [notOccluded, setNotOccluded] = useState(true);
  useEffect(() => {
    let raf;
    const check = () => {
      const el = containerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) setNotOccluded(false);
      else {
        const pts = [
          [r.left + r.width / 2, r.top + 20],
          [r.left + 40, r.top + 40],
          [r.right - 40, r.top + 40],
        ];
        setNotOccluded(pts.some(([x, y]) => (document.elementFromPoint(x, y) || null)?.closest?.(".leaflet-container, [data-rtm-root]")));
      }
      raf = requestAnimationFrame(check);
    };
    raf = requestAnimationFrame(check);
    return () => raf && cancelAnimationFrame(raf);
  }, []);

  const handleDownloadPNG = async () => {
    if (exporting) return;

    const inactiveCaptureRef = isSelfFullscreen ? inlineCaptureRef : fsCaptureRef;
    inactiveCaptureRef.current?.setAttribute("data-html2canvas-ignore", "true");

    try {
      if (isSelfFullscreen) await fsExport.exportPng();
      else await inlineExport.exportPng();
    } catch (e) {
      console.error("[RouteTimetableMap] Export PNG failed:", e);
      alert(VISUALIZATION.common.map.errors.pngExportFailed);
    } finally {
      inlineCaptureRef.current?.removeAttribute("data-html2canvas-ignore");
      fsCaptureRef.current?.removeAttribute("data-html2canvas-ignore");
    }
  };
  const handleLayerToggle = (key) =>
    setLayerState((s) => {
      // Mutual exclusivity: edges (green) vs routeColors (keyword colors)
      if (key === "edges") {
        const nextEdges = !s.edges;
        return {
          ...s,
          edges: nextEdges,
          // Turn edges on -> turn routeColors off (and vice versa)
          routeColors: nextEdges ? false : true,
        };
      }

      if (key === "routeColors") {
        const nextRouteColors = !s.routeColors;
        return {
          ...s,
          routeColors: nextRouteColors,
          // Turn routeColors on -> turn edges off (and vice versa)
          edges: nextRouteColors ? false : true,
        };
      }

      // Other keys: normal toggle
      return { ...s, [key]: !s[key] };
    });

  const handleTileSelect = (key) => setSelectedTile(key);

  const handleStopMarkerClick = (props) => {
    onStopSelect?.(normalizeStopPayload(props));
  };
  const [selectedStop, setSelectedStop] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const handleSearchChange = (_, option) => {
    if (!option) {
      setSelectedStop(null);
      onStopSelect?.(null);
      return;
    }
    setSelectedStop({ id: option.id, label: option.label, lat: option.lat, lng: option.lng });
    zoomMapsToStop(option.lat, option.lng);
    onStopSelect?.(normalizeStopPayload(option.raw));
  };

  const showInlineSearch = notOccluded && !isSelfFullscreen;

  return (
    <Box
      ref={containerRef}
      data-rtm-root
      sx={{
        width: "100%",
        height: "100%",
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
    >
      {/* Buttons (horizontal) */}
      <IconButton
        data-html2canvas-ignore
        onClick={handleDownloadPNG}
        disabled={exporting}
        sx={{ position: "absolute", top: 16, right: 70, zIndex: 1100, bgcolor: "#fff", boxShadow: 1, opacity: exporting ? 0.6 : 1 }}
        size="large"
        aria-label="download-png"
        title={VISUALIZATION.common.map.actions.downloadMap}
      >
        <span className="material-symbols-outlined outlined">
          download
        </span>
      </IconButton>
      <IconButton
        data-html2canvas-ignore
        onClick={toggleFullScreen}
        sx={{ position: "absolute", top: 16, right: 16, zIndex: 1100, bgcolor: "#fff", boxShadow: 1 }}
        size="large"
        aria-label="fullscreen"
        title={VISUALIZATION.common.map.fullscreen.enter}
      >
        <span className="material-symbols-outlined outlined">
          fullscreen
        </span>
      </IconButton>

      {exporting && (
        <div
          data-html2canvas-ignore
          style={{ position: "absolute", inset: 0, zIndex: 1200, display: "grid", placeItems: "center", background: "rgba(255,255,255,0.35)", fontWeight: 700 }}
        >
          {VISUALIZATION.common.map.actions.downloading}
        </div>
      )}

      {/* Stop search (inline) */}
      {showInlineSearch && (
        <Autocomplete
          fullWidth
          sx={{ width: 300, position: "absolute", top: 25, left: 55, zIndex: POPPER_Z, background: "#fff", boxShadow: 2, borderRadius: 2 }}
          size="small"
          options={stopOptions}
          value={selectedStop}
          onChange={handleSearchChange}
          inputValue={searchInput}
          onInputChange={(e, v) => setSearchInput(v)}
          isOptionEqualToValue={(o, v) => o?.id === v?.id}
          getOptionLabel={(o) => (o ? `${o.label}` : "")}
          disablePortal
          data-html2canvas-ignore
          slotProps={{ popper: { sx: { zIndex: POPPER_Z } } }}
          renderInput={(params) => <TextField {...params} label={VISUALIZATION.common.map.labels.stopSelect} />}
        />
      )}

      {/* Inline capture root */}
      <div ref={inlineCaptureRef} style={{ position: "absolute", inset: 0 }}>
        <MapContainer
          center={[35.681236, 139.767125]}
          zoom={12}
          scrollWheelZoom
          style={{ width: "100%", height: "100%" }}
          whenCreated={(m) => (mapRefInline.current = m)}
          preferCanvas
        >
          <MapEvents onMoveOrZoomEnd={() => setLastInteractionTime(Date.now())} />
          <InvalidateSizeOnResize targetRef={inlineCaptureRef} deps={[minimized, isSelfFullscreen, containerWidth]} />
          <AutoFitBounds features={features} />
          <PanToStop stop={selectedStopLatLng} />

          <Pane name={VISUALIZATION.routeTimetable.components.timetableMap.routeLabelsPane} style={{ zIndex: 755 }} />
          <Pane name={VISUALIZATION.routeTimetable.components.timetableMap.stopLabelsPane} style={{ zIndex: 760 }} />
          <Pane name={VISUALIZATION.routeTimetable.components.timetableMap.routeTooltipPane} style={{ zIndex: 756 }} />

          <MapContent
            selectedTile={selectedTile}
            tileLayerRef={tileLayerRefInline}
            routeFeatures={routeFeatures}
            stopGeojson={stopGeojson}
            onStopSelect={handleStopMarkerClick}
            layerState={layerState}
            canvasRenderer={canvasRendererInline}
            routeLabelsData={routeLabelsData}
          />

        </MapContainer>
      </div>

      {/* Fullscreen layer */}
      {isSelfFullscreen && (
        <Box
          key="fs"
          ref={fsCaptureRef}
          sx={{
            position: "fixed",
            inset: 0,
            width: "100vw",
            height: "100vh",
            bgcolor: "#fff",
            zIndex: 1300,
            "& .leaflet-container": {
              width: "100%",
              height: "100%",
            },
            "& .leaflet-control-attribution": {
              marginRight: "16px",      // same offset in fullscreen
              marginBottom: "11px",
            },
          }}
        >

           {exporting && (
           <div
             data-html2canvas-ignore
             style={{
               position: "absolute",
               inset: 0,
               zIndex: 1400,
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
          {/* FS search */}
          <Autocomplete
            fullWidth
            sx={{ width: 300, position: "absolute", top: 25, left: 55, zIndex: POPPER_Z, background: "#fff", boxShadow: 2, borderRadius: 2 }}
            size="small"
            options={stopOptions}
            value={selectedStop}
            onChange={handleSearchChange}
            inputValue={searchInput}
            onInputChange={(e, v) => setSearchInput(v)}
            isOptionEqualToValue={(o, v) => o?.id === v?.id}
            getOptionLabel={(o) => (o ? `${o.label}` : "")}
            disablePortal
            data-html2canvas-ignore
            slotProps={{ popper: { sx: { zIndex: POPPER_Z } } }}
            renderInput={(params) => <TextField {...params} label={VISUALIZATION.common.map.labels.stopSelect} />}
          />

          {/* FS buttons (horizontal) */}
          <IconButton
            data-html2canvas-ignore
            onClick={handleDownloadPNG}
            disabled={exporting}
            sx={{ position: "absolute", top: 16, right: 86, zIndex: 1350, bgcolor: "#fff", boxShadow: 1, opacity: exporting ? 0.6 : 1 }}
            size="large"
            aria-label="download-png-fs"
            title={VISUALIZATION.common.map.actions.downloadMap}
          >
            <span className="material-symbols-outlined outlined">
              download
            </span>
          </IconButton>
          <IconButton
            data-html2canvas-ignore
            onClick={toggleFullScreen}
            sx={{ position: "absolute", top: 16, right: 32, zIndex: 1350, bgcolor: "#fff", boxShadow: 1 }}
            size="large"
            aria-label="close-fullscreen"
            title={VISUALIZATION.common.map.fullscreen.exit}
          >
            <span className="material-symbols-outlined outlined">
              fullscreen_exit
            </span>
          </IconButton>

          <div style={{ position: "absolute", inset: 0 }}>
            <MapContainer
              center={[35.681236, 139.767125]}
              zoom={12}
              scrollWheelZoom
              style={{ width: "100%", height: "100%" }}
              whenCreated={(m) => (mapRefFs.current = m)}
              preferCanvas
            >
              <MapEvents onMoveOrZoomEnd={() => setLastInteractionTime(Date.now())} />
              <InvalidateSizeOnResize targetRef={fsCaptureRef} deps={[minimized]} />
              {/* ✅ Fit first, then focus */}
              <AutoFitBounds features={features} />
              <PanToStop stop={selectedStopLatLng} />

              <Pane name={VISUALIZATION.routeTimetable.components.timetableMap.routeLabelsPane} style={{ zIndex: 745 }} />
              <Pane name={VISUALIZATION.routeTimetable.components.timetableMap.stopLabelsPane} style={{ zIndex: 760 }} />
              <Pane name={VISUALIZATION.routeTimetable.components.timetableMap.routeTooltipPane} style={{ zIndex: 755 }} />
              <Pane name={VISUALIZATION.routeTimetable.components.timetableMap.routeTimetableHighlightPane} style={{ zIndex: 770 }} />

              <MapContent
                selectedTile={selectedTile}
                tileLayerRef={tileLayerRefFs}
                routeFeatures={routeFeatures}
                stopGeojson={stopGeojson}
                onStopSelect={handleStopMarkerClick}
                layerState={layerState}
                canvasRenderer={canvasRendererFs}
                activeStopPredicate={isActiveStop}
                routeLabelsData={routeLabelsData}
              />

            </MapContainer>
          </div>

          {/* FS control panel */}
          <div data-html2canvas-ignore>
              <MapLayerControlPanel
              additionalLayerItems={[{ key: "routeColors", icon: RouteIcon, label: VISUALIZATION.common.map.labels.routeColors }]}
              layerState={layerState}
              onLayerToggle={handleLayerToggle}
              selectedTile={selectedTile}
              onTileSelect={handleTileSelect}
              minimized={minimized}
              setMinimized={setMinimized}
            />
          </div>
        </Box>
      )}

      {/* Inline control panel */}
      {!isSelfFullscreen && (
        <div data-html2canvas-ignore>
          <MapLayerControlPanel
            additionalLayerItems={[{ key: "routeColors", icon: RouteIcon, label: VISUALIZATION.common.map.labels.routeColors }]}
            layerState={layerState}
            onLayerToggle={handleLayerToggle}
            selectedTile={selectedTile}
            onTileSelect={setSelectedTile}
            minimized={minimized}
            setMinimized={setMinimized}
          />
        </div>
      )}
    </Box>
  );
}
