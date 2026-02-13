// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { useState, useMemo, useRef, useEffect } from "react";
import { Box, TextField, Autocomplete } from "@mui/material";
import {
  MapContainer,
  TileLayer,
  useMap,
  Polyline,
  Pane,
  GeoJSON,
  Marker,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../MapVisualization.css";
import MapLayerControlPanel from "../bus-running-visualization/MapLayerControlPanel";
import PopulationLegendButton from "../PopulationLegendButton";
import RouteIcon from "../../../assets/logo/route-color-layer.png";
import IconButton from "@mui/material/IconButton";

import { PoiLayer } from "../../poi/PoiLayer";
import StopMarkerLayer from "../StopMarkerLayer";
import RouteLabelTooltip from "../RouteLabelTooltip";
import { POPPER_Z } from "../bus-running-visualization/MapVisualization";

import { spreadLabelOffsets } from "../SpreadLabelOffset";
import { buildFilename } from "../buildFilename";
import "leaflet/dist/leaflet.css";
import { ProxiedGrayTileLayer } from "../map/ProxiedGrayTileLayer";
import { InvalidateSizeOnResize } from "../map/InvalidateSizeOnResize";
import { MapEvents } from "../map/MapEvents";
import { MapResizer } from "../map/MapResizer";
import {
  AutoCenterMap,
  FocusOnStop,
  PopulationLayer,
} from "../map/MapSharedComponents";
import { useMapExport } from "../map/useMapExport";
import { useFullscreen } from "../map/useFullscreen";
import { VISUALIZATION } from "@/strings";
import { GSI_TILE_URLS, OSM_TILE_URL_TEMPLATE } from "../map/tileUrls";
import { collectLatLngsFromGeom, getGeoJsonCenter } from "../map/mapCalcUtils";

const DEFAULT_ZOOM = 13;

// Match BufferAnalysis POI sizing
const stopLikeDiameter = (zoom) => {
  const size = Math.max(6, Math.min(9, Math.round(6 + 0.9 * (zoom - 12))));
  const border = Math.max(1, Math.round(size * 0.22));
  return size + 2 * border;
};

function FitToRadius({ featureCollection, rerenderKey }) {
  const map = useMap();
  useEffect(() => {
    const feats = featureCollection?.features || [];
    if (!feats.length) return;

    let latlngs = [];
    feats.forEach((f) => latlngs.push(...collectLatLngsFromGeom(f.geometry)));
    if (!latlngs.length) return;

    const lats = latlngs.map((p) => p[0]);
    const lngs = latlngs.map((p) => p[1]);
    const sw = [Math.min(...lats), Math.min(...lngs)];
    const ne = [Math.max(...lats), Math.max(...lngs)];
    const padLat = (ne[0] - sw[0]) * 0.08 + 0.001;
    const padLng = (ne[1] - sw[1]) * 0.08 + 0.001;

    map.fitBounds(
      [
        [sw[0] - padLat, sw[1] - padLng],
        [ne[0] + padLat, ne[1] + padLng],
      ],
      { animate: true }
    );
  }, [featureCollection, rerenderKey, map]);
  return null;
}

export default function StopRadiusMap({
  containerWidth = 0,
  allRouteAndStopData,
  populationData,
  radiusFeatureCollection,
  pois = [],
  radiusKey,
  scenarioName = VISUALIZATION.common.scenarioFallbackName,
  screenName = VISUALIZATION.titles.stopRadiusAnalysis,
}) {
  const [selectedTile, setSelectedTile] = useState("pale");
  const [minimized, setMinimized] = useState(true);
  const [layerState, setLayerState] = useState({
    edges: true, // Route edges
    routeColors: false, // Colorized routes
    stops: true,
    routeLabels: false,
    stopLabels: false,
    radius: true,
    pois: true,
    population: true,
    population0_14: false,
    population15_64: false,
    population65_up: false,
  });

  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [lastInteractionTime, setLastInteractionTime] = useState(0);

  const routesRenderer = useMemo(
    () => L.canvas({ padding: 0.5, pane: "routes-pane" }),
    []
  );
  const populationRenderer = useMemo(
    () => L.canvas({ padding: 0.5, pane: "population-pane" }),
    []
  );
  const radiusRenderer = useMemo(
    () => L.canvas({ padding: 0.5, pane: "stop-radius-radius-pane" }),
    []
  );

  const poiRadius = useMemo(
    () => stopLikeDiameter(zoom),
    [zoom]
  );

  const handleLayerToggle = (key) =>
    setLayerState((s) => {
      // Mutually exclusive: edges vs routeColors
      if (key === "edges") {
        const nextEdges = !s.edges;

        return {
          ...s,
          edges: nextEdges,
          routeColors: nextEdges ? false : true, // edges OFF → routeColors ON
        };
      }

      if (key === "routeColors") {
        const nextRouteColors = !s.routeColors;

        return {
          ...s,
          routeColors: nextRouteColors,
          edges: nextRouteColors ? false : true, // routeColors ON → edges OFF
        };
      }

      // Other layers toggle normally
      return { ...s, [key]: !s[key] };
    });

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

  const [initialCenter, setInitialCenter] = useState([
    35.681236, 139.767125,
  ]);

  const stopOptions = useMemo(() => {
    const feats = allRouteAndStopData?.features || [];
    return feats
      .filter(
        (f) =>
          f.geometry?.type === "Point" &&
          (f.properties?.feature_type === "stop" ||
            f.properties?.feature_type === "parent_stop")
      )
      .map((f) => ({
        id:
          f.properties?.stop_id ||
          f.properties?.id ||
          f.properties?.code ||
          `${f.geometry.coordinates[1]},${f.geometry.coordinates[0]}`,
        label: f.properties?.parent_stop,
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
      }));
  }, [allRouteAndStopData]);

  const uniqueRouteLabels = useMemo(() => {
    const res = [];
    const seen = new Set();
    const feats = allRouteAndStopData?.features || [];

    for (const f of feats) {
      if (f?.geometry?.type !== "LineString") continue;
      if (f?.properties?.feature_type !== "route") continue;

      const labels =
        f?.properties?.keywords || f?.properties?.route_groups || [];

      const colors = f?.properties?.keyword_colors || [];

      const coords = Array.isArray(f.geometry.coordinates)
        ? f.geometry.coordinates
        : null;
      const midCoord =
        coords && coords.length
          ? coords[Math.floor(coords.length / 2)] // [lon, lat]
          : null;

      labels.forEach((label, idx) => {
        if (label == null) return;
        if (seen.has(label)) return;
        seen.add(label);

        let rawColor = colors[idx] || colors[0] || null;
        let color =
          rawColor && typeof rawColor === "string"
            ? rawColor.startsWith("#")
              ? rawColor
              : `#${rawColor}`
            : null;

        res.push({
          label,
          coordinates: midCoord,
          color, // <-- store it
        });
      });
    }

    return res;
  }, [allRouteAndStopData]);

  const routeLabelsWithOffsets = useMemo(() => {
    return spreadLabelOffsets(uniqueRouteLabels, {
      precision: 6,
      baseRadiusPx: 10,
      stepPx: 6,
      perRing: 8,
      sortKey: (x) => String(x.label),
    });
  }, [uniqueRouteLabels]);

  const [searchInput, setSearchInput] = useState("");
  const [selectedStop, setSelectedStop] = useState(null);

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
          label={VISUALIZATION.common.map.labels.stopSelect}
        />
      )}
    />
  );

  useEffect(() => {
    if (allRouteAndStopData?.features?.length) {
      setInitialCenter(getGeoJsonCenter(allRouteAndStopData.features));
    }
  }, [allRouteAndStopData]);

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);

  // Shared fullscreen hook
  const { isFullscreen: isFs, toggleFullscreen: toggleFullScreen } = useFullscreen({
    containerRef,
    onFullscreenChange: () => {
      window.dispatchEvent(new Event("resize"));
      mapRef.current?.invalidateSize?.({ animate: false });
    },
  });

  const { exporting, exportPng } = useMapExport({
    containerRef,
    mapRef,
    tileLayerRef,
    lastInteractionTime,
    getFilename: () => buildFilename(scenarioName, screenName, "map", undefined, "png"),
    rootSelector: "#stop-radius-map-root",
    legendSelector: ".map-legend-card",
  });

  const stopGeojson = useMemo(() => {
    const feats = allRouteAndStopData?.features || [];
    const stopFeatures = feats.filter(
      (f) =>
        f.geometry?.type === "Point" &&
        f.properties?.feature_type === "parent_stop"
    );
    return { type: "FeatureCollection", features: stopFeatures };
  }, [allRouteAndStopData]);

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

  // Ensure Leaflet attribution is rendered once immediately
  function AttributionFixOnLoad() {
    const map = useMap();
    const firedRef = useRef(false);

    useEffect(() => {
      if (!map) return;

      const handler = () => {
        if (firedRef.current) return;
        firedRef.current = true;

        // wait a tick so the container has a proper size
        setTimeout(() => {
          map.invalidateSize(false);

          // force Leaflet attribution control to recalc its text/position
          if (map.attributionControl && map.attributionControl._update) {
            map.attributionControl._update();
          }
        }, 0);
      };

      // fire once when the base layer finishes loading
      map.once("load", handler);

      return () => {
        map.off("load", handler);
      };
    }, [map]);

    return null;
  }
  // --------------------------------------------------------------------

  return (
    <Box
      ref={containerRef}
      id="stop-radius-map-root"
      data-map-root
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
        "&:fullscreen .leaflet-container": {
          borderRadius: 0,
        },
        "&:-webkit-full-screen .leaflet-container": {
          borderRadius: 0,
        },
        "& .leaflet-control-attribution": {
          marginRight: "16px",
          marginBottom: "11px",
        },
      }}
    >

      {renderStopSearch({}, isFs ? "fs" : "inline")}

      {/* Fullscreen */}
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

      {/* Download PNG */}
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

      {/* Export overlay */}
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

      <MapContainer
        center={initialCenter}
        zoom={13}
        scrollWheelZoom
        style={{ width: "100%", height: "100%" }}
        attributionControl={true}
        whenCreated={(map) => {
          mapRef.current = map;
          setTimeout(() => map.invalidateSize(false), 0);
        }}
        preferCanvas={true}
      >
        <MapEvents
          onZoomChange={setZoom}
          onMoveOrZoomEnd={() => setLastInteractionTime(Date.now())}
        />
        <InvalidateSizeOnResize
          targetRef={containerRef}
          deps={[minimized, isFs]}
        />
        <AutoCenterMap features={allRouteAndStopData?.features} />

        {selectedTile === "pale" ? (
          // ✅ pale uses server-side greyscale tiles
          <ProxiedGrayTileLayer
            upstreamTemplate={GSI_TILE_URLS.pale}
            attribution={TILE_ATTRS.pale}
            tileLayerRef={tileLayerRef}
            pane="tilePane"
          />
        ) : (
          // other styles use normal color tiles
          <TileLayer
            ref={tileLayerRef}
            key={selectedTile}
            url={tileUrl}
            attribution={tileAttr}
            crossOrigin="anonymous"
          />
        )}

        <MapResizer containerWidth={containerWidth} />

        {/* panes for labels/tooltips and layers */}
        <Pane name="stop-radius-route-labels-pane" style={{ zIndex: 745 }} />
        <Pane
          name="stop-radius-labels-tooltip-pane"
          style={{ zIndex: 760 }}
        />
        <Pane
          name="stop-radius-route-tooltip-pane"
          style={{ zIndex: 755 }}
        />
        <Pane name="population-pane" style={{ zIndex: 200 }} />
        <Pane name="routes-pane" style={{ zIndex: 500 }} />
        <Pane name="stop-radius-radius-pane" style={{ zIndex: 350 }} />

        <FocusOnStop stop={selectedStop} />

        {/* === Backend radius polygons === */}
        {layerState.radius && radiusFeatureCollection && (
          <GeoJSON
            key={`geo-${radiusKey}`}
            data={radiusFeatureCollection}
            renderer={radiusRenderer}
            style={() => ({
              color: "#1976d2",
              weight: 2,
              opacity: 0.9,
              fillColor: "#9e9e9e",
              fillOpacity: 0.3,
            })}
            interactive={false}
          />
        )}

        {radiusFeatureCollection && (
          <FitToRadius
            featureCollection={radiusFeatureCollection}
            rerenderKey={radiusKey}
          />
        )}

        {/* === Routes === */}
        {allRouteAndStopData?.features?.map((feature, idx) => {
          if (
            feature.geometry.type === "LineString" &&
            feature.properties.feature_type === "route"
          ) {
            // Don't render when both are off
            if (!layerState.edges && !layerState.routeColors) return null;

            let polylineColor = "#58AB39";
            if (
              layerState.routeColors &&
              feature.properties.keyword_colors?.length > 0
            ) {
              polylineColor = feature.properties.keyword_colors[0].startsWith("#")
                ? feature.properties.keyword_colors[0]
                : `#${feature.properties.keyword_colors[0]}`;
            }

            return (
              <Polyline
                key={`route-${idx}`}
                pane="routes-pane"
                positions={feature.geometry.coordinates.map(([lng, lat]) => [
                  lat,
                  lng,
                ])}
                pathOptions={{ color: polylineColor, weight: 4, opacity: 0.7 }}
                renderer={routesRenderer}
              />
            );
          }
          return null;
        })}

        {/* === Route Labels (unique; render once) === */}
        {layerState.routeLabels &&
          routeLabelsWithOffsets.map((item, index) => {
            const pos = item.coordinates
              ? [item.coordinates[1], item.coordinates[0]]
              : null;
            const color =
              layerState.routeColors && item.color ? item.color : "#58AB39";
            if (!pos) return null;
            return (
              <Marker
                key={`route-label-${index}`}
                position={pos}
                pane="stop-radius-route-labels-pane"
                interactive={false}
                icon={L.divIcon({ className: "", html: "", iconSize: [1, 1] })}
              >
                <RouteLabelTooltip
                  pane="stop-radius-route-tooltip-pane"
                  label={item.label}
                  color={color}
                  direction="center"
                  offset={item._offset}
                />
              </Marker>
            );
          })}

        {/* === Stops via shared layer === */}
        <StopMarkerLayer
          stopGeojson={stopGeojson}
          show={layerState.stops}
          showLabels={layerState.stopLabels}
        />

        {/* === Population === */}
        <PopulationLayer
          populationData={populationData}
          layerState={layerState}
          renderer={populationRenderer}
        />

        {/* === POIs === */}
        {layerState.pois && <PoiLayer pois={pois} radius={poiRadius} />}

        {/* Population legend */}
        <PopulationLegendButton
          activeKey={[
            "population",
            "population0_14",
            "population15_64",
            "population65_up",
          ].find((k) => layerState[k])}
        />
      </MapContainer>

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
              label: VISUALIZATION.stopRadiusAnalysis.components.map.layers.pois,
            },
            {
              key: "radius",
              icon: (
                <span className="material-symbols-outlined outlined">
                  radar
                </span>
              ),
              label: VISUALIZATION.stopRadiusAnalysis.components.map.layers.radius,
            },
          ]}
          populationItems={[
            {
              key: "population",
              icon: (
                <span className="material-symbols-outlined outlined">
                  groups
                </span>
              ),
              label: VISUALIZATION.common.filters.allAlt,
            },
            {
              key: "population0_14",
              icon: (
                <span className="material-symbols-outlined outlined">
                  groups
                </span>
              ),
              label: VISUALIZATION.stopRadiusAnalysis.labels.age0_14,
            },
            {
              key: "population15_64",
              icon: (
                <span className="material-symbols-outlined outlined">
                  groups
                </span>
              ),
              label: VISUALIZATION.stopRadiusAnalysis.labels.age15_64,
            },
            {
              key: "population65_up",
              icon: (
                <span className="material-symbols-outlined outlined">
                  groups
                </span>
              ),
              label: VISUALIZATION.stopRadiusAnalysis.labels.age65Up,
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

      <style>
        {`
          .leaflet-tooltip.stop-label-tooltip,
          .leaflet-tooltip.route-label-tooltip {
            background: none !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            min-width: 0 !important;
            min-height: 0 !important;
            pointer-events: none;
          }
        `}
      </style>
    </Box>
  );
}
