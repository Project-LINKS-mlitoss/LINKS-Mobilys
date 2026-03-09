// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
// StopGroupMap.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  Tooltip,
  TileLayer,
  Pane,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { Box, IconButton, Typography } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { GTFS } from "../../strings/domains/gtfs";

// Leaflet default marker assets
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
// Center (red) marker
import redMarkerIcon from "../../assets/logo/marker-icon-red.png";

// Basemap thumbs
import PaleMap from "../../assets/photos/pale.png";
import StdMap from "../../assets/photos/std.png";
import BlankMap from "../../assets/photos/blank.png";
import PhotoMap from "../../assets/photos/photo.jpg";

/* ------------------------------ Error Boundary ------------------------------ */
class MapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, msg: "" };
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, msg: err?.message || "Map failed to render." };
  }
  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            height: "100%",
            minHeight: 240,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "text.secondary",
            fontSize: 14,
            textAlign: "center",
            p: 2,
          }}
        >
          {GTFS.map.errors.renderFailed}
          <Typography variant="caption" sx={{ mt: 1, display: "block" }}>
            {this.state.msg}
          </Typography>
        </Box>
      );
    }
    return this.props.children;
  }
}

/* ------------------------------ Basemap catalog ------------------------------ */
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

/* ------------------------------ Leaflet icons ------------------------------ */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});
const redIcon = new L.Icon({
  iconUrl: redMarkerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

/* ------------------------------ Helpers (defensive) ------------------------------ */
const toNum = (v) => {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

const isValidLatLng = (lat, lon) =>
  Number.isFinite(lat) &&
  Number.isFinite(lon) &&
  lat >= -90 &&
  lat <= 90 &&
  lon >= -180 &&
  lon <= 180;

const safeLatLngTuple = (lat, lon) => {
  try {
    const ll = L.latLng(lat, lon);
    if (Number.isFinite(ll.lat) && Number.isFinite(ll.lng)) {
      return [ll.lat, ll.lng];
    }
    return null;
  } catch {
    return null;
  }
};

const filterValidPositions = (stops) =>
  (stops ?? [])
    .map((s) => {
      const lat = toNum(s?.stop_lat);
      const lon = toNum(s?.stop_lon);
      return isValidLatLng(lat, lon) ? { lat, lon, stop_id: s?.stop_id } : null;
    })
    .filter(Boolean);

/* ------------------------------ Map utilities ------------------------------ */
const FitBounds = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (!map || !bounds) return;
    try {
      if (bounds.isValid?.() && bounds.isValid()) {
        map.invalidateSize();
        setTimeout(() => {
          map.invalidateSize();
          map.fitBounds(bounds, { padding: [30, 30] });
        }, 0);
      }
    } catch {
      // no-op
    }
  }, [bounds, map]);
  return null;
};

function ApplyGrayscaleFilter({ enabled }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const applyToTiles = () => {
      const container = map.getContainer?.();
      if (!container) return;
      const tiles = container.querySelectorAll("img.leaflet-tile");
      tiles.forEach((tile) => {
        if (enabled) {
          tile.style.opacity = "0.5";
          tile.style.filter = "grayscale(80%) brightness(1.0)";
          tile.style.webkitFilter = "grayscale(80%) brightness(1.0)";
        } else {
          tile.style.opacity = "";
          tile.style.filter = "";
          tile.style.webkitFilter = "";
        }
      });
    };
    applyToTiles();
    const container = map.getContainer?.();
    if (!container) return;
    const observer = new MutationObserver(applyToTiles);
    observer.observe(container, { childList: true, subtree: true });
    const onTileEvent = () => applyToTiles();
    map.on("tileload", onTileEvent);
    map.on("tileloadstart", onTileEvent);
    return () => {
      observer.disconnect();
      map.off("tileload", onTileEvent);
      map.off("tileloadstart", onTileEvent);
      const tiles = container.querySelectorAll("img.leaflet-tile");
      tiles.forEach((tile) => {
        tile.style.opacity = "";
        tile.style.filter = "";
        tile.style.webkitFilter = "";
      });
    };
  }, [map, enabled]);
  return null;
}

const InvalidateSize = () => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    setTimeout(() => map.invalidateSize({ animate: false }), 0);
    setTimeout(() => map.invalidateSize({ animate: false }), 150);
  }, [map]);
  return null;
};

/* ------------------------------ Fallback UI ------------------------------ */
function EmptyState({ message = GTFS.map.empty.noCoordinates }) {
  return (
    <Box
      sx={{
        height: "100%",
        minHeight: 240,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "text.secondary",
        fontSize: 14,
      }}
    >
      {message}
    </Box>
  );
}

