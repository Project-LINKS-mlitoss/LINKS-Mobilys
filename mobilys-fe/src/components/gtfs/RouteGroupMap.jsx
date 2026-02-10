import React, { useMemo, useRef, useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import {
  MapContainer,
  Polyline,
  CircleMarker,
  Marker,
  Popup,
  useMap,
  TileLayer,
  Pane,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import RouteLabelTooltip from "../visualization/RouteLabelTooltip";
import StopLabelTooltip from "../visualization/StopLabelTooltip";
import { BLANK_DIVICON } from "../visualization/buffer-analysis/BufferAnalysisMap";


/* ---------- Thumbnails (basemap) ---------- */
import PaleMap from "../../assets/photos/pale.png";
import StdMap from "../../assets/photos/std.png";
import BlankMap from "../../assets/photos/blank.png";
import PhotoMap from "../../assets/photos/photo.jpg";

/* ---------- Layer icons (panel) ---------- */
import RouteColorLayer from "../../assets/logo/route-color-layer.png";
import MapLayerControlPanel from "../visualization/bus-running-visualization/MapLayerControlPanel";

/* ---------- Helpers ---------- */
import { spreadLabelOffsets } from "../visualization/SpreadLabelOffset";
import { GTFS } from "../../strings/domains/gtfs";

/* ---------- Inline CSS: pale filter + popup styles + z-index ---------- */
function InjectRouteGroupMapCSS() {
  return (
    <style>{`
      /* Pale filter: grayscale + brightness + fade */
      .pale-filter img.leaflet-tile {
        filter: grayscale(80%) brightness(1.0);
        -webkit-filter: grayscale(80%) brightness(1.0);
        opacity: 0.5 !important;
      }
      .pale-filter .leaflet-tile {
        transition: none !important;
      }

      /* Make the default popup pane higher than markers/labels */
      .leaflet-pane.leaflet-popup-pane {
        z-index: 780 !important;
      }

      /* Unify popup look (for both click popups and our label "mini-popups") */
      .rgm-pop.leaflet-popup .leaflet-popup-content-wrapper {
        background: #fff;
        border-radius: 8px;
        border: 1px solid #E2E8F0;
        box-shadow: 0 8px 24px rgba(0,0,0,.18);
        padding: 6px 10px;
      }
      .rgm-pop.leaflet-popup .leaflet-popup-content {
        margin: 0;
        white-space: nowrap;
        font-weight: 700;
        font-size: 13px;
        line-height: 1.2;
      }
      .rgm-pop.leaflet-popup .leaflet-popup-tip {
        background: #fff;
        box-shadow: 0 -1px 0 0 #E2E8F0;
      }

      /* Our always-on label popups (divIcon) */
      .rgm-popbox {
        background: #fff;
        border-radius: 8px;
        border: 1px solid #E2E8F0;
        box-shadow: 0 8px 24px rgba(0,0,0,.18);
        padding: 6px 10px;
        display: inline-block;
        white-space: nowrap;
      }
      .rgm-popbox .rgm-popbox-content {
        font-weight: 700;
        font-size: 13px;
        line-height: 1.2;
      }
      .rgm-popbox .rgm-popbox-tip {
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-top: 8px solid #fff;
        margin: 2px auto 0;
        filter: drop-shadow(0 -1px 0 #E2E8F0);
      }

      /* Attribution spacing above safe area */
      .leaflet-control-container .leaflet-control-attribution {
        margin-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
      }
    `}</style>
  );
}

/* ---------- Apply initial center/zoom only once ---------- */
function ApplyInitialView({ center, zoom }) {
  const map = useMap();
  const didInit = useRef(false);
  useEffect(() => {
    if (!didInit.current) {
      map.setView(center, zoom);
      didInit.current = true;
    }
  }, [map, center, zoom]);
  return null;
}

/* ---------- Basemap definitions ---------- */
const MAP_BASE_ITEMS = [
  {
    key: "pale",
    label: GTFS.map.baseLayers.pale,
    thumb: PaleMap,
    url: "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png",
    attribution: GTFS.map.attribution.gsiHtml,
  },
  {
    key: "std",
    label: GTFS.map.baseLayers.std,
    thumb: StdMap,
    url: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
    attribution: GTFS.map.attribution.gsiHtml,
  },
  {
    key: "blank",
    label: GTFS.map.baseLayers.blank,
    thumb: BlankMap,
    url: "https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png",
    attribution: GTFS.map.attribution.gsiHtml,
  },
  {
    key: "photo",
    label: GTFS.map.baseLayers.photo,
    thumb: PhotoMap,
    url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
    attribution: GTFS.map.attribution.gsiHtml,
  },
];

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));
}

/* Colors requested */
const ROUTE_LABEL_GREEN = "#2E7D32";
const STOP_LABEL_BLACK = "#111111";

/* Create a "popup-like" divIcon for always-on labels */
function popupDivIcon(text, color, translate = [0, -10]) {
  const [tx, ty] = translate;
  const html = `
    <div class="rgm-popbox" style="transform: translate(${tx}px, ${ty}px);">
      <div class="rgm-popbox-content" style="color:${color};">${escapeHtml(text)}</div>
      <div class="rgm-popbox-tip"></div>
    </div>`;
  return L.divIcon({
    className: "",
    html,
    iconSize: [1, 1],
    iconAnchor: [0, 0],
  });
}

