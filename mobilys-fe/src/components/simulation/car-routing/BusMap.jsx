import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap, Pane } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import LayerControlPanel from "../../visualization/bus-running-visualization/MapLayerControlPanel";
import MapElement from "./MapElement";
import RouteIcon from "../../../assets/logo/route-color-layer.png";

import IconButton from "@mui/material/IconButton";
import useFullscreen from "../../../hooks/useFullscreen";
import MapLegendEndpoints from "./LegendPanel";
import { LABELS, SIMULATION, VISUALIZATION } from "@/strings";
import { GSI_TILE_URLS } from "../../visualization/map/tileUrls";

// Component to apply grayscale filter directly to tile pane
function ApplyGrayscaleFilter({ enabled }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const applyFilter = () => {
      const tilePane = map.getPane("tilePane");
      if (!tilePane) return;

      if (enabled) {
        tilePane.style.filter = "grayscale(80%) brightness(1.0)";
        tilePane.style.webkitFilter = "grayscale(80%) brightness(1.0)";
        tilePane.style.opacity = "0.5";
      } else {
        tilePane.style.filter = "";
        tilePane.style.webkitFilter = "";
        tilePane.style.opacity = "1";
      }
    };

    if (map._loaded) {
      applyFilter();
    } else {
      map.whenReady(applyFilter);
    }

    return () => {
      const tilePane = map.getPane("tilePane");
      if (tilePane) {
        tilePane.style.filter = "";
        tilePane.style.webkitFilter = "";
        tilePane.style.opacity = "1";
      }
    };
  }, [map, enabled]);

  return null;
}

function FitToContent({ features = [], markers = [] }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const group = L.featureGroup();
    features.forEach((f) => f && group.addLayer(L.geoJSON(f)));
    markers.forEach((m) => m && group.addLayer(L.marker(m)));
    if (group.getLayers().length > 0) {
      const b = group.getBounds();
      if (b.isValid()) map.fitBounds(b, { padding: [24, 24] });
    }
  }, [map, features, markers]);
  return null;
}

function InvalidateOnFullscreen({ isFullscreen }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 60);
    return () => clearTimeout(t);
  }, [map, isFullscreen]);
  return null;
}

const TILE_SOURCES = {
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

export default function BusMap({
  busLayers = [],
  selectedKey,
  onSelectKey,
  height = 520,

  // 🔁 use *routeColors* here to match the shared panel
  additionalLayerItems = [
    { key: "routeColors", icon: RouteIcon, label: LABELS.common.routeColor },
  ],
  populationItems = [],
  initialLayerState,
  initialTileKey = "pale",
}) {
  const containerRef = useRef(null);
  const { isFullscreen, toggle } = useFullscreen();

  const [layerState, setLayerState] = useState(
    initialLayerState ?? {
      edges: true,
      routeLabels: false,
      stops: true,
      stopLabels: false,
      // 🔁 rename from routesColor → routeColors
      routeColors: false,
    }
  );

  const [selectedTile, setSelectedTile] = useState(initialTileKey);
  const [minimized, setMinimized] = useState(true);

  const onLayerToggle = (key) =>
    setLayerState((s) => {
      // mutual exclusion: edges (green) vs routeColors (keyword color)
      if (key === "edges") {
        const nextEdges = !s.edges;
        return {
          ...s,
          edges: nextEdges,
          // edges ON → routeColors OFF, edges OFF → routeColors ON
          routeColors: nextEdges ? false : true,
        };
      }

      if (key === "routeColors") {
        const nextRouteColors = !s.routeColors;
        return {
          ...s,
          routeColors: nextRouteColors,
          // routeColors ON → edges OFF, routeColors OFF → edges ON
          edges: nextRouteColors ? false : true,
        };
      }

      // other layers: normal toggle
      return { ...s, [key]: !s[key] };
    });

  const onTileSelect = (key) => setSelectedTile(key);

  const { url, attribution } =
    TILE_SOURCES[selectedTile] ?? TILE_SOURCES.pale;

  const features = useMemo(
    () => busLayers.map((l) => l.feature).filter(Boolean),
    [busLayers]
  );
  const markers = useMemo(() => {
    const out = [];
    busLayers.forEach((l) => {
      if (l?.start) out.push([l.start.lat, l.start.lon]);
      if (l?.end) out.push([l.end.lat, l.end.lon]);
    });
    return out;
  }, [busLayers]);

  return (
    <div
      ref={containerRef}
      style={{
        height: isFullscreen ? "100vh" : height,
        width: "100%",
        position: "relative",
        background: "#fff",
      }}
    >
      {/* fullscreen button */}
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 2500,
        }}
      >
        <IconButton
          size="large"
          onClick={() => toggle(containerRef.current)}
          sx={{
            bgcolor: "rgba(255,255,255,0.98)",
            border: "1px solid #ddd",
            "&:hover": { bgcolor: "rgba(250,250,250,0.98)" },
          }}
        >
          {isFullscreen ? (
            <span className="material-symbols-outlined outlined">
              fullscreen_exit
            </span>
          ) : (
            <span className="material-symbols-outlined outlined">
              fullscreen
            </span>
          )}
        </IconButton>
      </div>

      <MapContainer
        style={{ height: "100%", width: "100%" }}
        center={[35.68, 139.76]}
        zoom={12}
        scrollWheelZoom
      >
        <TileLayer url={url} attribution={attribution} />

        {/* grayscale only for pale */}
        <ApplyGrayscaleFilter enabled={selectedTile === "pale"} />

        {/* custom panes */}
        <Pane
          name="bus-map-labels-tooltip-pane"
          style={{ zIndex: 760 }}
        />
        <Pane
          name="bus-map-route-tooltip-pane"
          style={{ zIndex: 755 }}
        />

        {(layerState.edges || layerState.routeColors) &&
          busLayers.map((l) => (
            <MapElement
              key={l.key}
              data={l.feature}
              // 🔁 use routeColors flag here
              color={layerState.routeColors ? l.color : "#58AB39"}
              active={l.key === selectedKey}
              onClick={() => onSelectKey?.(l.key)}
              label={l?.route_id}
              start={l.start}
              end={l.end}
              showRouteLabels={layerState.routeLabels}
              routeLabelPane="bus-map-route-tooltip-pane"
              showStops={layerState.stops}
              showStopLabels={layerState.stopLabels}
            />
          ))}

        <InvalidateOnFullscreen isFullscreen={isFullscreen} />
        <FitToContent features={features} markers={markers} />
      </MapContainer>

      <MapLegendEndpoints
        startLabel={SIMULATION.carRouting.legend.start}
        endLabel={SIMULATION.carRouting.legend.end}
      />

      <LayerControlPanel
        additionalLayerItems={additionalLayerItems}
        populationItems={populationItems}
        layerState={layerState}
        onLayerToggle={onLayerToggle}
        selectedTile={selectedTile}
        onTileSelect={onTileSelect}
        minimized={minimized}
        setMinimized={setMinimized}
      />
    </div>
  );
}
