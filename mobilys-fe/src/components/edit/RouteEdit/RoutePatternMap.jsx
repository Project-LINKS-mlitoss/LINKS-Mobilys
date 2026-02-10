import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
} from "@mui/material";
import { MapContainer, TileLayer, Polyline, useMap, CircleMarker, Popup, Marker, Pane } from "react-leaflet";
import CloseIcon from "@mui/icons-material/Close";
import "leaflet/dist/leaflet.css";
import { useEffect, useState, useMemo } from "react";
import L from "leaflet";
import BlankMap from "../../../assets/photos/blank.png";
import PaleMap from "../../../assets/photos/pale.png";
import PhotoMap from "../../../assets/photos/photo.jpg";
import StdMap from "../../../assets/photos/std.png";
import MapLayerControlPanel from "../../visualization/bus-running-visualization/MapLayerControlPanel";
import RouteColorLayer from "../../../assets/logo/route-color-layer.png";
import RouteLabelTooltip from "../../visualization/RouteLabelTooltip";
import StopLabelTooltip from "../../visualization/StopLabelTooltip";
import { BLANK_DIVICON, lineLabelLatLng, toColor } from "../../visualization/buffer-analysis/BufferAnalysisMap";
import { LABELS } from "../../../strings";
import { MESSAGES } from "../../../constant";

// Map tile options
const mapBaseItems = [
  {
    key: "pale",
    thumb: PaleMap,
    label: LABELS.map.paleMap,
    url: "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png",
    attribution:
      '© <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>',
  },
  {
    key: "std",
    thumb: StdMap,
    label: LABELS.map.stdMap,
    url: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
    attribution:
      '© <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>',
  },
  {
    key: "blank",
    thumb: BlankMap,
    label: LABELS.map.blankMap,
    url: "https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png",
    attribution:
      '© <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>',
  },
  {
    key: "photo",
    thumb: PhotoMap,
    label: LABELS.map.photoMap,
    url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
    attribution:
      '© <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>',
  },
];

// Helper component to fit map bounds
const FitBounds = ({ shape }) => {
  const map = useMap();

  useEffect(() => {
    if (shape?.length > 0) {
      map.fitBounds(shape);
    }
  }, [shape, map]);

  return null;
};

// Apply grayscale filter for pale tile
const ApplyGrayscaleFilter = ({ enabled }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const container = map.getContainer();
    const tilePane = container.querySelector('.leaflet-tile-pane');

    if (tilePane) {
      if (enabled) {
        tilePane.style.opacity = '0.5';
        tilePane.style.filter = 'grayscale(80%) brightness(1.0)';
        tilePane.style.webkitFilter = 'grayscale(80%) brightness(1.0)';
      } else {
        tilePane.style.opacity = '';
        tilePane.style.filter = '';
        tilePane.style.webkitFilter = '';
      }
    }

    return () => {
      if (tilePane) {
        tilePane.style.opacity = '';
        tilePane.style.filter = '';
        tilePane.style.webkitFilter = '';
      }
    };
  }, [map, enabled]);

  return null;
};

// Import ReactDOM for portal
import ReactDOM from "react-dom";

// Label/popup styles (align with RouteGroupMap)
const ROUTE_LABEL_GREEN = "green";

function InjectPopupCSS() {
  return (
    <style>{`
      .pale-filter img.leaflet-tile { filter: grayscale(80%) brightness(1.0); -webkit-filter: grayscale(80%) brightness(1.0); opacity: 0.5 !important; }
      .leaflet-pane.leaflet-popup-pane { z-index: 780 !important; }
      .rgm-pop.leaflet-popup .leaflet-popup-content-wrapper { background: #fff; border-radius: 8px; border: 1px solid #E2E8F0; box-shadow: 0 8px 24px rgba(0,0,0,.18); padding: 6px 10px; }
      .rgm-pop.leaflet-popup .leaflet-popup-content { margin: 0; white-space: nowrap; font-weight: 700; font-size: 13px; line-height: 1.2; }
      .rgm-pop.leaflet-popup .leaflet-popup-tip { background: #fff; box-shadow: 0 -1px 0 0 #E2E8F0; }
      .rgm-popbox { background: #fff; border-radius: 8px; border: 1px solid #E2E8F0; box-shadow: 0 8px 24px rgba(0,0,0,.18); padding: 6px 10px; display: inline-block; white-space: nowrap; }
      .rgm-popbox .rgm-popbox-content { font-weight: 700; font-size: 13px; line-height: 1.2; }
      .rgm-popbox .rgm-popbox-tip { width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 8px solid #fff; margin: 2px auto 0; filter: drop-shadow(0 -1px 0 #E2E8F0); }
    `}</style>
  );
}

function shapesRoughEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  const tol = 1e-6;
  const eqPt = (p, q) =>
    Array.isArray(p) && Array.isArray(q) && p.length >= 2 && q.length >= 2 &&
    Math.abs(p[0] - q[0]) <= tol && Math.abs(p[1] - q[1]) <= tol;
  if (!eqPt(a[0], b[0]) || !eqPt(a[a.length - 1], b[b.length - 1])) return false;
  const c1 = Math.floor(a.length / 3);
  const c2 = Math.floor((2 * a.length) / 3);
  for (const i of [c1, c2]) {
    if (i > 0 && i < a.length - 1 && !eqPt(a[i], b[i])) return false;
  }
  return true;
}

const RoutePatternMap = ({ open, onClose, shape, routeData, routeColor }) => {

  const [selectedTile, setSelectedTile] = useState("pale");

  const normalizedRouteColor = useMemo(() => {
    if (!routeColor) return null;
    const raw = String(routeColor).trim();
    if (!raw) return null;
    return raw.startsWith("#") ? raw : `#${raw}`;
  }, [routeColor]);


  const [layerState, setLayerState] = useState({
    edges: true,        // 路線単色
    routeLabels: false, // 路線ラベル
    stops: true,        // 標柱/停留所
    stopLabels: false,  // 停留所ラベル
    routeColors: false, // 路線カラー
  });
  const [minimized, setMinimized] = useState(true);

  const effectiveRouteLabelColor = useMemo(() => {
    // Prioritize colored routes layer
    if (layerState.routeColors && normalizedRouteColor) {
      return normalizedRouteColor;
    }

    // Fall back to default green when plain route layer is on
    if (layerState.edges) {
      return ROUTE_LABEL_GREEN;
    }

    // Final fallback
    return ROUTE_LABEL_GREEN;
  }, [layerState.routeColors, layerState.edges, normalizedRouteColor]);

  const handleLayerToggle = (key) =>
    setLayerState((s) => {
      // edges (単色) vs routeColors (カラー) are mutually exclusive
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


  const currentTile = mapBaseItems.find((item) => item.key === selectedTile) ?? mapBaseItems[0];

  // Route name to show on polyline click / label
  const routeName = useMemo(() => {
    const ln = typeof routeData?.route_long_name === 'string' ? routeData.route_long_name.trim() : '';
    const sn = typeof routeData?.route_short_name === 'string' ? routeData.route_short_name.trim() : '';
    return ln || sn || '';
  }, [routeData]);

  // Derive stop sequence from routeData matching the provided shape
  const stopSequence = useMemo(() => {
    const patterns = routeData?.route_patterns || [];
    if (!patterns.length) return [];
    if (Array.isArray(shape) && shape.length > 0) {
      const matched = patterns.find((p) => Array.isArray(p?.shape) && shapesRoughEqual(p.shape, shape));
      if (matched?.stop_sequence?.length) return matched.stop_sequence;
    }
    const firstWithStops = patterns.find((p) => Array.isArray(p?.stop_sequence) && p.stop_sequence.length);
    return firstWithStops?.stop_sequence || [];
  }, [routeData, shape]);

  const showRouteLine = !!shape && (layerState.edges || layerState.routeColors);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {MESSAGES.route.patternMapTitle}
        <IconButton
          onClick={onClose}
          sx={{ position: "absolute", right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <InjectPopupCSS />
        <Box sx={{ position: 'relative', width: '100%', height: 400 }}>
          <MapContainer
            center={shape?.[0] || [35.0, 135.0]}
            zoom={11}
            style={{ height: '100%', width: "100%" }}
            scrollWheelZoom={true}
          >
            <Pane name="base" style={{ zIndex: 200 }}>
              <TileLayer
                key={selectedTile}
                url={currentTile.url}
                attribution={currentTile.attribution}
                crossOrigin="anonymous"
                className={selectedTile === 'pale' ? 'pale-filter' : undefined}
              />
            </Pane>
            <Pane name="routes" style={{ zIndex: 730 }} />
            <Pane name="stops" style={{ zIndex: 740 }} />
            <Pane name="stop-labels" style={{ zIndex: 765 }} />
            <Pane name="route-labels" style={{ zIndex: 770 }} />
            <ApplyGrayscaleFilter enabled={selectedTile === 'pale'} />

            {showRouteLine && (
              <>
                <Polyline
                  positions={shape}
                  pane="routes"
                  pathOptions={{
                    color:
                      layerState.routeColors && normalizedRouteColor
                        ? normalizedRouteColor
                        : ROUTE_LABEL_GREEN,
                  }}
                >
                  {routeName && (
                    <Popup className="rgm-pop">
                      <Typography fontSize={12} sx={{ color: effectiveRouteLabelColor }}>
                        {routeName}
                      </Typography>
                    </Popup>
                  )}
                </Polyline>
                <FitBounds shape={shape} />
              </>
            )}

            {Array.isArray(stopSequence) && stopSequence.length > 0 && layerState.stops && (
              stopSequence
                .filter((s) => Array.isArray(s?.latlng) && s.latlng.length >= 2 && s.latlng[0] != null && s.latlng[1] != null)
                .map((s, idx) => (
                  <CircleMarker
                    key={s.stop_id || idx}
                    center={[s.latlng[0], s.latlng[1]]}
                    pane="stops"
                    radius={6}
                    pathOptions={{ color: '#FFFFFF', weight: 3, opacity: 1, fillColor: '#000000', fillOpacity: 1 }}
                  >
                    <Popup className="rgm-pop">
                      <div style={{ fontWeight: 700, fontSize: 13 }}>
                        {s.stop_name || ''}
                      </div>
                    </Popup>
                  </CircleMarker>
                ))
            )}

            {layerState.stopLabels && Array.isArray(stopSequence) && stopSequence.length > 0 && (
              stopSequence
                .filter((s) => Array.isArray(s?.latlng) && s.latlng.length >= 2 && s.latlng[0] != null && s.latlng[1] != null)
                .map((s, idx) => (
                  <Marker
                    key={`stop-label-${s.stop_id || idx}`}
                    position={[s.latlng[0], s.latlng[1]]}
                    pane="stop-labels"
                    icon={BLANK_DIVICON}
                    interactive={false}
                  >
                    <StopLabelTooltip
                      pane="stop-labels"
                      stopName={s.stop_name || ""}
                      direction="top"
                      offset={[0, -10]}
                    />
                  </Marker>
                ))
            )}


            {layerState.routeLabels && routeName && shape?.length > 0 && (
              <Marker
                key="route-label"
                position={shape[Math.floor(shape.length / 2)]}
                pane="route-labels"
                icon={BLANK_DIVICON}
                interactive={false}
              >
                <RouteLabelTooltip
                  pane="route-labels"
                  label={routeName}
                  color={effectiveRouteLabelColor}
                  direction="center"
                  offset={[0, 0]}

                />

              </Marker>

            )}
          </MapContainer>

          <MapLayerControlPanel
            additionalLayerItems={[
              { key: "routeColors", icon: RouteColorLayer, label: LABELS.route.routeColor },
            ]}
            layerState={layerState}
            onLayerToggle={handleLayerToggle}
            selectedTile={selectedTile}
            onTileSelect={setSelectedTile}
            minimized={minimized}
            setMinimized={setMinimized}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default RoutePatternMap;