export default function RouteGroupMap({
  routeGroups,
  stopGroupsGeojson = null, // preferred
  stopsGroupGeojson = null, // alias
  checkedGroups = [],
  checkedRoutes = [],
}) {
  const [selectedTile, setSelectedTile] = useState("pale");

  const [layerState, setLayerState] = useState({
    edges: true, // route single-color
    routeLabels: false, // route labels
    stops: true, // stops
    stopLabels: false, // stop labels
    routeColors: false, // route colors
  });

  const [minimized, setMinimized] = useState(true);

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

  const baseCfg = useMemo(
    () => MAP_BASE_ITEMS.find((i) => i.key === selectedTile) ?? MAP_BASE_ITEMS[0],
    [selectedTile]
  );

  const svgRenderer = useMemo(() => L.svg({ padding: 0.5 }), []);

  /* ---------- Build polylines ---------- */
  const polylines = useMemo(() => {
    if (!layerState.edges && !layerState.routeColors) return [];

    let groups = [];
    if (Array.isArray(routeGroups)) {
      groups = routeGroups;
    } else if (
      routeGroups &&
      routeGroups.data &&
      Array.isArray(routeGroups.data.routes_grouped_by_keyword)
    ) {
      groups = routeGroups.data.routes_grouped_by_keyword;
    }

    const out = [];

    groups.forEach((group, groupIdx) => {
      if (!group) return;

      const rawGroupColor = group.keyword_color;
      const groupBaseColor =
        typeof rawGroupColor === "string" && rawGroupColor.length > 0
          ? (rawGroupColor.startsWith("#") ? rawGroupColor : `#${rawGroupColor}`)
          : "#2196F3";

      const baseColor = layerState.routeColors ? groupBaseColor : ROUTE_LABEL_GREEN;

      const groupId = group.keyword_id ?? group.keyword;
      const groupChecked = checkedGroups.includes(groupId);

      const groupLabel =
        (typeof group.keyword === "string" && group.keyword.trim()) || "Route";

      const routes = Array.isArray(group.routes) ? group.routes : [];

      routes.forEach((route, routeIdx) => {
        const routeChecked = groupChecked || checkedRoutes.includes(route?.route_id);

        const shapes = Array.isArray(route?.geojson_data) ? route.geojson_data : [];

        shapes.forEach((shape, shapeIdx) => {
          const coords = Array.isArray(shape?.coordinates) ? shape.coordinates : [];
          if (!coords.length) return;

          const latlngs = coords.map(([lon, lat]) => [lat, lon]);
          if (!latlngs.length) return;

          out.push({
            latlngs,
            color: routeChecked ? "#FFD600" : baseColor,
            weight: routeChecked ? 8 : 4,
            opacity: routeChecked ? 0.95 : 0.55,
            label: groupLabel,
            key: `g${groupId ?? groupIdx}-r${route?.route_id ?? routeIdx}-s${shapeIdx}`,
          });
        });
      });
    });

    return out;
  }, [
    routeGroups,
    checkedGroups,
    checkedRoutes,
    layerState.edges,
    layerState.routeColors,
  ]);

  /* ---------- Build stop points ---------- */
  const stopPoints = useMemo(() => {
    const fc = stopGroupsGeojson ?? stopsGroupGeojson;
    const pts = [];
    if (!fc || fc.type !== "FeatureCollection" || !Array.isArray(fc.features)) return pts;

    for (const f of fc.features) {
      const g = f?.geometry;
      const props = f?.properties ?? {};
      const keyword = props.keyword ?? props.name ?? "";
      const groupId = props.group_id ?? props.id ?? "";
      if (!g) continue;

      if (g.type === "Point" && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
        const [lon, lat] = g.coordinates;
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          pts.push({ lat, lon, keyword, key: `${groupId || `${lat},${lon}`}` });
        }
      } else if (g.type === "MultiPoint" && Array.isArray(g.coordinates)) {
        for (const c of g.coordinates) {
          if (!Array.isArray(c) || c.length < 2) continue;
          const [lon, lat] = c;
          if (Number.isFinite(lat) && Number.isFinite(lon)) {
            pts.push({ lat, lon, keyword, key: `${groupId || `${lat},${lon}`}:mp` });
          }
        }
      }
    }

    return pts;
  }, [stopGroupsGeojson, stopsGroupGeojson]);


  const stopLabelMarkers = useMemo(() => {
    if (!layerState.stopLabels || !stopPoints.length) return null;

    return stopPoints.map((p, i) => (
      <Marker
        key={`stop-label-${p.key ?? i}`}
        position={[p.lat, p.lon]}
        pane="stop-labels"
        icon={BLANK_DIVICON}
        interactive={false}
      >
        <StopLabelTooltip
          pane="stop-labels"
          stopName={p.keyword || ""}
          direction="top"
          offset={[0, -10]}
        />
      </Marker>
    ));
  }, [layerState.stopLabels, stopPoints]);


  /* ---------- Initial center ---------- */
  const initialCenter = useMemo(() => {
    if (polylines.length) return polylines[0].latlngs[0];
    if (stopPoints.length) return [stopPoints[0].lat, stopPoints[0].lon];
    return [36.75, 137.13];
  }, [polylines, stopPoints]);

  /** -----------------------------
   * Unique Route Labels
   * ----------------------------- */
  const uniqueRouteLabels = useMemo(() => {
    if (!polylines.length) return [];

    const seen = new Set();
    const res = [];

    for (const poly of polylines) {
      const label = poly.label;
      if (!label || seen.has(label)) continue;

      seen.add(label);
      const mid = poly.latlngs[Math.floor(poly.latlngs.length / 2)];

      res.push({
        label,
        coordinates: mid, // [lat, lng]
        color: poly.color || ROUTE_LABEL_GREEN,
      });
    }

    return res;
  }, [polylines]);

  const routeLabelsWithOffsets = useMemo(() => {
    return spreadLabelOffsets(uniqueRouteLabels, {
      precision: 6,
      baseRadiusPx: 10,
      stepPx: 6,
      perRing: 8,
      sortKey: (x) => x.label,
    });
  }, [uniqueRouteLabels]);

  const routeLabelMarkers = useMemo(() => {
    if (!layerState.routeLabels) return null;

    return routeLabelsWithOffsets.map((item, index) => (
      <Marker
        key={`route-label-${index}`}
        position={item.coordinates}
        pane="route-labels"
        icon={BLANK_DIVICON}
        interactive={false}
      >
        <RouteLabelTooltip
          pane="route-labels"
          label={item.label}
          color={item.color || ROUTE_LABEL_GREEN}
          direction="center"
          offset={item._offset ?? [0, 0]}
        />
      </Marker>
    ));
  }, [layerState.routeLabels, routeLabelsWithOffsets]);


  return (
    <Box sx={{ position: "relative", width: "100%", height: "100%" }}>
      <InjectRouteGroupMapCSS />

      <MapContainer
        center={initialCenter}
        zoom={12}
        zoomAnimation={false}
        fadeAnimation={false}
        style={{ height: "100%", width: "100%" }}
      >
        <ApplyInitialView center={initialCenter} zoom={12} />

        {/* Base layer */}
        <Pane name="base" style={{ zIndex: 200 }}>
          <TileLayer
            key={selectedTile}
            url={baseCfg.url}
            attribution={baseCfg.attribution}
            pane="base"
            crossOrigin
            className={selectedTile === "pale" ? "pale-filter" : undefined}
          />
        </Pane>

        {/* Stack order: routes < stops < stop-labels < route-labels < popupPane */}
        <Pane name="routes" style={{ zIndex: 730 }} />
        <Pane name="stops" style={{ zIndex: 740 }} />
        <Pane name="stop-labels" style={{ zIndex: 765 }} />
        <Pane name="route-labels" style={{ zIndex: 770 }} />

        {/* Stops */}
        {layerState.stops &&
          stopPoints.map((p, i) => (
            <CircleMarker
              key={p.key ?? i}
              center={[p.lat, p.lon]}
              pane="stops"
              radius={6}
              pathOptions={{
                color: "#FFFFFF",
                weight: 3,
                opacity: 1,
                fillColor: "#263445",
                fillOpacity: 1,
              }}
            >
              <Popup className="rgm-pop">
                <div style={{ fontWeight: 700, fontSize: 13 }}>
                  {p.keyword || "No keyword"}
                </div>
              </Popup>
            </CircleMarker>
          ))}


        {/* Routes */}
        {polylines.map((poly) => (
          <Polyline
            key={poly.key}
            positions={poly.latlngs}
            pane="routes"
            renderer={svgRenderer}
            pathOptions={{
              color: poly.color,
              weight: poly.weight,
              opacity: poly.opacity,
            }}
            eventHandlers={{
              click: (e) => {
                L.popup({ autoPan: true, className: "rgm-pop" })
                  .setLatLng(e.latlng)
                  .setContent(
                    `<div style="font-weight:700;font-size:13px;color:${ROUTE_LABEL_GREEN};">${escapeHtml(
                      poly.label
                    )}</div>`
                  )
                  .openOn(e.target._map);
              },
              mouseover: (e) =>
                e.target.setStyle({ weight: poly.weight + 2, opacity: 1 }),
              mouseout: (e) =>
                e.target.setStyle({ weight: poly.weight, opacity: poly.opacity }),
            }}
          />
        ))}

        {layerState.routeLabels && routeLabelMarkers}
        {layerState.stopLabels && stopLabelMarkers}
      </MapContainer>

      <MapLayerControlPanel
        additionalLayerItems={[
          { key: "routeColors", icon: RouteColorLayer, label: GTFS.map.layers.routeColors },
        ]}
        layerState={layerState}
        onLayerToggle={handleLayerToggle}
        selectedTile={selectedTile}
        onTileSelect={setSelectedTile}
        minimized={minimized}
        setMinimized={setMinimized}
      />
    </Box>
  );
}