/* ------------------------------ Component ------------------------------ */
export default function StopGroupMap({ group }) {
  if (!group?.stops) {
    return <EmptyState message={GTFS.map.empty.noData} />;
  }

  const [selectedTile, setSelectedTile] = useState("pale");
  const [panelOpen, setPanelOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);

  // Basemap config
  const baseCfg = useMemo(
    () => MAP_BASE_ITEMS.find((i) => i.key === selectedTile) ?? MAP_BASE_ITEMS[0],
    [selectedTile]
  );

  // Valid stops
  const stopPositions = useMemo(
    () => filterValidPositions(group.stops),
    [group.stops]
  );

  // Center (prefer group-level coords, else first valid stop)
  const cLat = toNum(group.stop_names_lat ?? group.stop_id_lat);
  const cLon = toNum(group.stop_names_lon ?? group.stop_id_lon);
  const center =
    safeLatLngTuple(cLat, cLon) ||
    (stopPositions.length
      ? safeLatLngTuple(stopPositions[0].lat, stopPositions[0].lon)
      : null);

  if (!center) {
    return <EmptyState />;
  }

  // Bounds
  const bounds = useMemo(() => {
    const pts = [
      center,
      ...stopPositions.map((p) => [p.lat, p.lon]).filter((xy) => isValidLatLng(xy[0], xy[1])),
    ];
    if (!pts.length) return null;
    try {
      return L.latLngBounds(pts);
    } catch {
      return null;
    }
  }, [center, stopPositions]);

  /* ----- UI constants: nudge buttons & panels up to avoid overlapping attribution ----- */
  const BUTTON_SIZE = 56;          // diameter of the round buttons
  const ATTRIB_SAFE_OFFSET = 25;   // gap above the bottom attribution line
  const BUTTONS_BOTTOM = ATTRIB_SAFE_OFFSET;
  const PANEL_BOTTOM = ATTRIB_SAFE_OFFSET + BUTTON_SIZE + 16; // panel sits above the buttons

  /* ----- Picker sizing ----- */
  const COLUMNS = 4;
  const CARD_W = 72;
  const IMG = 52;
  const GAP = 16;
  const PANEL_PAD = 16;
  const PANEL_W = COLUMNS * CARD_W + (COLUMNS - 1) * GAP + 2 * PANEL_PAD;

  return (
    <MapErrorBoundary>
      <div style={{ position: "relative", height: "100%" }}>
        <MapContainer
          key={(group.stop_name_group || group.stop_id_group || "group") + "-map"}
          style={{ height: "100%", width: "100%" }}
          center={center}
          zoom={14}
          scrollWheelZoom
          preferCanvas
          /* Keep default attribution so Leaflet + GSI remain visible */
        >
          <Pane name="base" style={{ zIndex: 200 }}>
            <TileLayer
              key={selectedTile}
              url={baseCfg.url}
              attribution={baseCfg.attribution}
              pane="base"
              crossOrigin
            />
          </Pane>

          <InvalidateSize />
          <ApplyGrayscaleFilter enabled={selectedTile === "pale"} />
          {bounds && <FitBounds bounds={bounds} />}

                {stopPositions.map((pos, i) => (
                <Marker
                    key={`stop-${i}`}
                    position={[pos.lat, pos.lon]}
                    icon={L.divIcon({
                    className: "",
                    html: `
                        <span class="material-symbols-outlined filled"
                        style="
                            color:#1976D2;      /* MUI blue */
                            font-size:35px;
                            line-height:1;
                            display:inline-block;
                        "
                        >
                        location_on
                        </span>
                    `,
                    iconAnchor: [14, 28],
                    })}
                >
                    <Tooltip>{pos.stop_id}</Tooltip>
                </Marker>
                ))}

                {center && (
                <Marker
                    position={center}
                    icon={L.divIcon({
                    className: "",
                    html: `
                        <span class="material-symbols-outlined filled"
                        style="
                            color:#e53935;      /* Red for center */
                            font-size:35px;
                            line-height:1;
                            display:inline-block;
                        "
                        >
                        location_on
                        </span>
                    `,
                    iconAnchor: [14, 28],
                    })}
                >
                    <Tooltip>
                    ${group.stop_name_group || group.stop_id_group || "Center"}
                    </Tooltip>
                </Marker>
                )}

            </MapContainer>

        {/* Bottom-right floating buttons (shifted up a bit) */}
        <Box
          sx={{
            position: "absolute",
            right: 12,
            bottom: BUTTONS_BOTTOM, // moved up so it won't overlap attribution
            zIndex: 4000,
            pointerEvents: "none",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 1,
          }}
        >
          <IconButton
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setLegendOpen((v) => !v);
              setPanelOpen(false);
            }}
            size="small"
            sx={{
              pointerEvents: "auto",
              width: BUTTON_SIZE,
              height: BUTTON_SIZE,
              bgcolor: "#fff",
              borderRadius: "20px",
              boxShadow: "0 8px 24px rgba(0,0,0,.22)",
              "&:hover": { bgcolor: "#fff" },
            }}
            aria-label={GTFS.map.panel.legend}
          >
            <span class="material-symbols-outlined outlined">
            info
            </span>
          </IconButton>

          <IconButton
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setPanelOpen((v) => !v);
              setLegendOpen(false);
            }}
            size="small"
            sx={{
              pointerEvents: "auto",
              width: BUTTON_SIZE,
              height: BUTTON_SIZE,
              bgcolor: "#fff",
              borderRadius: "20px",
              boxShadow: "0 8px 24px rgba(0,0,0,.22)",
              "&:hover": { bgcolor: "#fff" },
            }}
            aria-label={GTFS.map.panel.layers}
          >
            <span class="material-symbols-outlined outlined">
            layers
            </span>
          </IconButton>
        </Box>

        {/* Legend panel (anchored above the shifted buttons) */}
        {legendOpen && (
          <Box
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            sx={{
              position: "absolute",
              right: 12,
              bottom: PANEL_BOTTOM, // higher so it doesn't collide with attribution
              zIndex: 5000,
              width: 260,
              borderRadius: 3,
              boxShadow: "0 18px 36px rgba(0,0,0,.22)",
              bgcolor: "rgba(255,255,255,.96)",
              backdropFilter: "blur(6px)",
              p: 2,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Typography sx={{ fontSize: 20, fontWeight: 900, flex: 1 }}>
                {GTFS.map.panel.legend}
              </Typography>
              <IconButton
                size="small"
                onClick={() => setLegendOpen(false)}
                aria-label={GTFS.common.actions.close}
              >
                <CloseRoundedIcon />
              </IconButton>
            </Box>

                    <Box sx={{ display: "grid", rowGap: 1.25 }}>
                        {/* Red = stop */}
                        <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1.25,
                        }}
                        >
                        <span
                            className="material-symbols-outlined filled"
                            style={{
                            color: "#e53935", 
                            fontSize: 28,  
                            lineHeight: 1,
                            }}
                        >
                            location_on
                        </span>
                        <Typography sx={{ fontSize: 14 }}>{GTFS.map.legendItems.stop}</Typography>
                        </Box>
                        {/* Blue = pole */}
                        <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1.25,
                        }}
                        >
                        <span
                            className="material-symbols-outlined filled"
                            style={{
                            color: "#1976D2",
                            fontSize: 28,
                            lineHeight: 1,
                            }}
                        >
                            location_on
                        </span>
                        <Typography sx={{ fontSize: 14 }}>{GTFS.map.legendItems.pole}</Typography>
                        </Box>
                    </Box>
                </Box>
            )}

        {/* Basemap picker panel (also anchored above the shifted buttons) */}
        {panelOpen && (
          <Box
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            sx={{
              position: "absolute",
              right: 12,
              bottom: PANEL_BOTTOM, // keep consistent with legend panel
              zIndex: 5000,
              width: `min(${PANEL_W}px, calc(100vw - 32px))`,
              borderRadius: 3,
              boxShadow: "0 18px 36px rgba(0,0,0,.22)",
              bgcolor: "rgba(255,255,255,.96)",
              backdropFilter: "blur(6px)",
              p: `${PANEL_PAD}px`,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Typography sx={{ fontSize: 20, fontWeight: 900, flex: 1 }}>
                {GTFS.map.panel.map}
              </Typography>
              <IconButton
                size="small"
                onClick={() => setPanelOpen(false)}
                aria-label={GTFS.common.actions.close}
              >
                <CloseRoundedIcon />
              </IconButton>
            </Box>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: `repeat(${COLUMNS}, ${CARD_W}px)`,
                gap: `${GAP}px`,
              }}
            >
              {MAP_BASE_ITEMS.map((item) => {
                const selected = item.key === selectedTile;
                return (
                  <Box
                    key={item.key}
                    role="button"
                    tabIndex={0}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTile(item.key);
                      setPanelOpen(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        setSelectedTile(item.key);
                        setPanelOpen(false);
                      }
                    }}
                    sx={{
                      width: CARD_W,
                      borderRadius: 3,
                      border: selected ? "3px solid #111" : "2px solid #E3E6EA",
                      background: "#fff",
                      boxShadow: selected
                        ? "0 8px 20px rgba(0,0,0,.18)"
                        : "0 2px 8px rgba(0,0,0,.06)",
                      cursor: "pointer",
                      transition: "transform .08s, box-shadow .18s, border .15s",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      py: "10px",
                      "&:hover": {
                        transform: "translateY(-1px)",
                        boxShadow: "0 10px 22px rgba(0,0,0,.15)",
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: IMG,
                        height: IMG,
                        borderRadius: 2,
                        overflow: "hidden",
                        mb: 1,
                        border: "1px solid #e9edf2",
                      }}
                    >
                      <img
                        src={item.thumb}
                        alt={item.label}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                          filter: selected ? "none" : "grayscale(100%)",
                          opacity: selected ? 1 : 0.6,
                        }}
                      />
                    </Box>

                    <Typography
                      sx={{
                        fontSize: 14,
                        fontWeight: 800,
                        letterSpacing: 0.2,
                        color: selected ? "#111" : "#B0B6BF",
                        lineHeight: 1.1,
                        userSelect: "none",
                        textAlign: "center",
                      }}
                    >
                      {item.label}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
      </div>
    </MapErrorBoundary>
  );
}
