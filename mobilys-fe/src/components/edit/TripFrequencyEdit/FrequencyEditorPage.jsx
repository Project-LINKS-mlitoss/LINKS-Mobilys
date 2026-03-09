// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
// src/components/edit/TripFrequencyEdit/FrequencyEditorPage.jsx
import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  Box,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  Button,
  Backdrop,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TableContainer,
  Tooltip,
} from "@mui/material";
import { LABELS, BUTTONS } from "../../../strings";
import { MESSAGES } from "../../../constant";
import {
  ExpandMore,
  ExpandLess,
  ZoomInMap as ZoomInMapIcon,
} from "@mui/icons-material";
import {
  getDetailTripFrequency,
  getDetailMapFrequency,
} from "../../../services/tripService";
import { MapContainer, TileLayer, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import RoutePatternMap from "../RouteEdit/RoutePatternMap";
import { EllipsizedCell } from "../../gtfs/ImportDetailRouteGroupTab";
import { formatSectionLabel } from "../../../utils/text";

const directionMap = { 0: LABELS.trip.inbound, 1: LABELS.trip.outbound };

// ---------- Helpers ----------
const toNum = (v, fallback = 0) => {
  if (v === "" || v === null || v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const calcFinal = (base, mult, delta) =>
  Math.max(0, Math.round(toNum(base) * toNum(mult, 1) + toNum(delta)));

// Check whether the multiplier value is a valid input (not a partial entry)
// Partial input: "", "0", "0.", "." -> still incomplete, do not trigger the calculation
const isValidMultInput = (value) => {
  if (value === undefined || value === "") return false;
  if (value === "0" || value === "0." || value === ".") return false;
  const num = Number(value);
  return !isNaN(num) && num > 0;
};

// Calculate the minimum multiplier so the total does not become zero
// - If base >= 2: minimum target is 2
// - If base = 1: minimum target is 1 (cannot be reduced)
const calcMinMult = (base, delta) => {
  if (base <= 0) return 0;

  // Minimum target: 2 when base >= 2, otherwise 1
  const target = base >= 2 ? 2 : 1;

  // base * mult + delta >= target
  // mult >= (target - delta) / base
  const minMult = (target - delta) / base;
  return Math.max(0, Math.ceil(minMult * 100) / 100);
};

// Calculate the effective multiplier
// - If there is no valid input at all -> return 1 (no change)
// - If there is a valid group input -> clamp to minMult so the total stays >= 1 (or >= 2 when possible)
// - If there is a valid row input -> use the row value (already validated on input)
const calcEffectiveMult = (base, delta, groupMultValue, rowMultValue) => {
  // Check row input first
  if (isValidMultInput(rowMultValue)) {
    return toNum(rowMultValue, 1);
  }
  // Check group input
  if (!isValidMultInput(groupMultValue)) {
    // No valid input, return 1 (no change)
    return 1;
  }
  // Valid group input -> clamp to minMult
  const minMult = calcMinMult(base, delta);
  return Math.max(toNum(groupMultValue, 1), minMult);
};

const getPatterns = (route) => [...(route.trips_pattern || [])];

const FirstColGrid = ({ left, middle, right, isHeader = false, indent = 0 }) => (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: "90px 1fr 110px", // was 100px 1fr 120px
      columnGap: 1,
      alignItems: isHeader ? "flex-start" : "center",
      pl: indent,
      minWidth: 0,
    }}
  >
    <Box sx={{ minWidth: 0, overflow: "hidden" }}>{left}</Box>
    <Box sx={{ minWidth: 0, overflow: "hidden" }}>{middle}</Box>
    <Box sx={{ minWidth: 0, overflow: "hidden" }}>{right}</Box>
  </Box>
);

const CLAMP_3 = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 3,
  overflow: "hidden",
  whiteSpace: "normal",
  wordBreak: "break-word",
  lineHeight: 1.3,
};

const LabelStack = ({ top, bottom, align = "left" }) => (
  <Box sx={{ textAlign: align, lineHeight: 1.2 }}>
    <Typography sx={{ fontWeight: 700, whiteSpace: "nowrap", fontSize: "0.875rem" }}>{top}</Typography>
    {bottom && (
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ whiteSpace: "nowrap", fontSize: "0.75rem" }}
      >
        {bottom}
      </Typography>
    )}
  </Box>
);

const SubHeaderLabel = ({ top, bottom, align = "left" }) => {
  const parts = typeof bottom === "string" ? bottom.split("/").map(s => s.trim()) : [];

  return (
    <Box sx={{ textAlign: align, lineHeight: 1.2, minWidth: 0 }}>
      <Typography
        sx={{
          fontWeight: 700,
          whiteSpace: "normal",
          wordBreak: "keep-all",
          fontSize: "0.875rem",
          lineHeight: 1.2,
        }}
      >
        {top}
      </Typography>

      {bottom && (
        <Tooltip title={bottom} arrow>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              fontSize: "0.75rem",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "block",
              cursor: "default",
            }}
          >
            {bottom}
          </Typography>
        </Tooltip>
      )}

    </Box>
  );
};



const LabelStackWrap = ({ top, bottom, align = "left" }) => (
  <Box sx={{ textAlign: align, lineHeight: 1.2, minWidth: 0 }}>
    <Typography
      sx={{
        fontWeight: 700,
        whiteSpace: "nowrap",
        fontSize: "0.875rem",
      }}
    >
      {top}
    </Typography>

    {bottom && (
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          fontSize: "0.75rem",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "block",
          maxWidth: "100%",
        }}
        title={bottom}
      >
        {bottom}
      </Typography>
    )}
  </Box>
);


const HeadingLabelStack = ({ top, bottom, align = "left" }) => (
  <Box sx={{ textAlign: align, lineHeight: 1.2 }}>
    <Typography sx={{ fontWeight: 700, whiteSpace: "normal", wordBreak: "break-word" }}>
      {top}
      {bottom && <br />}
      {bottom}
    </Typography>
  </Box>
);

const normalizeShape = (rawPoints = []) =>
  rawPoints
    .map((p) => {
      if (!p) return null;
      if (Array.isArray(p) && p.length >= 2) {
        const a = Number(p[0]);
        const b = Number(p[1]);
        if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
        if (Math.abs(a) > 90) return [b, a];
        return [a, b];
      }
      const lat = p.lat ?? p.latitude ?? p.y;
      const lon = p.lon ?? p.lng ?? p.longitude ?? p.x;
      if (lat == null || lon == null) return null;
      const la = Number(lat);
      const lo = Number(lon);
      if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
      return [la, lo];
    })
    .filter(Boolean);

const FitPolyline = ({ positions }) => {
  const map = useMap();
  useEffect(() => {
    if (!positions?.length) return;
    const lats = positions.map((p) => p[0]);
    const lons = positions.map((p) => p[1]);
    const south = Math.min(...lats);
    const west = Math.min(...lons);
    const north = Math.max(...lats);
    const east = Math.max(...lons);
    map.fitBounds(
      [
        [south, west],
        [north, east],
      ],
      { padding: [20, 20] }
    );
  }, [positions, map]);
  return null;
};

// ---- column widths ----
const COLS = {
  first: 340,
  dir: 80,
  svc: 80,
  section: 130,
  total: 70,
  mult: 85,
  delta: 85,
  newTotal: 70,
  map: 70,
};

const NOWRAP = {
  whiteSpace: "nowrap",
  wordBreak: "keep-all",
};

const HEADER_BREAK = {
  whiteSpace: "normal",
  wordBreak: "break-word",
  textAlign: "center",
  lineHeight: 1.2,
  maxWidth: "80px",
  minWidth: "60px",
};

const WRAP_TEXT = {
  whiteSpace: "normal",
  wordBreak: "break-word",
  display: "block",
  lineHeight: 1.4,
  overflow: "hidden",
};

// ---------- Component ----------
const FrequencyEditorPage = ({
  routeGroups = [],
  scenarioId,
  onChange = () => { },
  resetSignal = 0,
  refreshing = false,
}) => {
  const [openGroup, setOpenGroup] = useState({});
  const [groupMult, setGroupMult] = useState({});
  const [groupDelta, setGroupDelta] = useState({});
  const [rowMult, setRowMult] = useState({});
  const [rowDelta, setRowDelta] = useState({});

  // Detail modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailTripData, setDetailTripData] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailMeta, setDetailMeta] = useState(null);

  // Shape modal
  const [shapeModalOpen, setShapeModalOpen] = useState(false);
  const [shapeLoading, setShapeLoading] = useState(false);
  const [activeShapeId, setActiveShapeId] = useState(null);
  const [shapeCache, setShapeCache] = useState({});
  const [activeRouteName, setActiveRouteName] = useState("");
  const [activePatternId, setActivePatternId] = useState("");

  // Route map modal
  const [routeMapModalOpen, setRouteMapModalOpen] = useState(false);
  const [routeMapShape, setRouteMapShape] = useState([]);
  const [routeMapRouteData, setRouteMapRouteData] = useState(null);
  const [routeMapColor, setRouteMapColor] = useState(null);

  const toggleGroup = useCallback(
    (groupId) =>
      setOpenGroup((p) => ({
        ...p,
        [groupId]: !p[groupId],
      })),
    []
  );
  const handleGroupMult = useCallback(
    (groupId, v) => setGroupMult((p) => ({ ...p, [groupId]: v })),
    []
  );
  const handleGroupDelta = useCallback(
    (groupId, v) => setGroupDelta((p) => ({ ...p, [groupId]: v })),
    []
  );
  const handleRowMult = useCallback(
    (key, v) => setRowMult((p) => ({ ...p, [key]: v })),
    []
  );
  const handleRowDelta = useCallback(
    (key, v) => setRowDelta((p) => ({ ...p, [key]: v })),
    []
  );

  // reset inputs after save
  useEffect(() => {
    setGroupMult({});
    setGroupDelta({});
    setRowMult({});
    setRowDelta({});
  }, [resetSignal]);

  // Totals per group
  const groupSummaries = useMemo(() => {
    const res = {};
    for (const g of routeGroups) {
      let before = 0,
        after = 0;
      const gMultValue = groupMult[g.group_route_id];
      const gDelta = toNum(groupDelta[g.group_route_id], 0);

      for (const r of g.routes || []) {
        for (const p of getPatterns(r)) {
          const base = toNum(p.interval, 0);
          const idx = String(p.pattern_id || "").split("-").pop();
          const key = `${r.route_id}:${idx}`;
          const d =
            rowDelta[key] === undefined || rowDelta[key] === ""
              ? gDelta
              : toNum(rowDelta[key], 0);
          // Gunakan effective multiplier (pass raw values, validation inside)
          const m = calcEffectiveMult(base, d, gMultValue, rowMult[key]);
          before += base;
          after += calcFinal(base, m, d);
        }
      }
      res[g.group_route_id] = { before, after };
    }
    return res;
  }, [routeGroups, groupMult, groupDelta, rowMult, rowDelta]);

  // Payload
  const payload = useMemo(
    () =>
      routeGroups.map((g) => {
        const gMultValue = groupMult[g.group_route_id];
        return {
          scenario_id: scenarioId,
          group_route_id: g.group_route_id,
          group_route_name: g.group_route_name,
          group_multiplier:
            !isValidMultInput(gMultValue)
              ? null
              : toNum(gMultValue, 1),
          group_delta:
            groupDelta[g.group_route_id] === "" ||
              groupDelta[g.group_route_id] === undefined
              ? null
              : toNum(groupDelta[g.group_route_id], 0),
          routes: (g.routes || []).map((r) => ({
            route_id: r.route_id,
            trips: getPatterns(r).map((p) => {
              const base = toNum(p.interval, 0);
              const idx = String(p.pattern_id || "").split("-").pop();
              const key = `${r.route_id}:${idx}`;
              const d =
                rowDelta[key] === undefined || rowDelta[key] === ""
                  ? toNum(groupDelta[g.group_route_id], 0)
                  : toNum(rowDelta[key], 0);
              // Gunakan effective multiplier (pass raw values)
              const m = calcEffectiveMult(base, d, gMultValue, rowMult[key]);
              return {
                pattern_id: p.pattern_id,
                pattern_hash: p.pattern_hash,
                trip_id: p.trip_id,
                route_id: r.route_id,
                shape_id: p.shape_id,
                route_name:
                  r.route_long_name || r.route_short_name || r.route_id,
                service_id: p.service_id,
                direction_id: p.direction_id,
                first_and_last_stop_name: p.first_and_last_stop_name,
                current_interval: base,
                multiplier: m,
                delta: d,
                new_interval: calcFinal(base, m, d),
              };
            }),
          })),
        };
      }),
    [routeGroups, groupMult, groupDelta, rowMult, rowDelta, scenarioId]
  );

  useEffect(() => {
    onChange(payload);
  }, [payload, onChange]);

  // sort groups (ja locale)
  const sortedGroups = useMemo(() => {
    const collator = new Intl.Collator("ja", {
      sensitivity: "base",
      numeric: true,
    });
    return [...routeGroups].sort((a, b) =>
      collator.compare(a.group_route_name ?? "", b.group_route_name ?? "")
    );
  }, [routeGroups]);

  const closeShapeModal = () => {
    setShapeModalOpen(false);
  };

  const handleShowRouteMap = async (route, pattern) => {
    if (!scenarioId || !pattern?.shape_id || !route) return;

    const rid = String(route.route_id ?? "");
    const pid = pattern.pattern_id;
    let matchedRoute = null;
    let matchedGroup = null;

    if (Array.isArray(routeGroups)) {
      for (const g of routeGroups) {
        if (!g || !Array.isArray(g.routes)) continue;
        for (const r of g.routes) {
          if (!r || String(r.route_id) !== rid) continue;
          const patterns = getPatterns(r);
          if (patterns.some((pp) => pp && pp.pattern_id === pid)) {
            matchedRoute = r;
            matchedGroup = g;
            break;
          }
        }
        if (matchedRoute) break;
      }
    }

    const effectiveRoute = matchedRoute || route;

    try {
      const res = await getDetailMapFrequency(scenarioId, pattern.shape_id);

      const shape = normalizeShape(res?.coordinates || []);

      let stopSequence = [];
      const fc = res?.stops_geojson;
      if (fc && fc.type === "FeatureCollection" && Array.isArray(fc.features)) {
        stopSequence = fc.features
          .map((f, idx) => {
            const g = f?.geometry;
            const props = f?.properties || {};
            if (
              !g ||
              g.type !== "Point" ||
              !Array.isArray(g.coordinates) ||
              g.coordinates.length < 2
            ) {
              return null;
            }
            const [lon, lat] = g.coordinates;
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
            return {
              stop_id: props.stop_id ?? String(idx + 1),
              stop_name: props.stop_name ?? "",
              stop_sequence: idx + 1,
              latlng: [lat, lon],
            };
          })
          .filter(Boolean);
      }

      const basePattern =
        getPatterns(effectiveRoute).find((pp) => pp && pp.pattern_id === pid) ||
        pattern;

      const routeData = {
        route_id: effectiveRoute.route_id,
        route_short_name: effectiveRoute.route_short_name,
        route_long_name: effectiveRoute.route_long_name,
        route_type: effectiveRoute.route_type,
        agency_id: effectiveRoute.agency_id,
        geojson_data: effectiveRoute.geojson_data,
        route_patterns: [
          {
            ...basePattern,
            stop_sequence: stopSequence,
            shape,
          },
        ],
      };

      setRouteMapShape(shape);
      setRouteMapRouteData(routeData);

      let rawColor =
        effectiveRoute?.route_color ?? matchedGroup?.keyword_color ?? null;
      let colorHex = null;
      if (rawColor) {
        const hex = String(rawColor).replace(/^#?/, "");
        colorHex = `#${hex}`;
      }
      setRouteMapColor(colorHex);
      setRouteMapModalOpen(true);
    } catch (err) {
      setRouteMapShape([]);
      setRouteMapRouteData(null);
      setRouteMapColor(null);
      setRouteMapModalOpen(true);
    }
  };

  const tableMinWidth =
    COLS.first +
    COLS.dir +
    COLS.svc +
    COLS.section +
    COLS.total +
    COLS.mult +
    COLS.delta +
    COLS.newTotal +
    COLS.map;

  // ---- render ----
  return (
    <Box
      sx={{
        height: "100%",
        width: "100%",
        maxWidth: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 0,
          position: "relative",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          maxWidth: "100%",
        }}
      >
        {/* overlay while refreshing */}
        <Backdrop open={refreshing} sx={{ zIndex: 1300, position: "absolute" }}>
          <CircularProgress color="inherit" />
        </Backdrop>

        {/* Scroll area for table */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <TableContainer
            sx={{
              height: "100%",
              maxHeight: "100%",
              overflowX: "auto",
              overflowY: "auto",
              position: "relative",
            }}
          >
            <Table
              stickyHeader
              sx={{
                tableLayout: "fixed",
                minWidth: tableMinWidth,
              }}
            >
              <colgroup>
                <col style={{ width: COLS.first }} />
                <col style={{ width: COLS.dir }} />
                <col style={{ width: COLS.svc }} />
                <col style={{ width: COLS.section }} />
                <col style={{ width: COLS.total }} />
                <col style={{ width: COLS.mult }} />
                <col style={{ width: COLS.delta }} />
                <col style={{ width: COLS.newTotal }} />
                <col style={{ width: COLS.map }} />
              </colgroup>

              {/* ======= MAIN HEADER ======= */}
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      ...NOWRAP,
                      minWidth: COLS.first,
                      bgcolor: "background.paper",
                      verticalAlign: "top",
                      pt: 1,
                      pb: 0.5,
                    }}
                  >
                    <LabelStack top={LABELS.trip.routeGrouping} align="left" />
                  </TableCell>

                  <TableCell
                    align="center"
                    sx={{
                      ...NOWRAP,
                      bgcolor: "background.paper",
                      verticalAlign: "top",
                      pt: 1,
                      pb: 0.5,
                    }}
                  >
                    <LabelStack
                      top={LABELS.common.direction}
                      bottom={LABELS.gtfs.directionId}
                      align="center"
                    />
                  </TableCell>

                  <TableCell
                    align="center"
                    sx={{
                      ...NOWRAP,
                      bgcolor: "background.paper",
                      verticalAlign: "top",
                      pt: 1,
                      pb: 0.5,
                    }}
                  >
                    <LabelStack top={LABELS.common.serviceId} bottom={LABELS.gtfs.serviceId} align="center" />
                  </TableCell>

                  <TableCell
                    align="center"
                    sx={{
                      ...NOWRAP,
                      bgcolor: "background.paper",
                      verticalAlign: "top",
                      pt: 1,
                      pb: 0.5,
                    }}
                  >
                    <LabelStack top={LABELS.common.section} align="center" />
                  </TableCell>

                  <TableCell
                    align="center"
                    sx={{
                      ...NOWRAP,
                      bgcolor: "background.paper",
                      verticalAlign: "top",
                      pt: 1,
                      pb: 0.5,
                    }}
                  >
                    <LabelStack top={LABELS.trip.totalTrips} align="center" />
                  </TableCell>

                  <TableCell
                    align="center"
                    sx={{
                      ...NOWRAP,
                      bgcolor: "background.paper",
                      verticalAlign: "top",
                      pt: 1,
                      pb: 0.5,
                    }}
                  >
                    <LabelStack top={LABELS.trip.multiplier} align="center" />
                  </TableCell>

                  <TableCell
                    align="center"
                    sx={{
                      ...NOWRAP,
                      bgcolor: "background.paper",
                      verticalAlign: "top",
                      pt: 1,
                      pb: 0.5,
                    }}
                  >
                    <LabelStack top={LABELS.trip.delta} align="center" />
                  </TableCell>

                  <TableCell
                    align="center"
                    sx={{
                      ...HEADER_BREAK,
                      bgcolor: "background.paper",
                      verticalAlign: "top",
                      pt: 1,
                      pb: 0.5,
                    }}
                  >
                    <Typography sx={{ fontWeight: 700, whiteSpace: "normal", wordBreak: "break-word", fontSize: "0.875rem" }}>
                      {LABELS.trip.totalTripsAfter.split("後の")[0]}後の<br />{LABELS.trip.totalTripsAfter.split("後の")[1]}
                    </Typography>
                  </TableCell>

                  <TableCell
                    align="center"
                    sx={{
                      ...NOWRAP,
                      bgcolor: "background.paper",
                      verticalAlign: "top",
                      pt: 1,
                      pb: 0.5,
                      minWidth: COLS.map,
                    }}
                  >
                    {/* empty header for map column */}
                  </TableCell>
                </TableRow>
              </TableHead>

              {/* ======= BODY ======= */}
              <TableBody>
                {sortedGroups.map((g) => {
                  const gSum = groupSummaries[g.group_route_id] || {
                    before: 0,
                    after: 0,
                  };
                  return (
                    <React.Fragment key={g.group_route_id}>
                      {/* Group Row */}
                      <TableRow sx={{ bgcolor: "#fafafa" }}>
                        <TableCell sx={{ ...NOWRAP, overflow: "hidden" }}>
                          <Box sx={{ display: "flex", alignItems: "center", minWidth: 0 }}>
                            <IconButton size="small" onClick={() => toggleGroup(g.group_route_id)}>
                              {openGroup[g.group_route_id] ? <ExpandLess /> : <ExpandMore />}
                            </IconButton>
                            <Tooltip title={g.group_route_name || ""} arrow>
                              <Typography
                                component="span"
                                fontWeight="bold"
                                sx={{
                                  ml: 1,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  cursor: "default",
                                }}
                              >
                                {g.group_route_name}
                              </Typography>
                            </Tooltip>
                          </Box>
                        </TableCell>
                        <TableCell align="center" sx={NOWRAP}>
                          -
                        </TableCell>
                        <TableCell align="center" sx={NOWRAP}>
                          -
                        </TableCell>
                        <TableCell align="center" sx={NOWRAP}>
                          -
                        </TableCell>
                        <TableCell align="center" sx={NOWRAP}>
                          {gSum.before}
                        </TableCell>
                        <TableCell align="center" sx={NOWRAP}>
                          <TextField
                            size="small"
                            type="text"
                            inputMode="decimal"
                            value={groupMult[g.group_route_id] ?? ""}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === "") {
                                setGroupMult((p) => ({
                                  ...p,
                                  [g.group_route_id]: "",
                                }));
                                return;
                              }
                              // Only allow digits and decimal points (no minus)
                              if (!/^\d*\.?\d*$/.test(raw)) return;

                              // Allow partial inputs (e.g., incomplete decimal)
                              const isPartialInput =
                                raw === "." ||
                                raw === "0" ||
                                raw.endsWith(".");

                              if (isPartialInput) {
                                setGroupMult((p) => ({
                                  ...p,
                                  [g.group_route_id]: raw,
                                }));
                                return;
                              }

                              const val = Number(raw);
                              if (isNaN(val)) return;
                              if (val > 10) return;
                              // No minimum-2 validation at the group level
                              // Route level will automatically clamp to the required minimum

                              setGroupMult((p) => ({
                                ...p,
                                [g.group_route_id]: raw,
                              }));
                            }}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  ×
                                </InputAdornment>
                              ),
                            }}
                            sx={{ width: 80 }}
                          />
                        </TableCell>
                        <TableCell align="center" sx={NOWRAP} />
                        <TableCell align="center" sx={NOWRAP}>
                          {gSum.after}
                        </TableCell>
                        <TableCell align="center" sx={NOWRAP} />
                      </TableRow>

                      {/* Child subheader */}
                      {openGroup[g.group_route_id] && (
                        <TableRow>
                          <TableCell sx={{ pt: 1, pb: 1 }}>
                            <FirstColGrid
                              isHeader
                              indent={5}
                              left={<LabelStack top={LABELS.common.routeId} bottom={LABELS.gtfs.routeId} />}
                              middle={
                                <SubHeaderLabel
                                  top={LABELS.trip.routeIdAndName}
                                  bottom={`${LABELS.gtfs.routeShortName} / ${LABELS.gtfs.routeLongName}`}
                                  align="left"
                                />
                              }

                              right={<LabelStack top={LABELS.common.patternId} />}
                            />
                          </TableCell>
                          <TableCell />
                          <TableCell />
                          <TableCell />
                          <TableCell />
                          <TableCell />
                          <TableCell />
                          <TableCell />
                          <TableCell />
                        </TableRow>
                      )}

                      {/* Pattern Rows */}
                      {openGroup[g.group_route_id] &&
                        g.routes.flatMap((r) =>
                          getPatterns(r)
                            .filter((p) => toNum(p.interval, 0) !== 0)
                            .map((p) => {
                              const base = toNum(p.interval, 0);
                              const idx = String(p.pattern_id || "")
                                .split("-")
                                .pop();
                              const key = `${r.route_id}:${idx}`;
                              const routeName =
                                r.route_short_name ||
                                r.route_long_name ||
                                r.route_id;

                              const gMultValue = groupMult[g.group_route_id];
                              const d =
                                rowDelta[key] === undefined ||
                                  rowDelta[key] === ""
                                  ? toNum(groupDelta[g.group_route_id], 0)
                                  : toNum(rowDelta[key], 0);

                              // Calculate the minimum multiplier for this pattern (for input validation)
                              const minMult = calcMinMult(base, d);
                              // Effective multiplier to use (pass raw values)
                              const effectiveMult = calcEffectiveMult(base, d, gMultValue, rowMult[key]);
                              const after = calcFinal(base, effectiveMult, d);

                              const dirLabel =
                                p?.direction_id !== undefined &&
                                  p?.direction_id !== null
                                  ? `${p.direction_id}: ${directionMap?.[p.direction_id] ??
                                  String(p.direction_id)
                                  }`
                                  : "-";

                              const shape_id = p.shape_id;

                              return (
                                <TableRow
                                  key={key}
                                  hover
                                  sx={{ cursor: "pointer" }}
                                  onClick={async (e) => {
                                    if (
                                      e.target.tagName === "INPUT" ||
                                      e.target.closest(".MuiInputBase-root") ||
                                      e.target.closest(
                                        "[data-skip-row-click='true']"
                                      )
                                    ) {
                                      return;
                                    }
                                    setDetailMeta({
                                      route_id: r.route_id,
                                      route_name: routeName,
                                      pattern_id: p.pattern_id,
                                      direction_id: p.direction_id,
                                      direction_label: dirLabel,
                                      service_id: p.service_id,
                                      first_and_last_stop_name:
                                        p.first_and_last_stop_name,
                                    });
                                    setDetailLoading(true);
                                    try {
                                      const res =
                                        await getDetailTripFrequency(
                                          scenarioId,
                                          r.route_id,
                                          p.service_id,
                                          p.trip_headsign,
                                          shape_id,
                                          p.direction_id,
                                          p.pattern_hash
                                        );
                                      setDetailTripData(res);
                                      setDetailModalOpen(true);
                                    } catch {
                                      setDetailTripData([]);
                                      setDetailModalOpen(true);
                                    } finally {
                                      setDetailLoading(false);
                                    }
                                  }}
                                >
                                  <TableCell sx={{ overflow: "hidden" }}>
                                    <FirstColGrid
                                      indent={5}
                                      left={
                                        <Tooltip title={r.route_id || ""} arrow>
                                          <Typography
                                            variant="body2"
                                            sx={{
                                              // whiteSpace: "nowrap",
                                              // overflow: "hidden",
                                              // textOverflow: "ellipsis",
                                              // display: "block",
                                              ...CLAMP_3,
                                              cursor: "default",
                                            }}
                                          >
                                            {r.route_id}
                                          </Typography>
                                        </Tooltip>
                                      }
                                      middle={
                                        <Tooltip title={routeName || ""} arrow>
                                          <Typography
                                            variant="body2"
                                            sx={{
                                              // whiteSpace: "nowrap",
                                              // overflow: "hidden",
                                              // textOverflow: "ellipsis",
                                              // display: "block",
                                              ...CLAMP_3,
                                              cursor: "default",
                                            }}
                                          >
                                            {routeName}
                                          </Typography>
                                        </Tooltip>
                                      }
                                      right={
                                        <Tooltip title={p.pattern_id || ""} arrow>
                                          <Typography
                                            variant="body2"
                                            sx={{
                                              // whiteSpace: "nowrap",
                                              // overflow: "hidden",
                                              // textOverflow: "ellipsis",
                                              // display: "block",
                                              ...CLAMP_3,
                                              cursor: "default",
                                            }}
                                          >
                                            {p.pattern_id}
                                          </Typography>
                                        </Tooltip>
                                      }
                                    />
                                  </TableCell>
                                  <EllipsizedCell
                                    title={
                                      p.is_direction_id_generated
                                        ? MESSAGES.trip.systemGeneratedTooltip
                                        : dirLabel
                                    }
                                  >
                                    <Box
                                      component="span"
                                      sx={{
                                        color: p.is_direction_id_generated
                                          ? "#1E88E5"
                                          : "inherit",
                                        fontWeight: p.is_direction_id_generated
                                          ? 700
                                          : "normal",
                                      }}
                                    >
                                      {dirLabel}
                                    </Box>
                                  </EllipsizedCell>
                                  <TableCell align="center">
                                    <Tooltip title={p.service_id || ""} arrow>
                                      <Typography
                                        variant="body2"
                                        sx={{
                                          whiteSpace: "nowrap",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          display: "block",
                                          cursor: "default",
                                        }}
                                      >
                                        {p.service_id || "-"}
                                      </Typography>
                                    </Tooltip>
                                  </TableCell>
                                  <TableCell align="center" sx={{ minWidth: 0 }}>
                                    <Tooltip
                                      title={formatSectionLabel(p.first_and_last_stop_name) || ""}
                                      arrow
                                    >
                                      <Typography
                                        variant="body2"
                                        sx={{
                                          ...CLAMP_3,
                                          cursor: "default",
                                        }}
                                      >
                                        {formatSectionLabel(p.first_and_last_stop_name) || "-"}
                                      </Typography>
                                    </Tooltip>
                                  </TableCell>

                                  <TableCell align="center" sx={NOWRAP}>
                                    {base}
                                  </TableCell>
                                  <TableCell align="center" sx={NOWRAP}>
                                    <TextField
                                      size="small"
                                      type="text"
                                      inputMode="decimal"
                                      value={rowMult[key] ?? ""}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        if (raw === "") {
                                          setRowMult((prev) => ({
                                            ...prev,
                                            [key]: "",
                                          }));
                                          return;
                                        }
                                        // Only allow digits and decimal points (no minus)
                                        if (!/^\d*\.?\d*$/.test(raw)) return;

                                        // Allow partial inputs (e.g., incomplete decimal)
                                        const isPartialInput =
                                          raw === "." ||
                                          raw === "0" ||
                                          raw.endsWith(".");

                                        if (isPartialInput) {
                                          setRowMult((prev) => ({
                                            ...prev,
                                            [key]: raw,
                                          }));
                                          return;
                                        }

                                        const val = Number(raw);
                                        if (isNaN(val)) return;
                                        if (val > 10) return;
                                        // Validation: value must not be less than minMult
                                        if (val < minMult) return;
                                        setRowMult((prev) => ({
                                          ...prev,
                                          [key]: raw,
                                        }));
                                      }}
                                      placeholder={
                                        // Show effective multiplier as placeholder
                                        effectiveMult !== 1
                                          ? String(effectiveMult)
                                          : ""
                                      }
                                      InputProps={{
                                        startAdornment: (
                                          <InputAdornment position="start">
                                            ×
                                          </InputAdornment>
                                        ),
                                      }}
                                      sx={{ width: 80 }}
                                      data-skip-row-click="true"
                                    />
                                  </TableCell>
                                  <TableCell align="center" sx={NOWRAP}>
                                    <TextField
                                      size="small"
                                      type="number"
                                      value={rowDelta[key] ?? ""}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        if (raw === "") {
                                          setRowDelta((p) => ({
                                            ...p,
                                            [key]: "",
                                          }));
                                          return;
                                        }
                                        const val = Number(raw);
                                        if (base === 1 && val > 15) return;

                                        // Determine the multiplier to use for validation
                                        let m2;
                                        if (isValidMultInput(rowMult[key])) {
                                          // User already provided a valid row multiplier
                                          m2 = toNum(rowMult[key], 1);
                                        } else if (isValidMultInput(gMultValue)) {
                                          // Valid group input: effective mult = max(gMult, minMult)
                                          m2 = Math.max(toNum(gMultValue, 1), calcMinMult(base, val));
                                        } else {
                                          // No valid multiplier input, use 1
                                          m2 = 1;
                                        }

                                        const minDelta = 2 - Math.round(base * m2);
                                        if (val < minDelta) return;
                                        setRowDelta((p) => ({
                                          ...p,
                                          [key]: raw,
                                        }));
                                      }}
                                      placeholder={
                                        groupDelta[g.group_route_id]
                                          ? String(
                                            groupDelta[g.group_route_id]
                                          )
                                          : ""
                                      }
                                      InputProps={{
                                        startAdornment: (
                                          <InputAdornment position="start">
                                            ±
                                          </InputAdornment>
                                        ),
                                      }}
                                      sx={{ width: 80 }}
                                      data-skip-row-click="true"
                                    />
                                  </TableCell>
                                  <TableCell align="center" sx={NOWRAP}>
                                    {after}
                                  </TableCell>
                                  <TableCell align="left" sx={{ ...NOWRAP, pl: 0.5, pr: 0, }}>
                                    {shape_id ? (
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        data-skip-row-click="true"
                                        onClick={(ev) => {
                                          ev.stopPropagation();
                                          handleShowRouteMap(r, p);
                                        }}
                                        sx={{ minWidth: "auto", px: 1 }}
                                      >
                                        {BUTTONS.stop.showMap}
                                      </Button>
                                    ) : (
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={NOWRAP}
                                      >
                                        -
                                      </Typography>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })
                        )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        {/* Detail modal */}
        <Dialog
          open={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>{LABELS.trip.tripDetail}</DialogTitle>
          <DialogContent>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 700, mb: 1 }}
            >
              {LABELS.route.patternInfo}
            </Typography>
            <Table size="small" sx={{ mb: 1 }}>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <LabelStack top={LABELS.route.internalPatternId} />
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{ ...NOWRAP, bgcolor: "background.paper" }}
                  >
                    <LabelStack
                      top={LABELS.common.direction}
                      bottom={LABELS.gtfs.directionId}
                      align="center"
                    />
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{ ...NOWRAP, bgcolor: "background.paper" }}
                  >
                    <LabelStack top={LABELS.common.serviceId} bottom={LABELS.gtfs.serviceId} align="center" />
                  </TableCell>
                  <TableCell
                    sx={{ ...NOWRAP, bgcolor: "background.paper" }}
                  >
                    <LabelStack top={LABELS.common.section} />
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{ ...NOWRAP, bgcolor: "background.paper" }}
                  >
                    <LabelStack top={LABELS.trip.totalTrips} />
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>
                    {detailMeta?.pattern_id ?? "-"}
                  </TableCell>
                  <TableCell align="center">
                    {detailMeta?.direction_label ??
                      (detailMeta?.direction_id ??
                        detailMeta?.direction_id === 0
                        ? String(detailMeta?.direction_id)
                        : "-")}
                  </TableCell>
                  <TableCell align="center">
                    {detailMeta?.service_id ?? "-"}
                  </TableCell>
                  <TableCell sx={WRAP_TEXT}>
                    {formatSectionLabel(detailMeta?.first_and_last_stop_name) ?? "-"}
                  </TableCell>
                  <TableCell align="center">
                    {detailTripData?.length ?? 0}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 700, mb: 1, mt: 4 }}
            >
              {LABELS.trip.tabTripList}
            </Typography>

            {detailLoading ? (
              <Box sx={{ py: 4, textAlign: "center" }}>
                <CircularProgress />
              </Box>
            ) : detailTripData && detailTripData.length > 0 ? (
              <Table size="small" sx={{ mt: 1 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <LabelStack
                        top={LABELS.trip.departureTime}
                        bottom={LABELS.gtfs.departureTime}
                      />
                    </TableCell>
                    <TableCell>
                      <LabelStack top={LABELS.trip.tripId} bottom={LABELS.gtfs.tripId} />
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {detailTripData.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{row.departure_time}</TableCell>
                      <TableCell>{row.trip_id}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Typography sx={{ py: 2, color: "#888" }}>
                {MESSAGES.common.noData}
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setDetailModalOpen(false)}
              variant="outlined"
            >
              閉じる
            </Button>
          </DialogActions>
        </Dialog>

        {/* Shape map modal */}
        <Dialog
          open={shapeModalOpen}
          onClose={closeShapeModal}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle
            sx={{ display: "flex", alignItems: "center", gap: 1 }}
          >
            <ZoomInMapIcon fontSize="small" />
            {LABELS.route.routeMap}
          </DialogTitle>
          <DialogContent dividers>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {LABELS.route.routeLabel}: {activeRouteName || "-"}　/　{LABELS.route.patternLabel}:{" "}
              {activePatternId || "-"}　/　{LABELS.gtfs.shapeId}:{" "}
              {activeShapeId || "-"}
            </Typography>

            {shapeLoading ? (
              <Box sx={{ py: 6, textAlign: "center" }}>
                <CircularProgress />
              </Box>
            ) : activeShapeId && shapeCache[activeShapeId]?.length ? (
              <Box
                sx={{
                  height: 420,
                  width: "100%",
                  borderRadius: 1,
                  overflow: "hidden",
                }}
              >
                <MapContainer
                  style={{ height: "100%", width: "100%" }}
                  center={[35.0, 135.0]}
                  zoom={10}
                  scrollWheelZoom
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Polyline positions={shapeCache[activeShapeId]} />
                  <FitPolyline positions={shapeCache[activeShapeId]} />
                </MapContainer>
              </Box>
            ) : (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ py: 2 }}
              >
                {MESSAGES.route.noShapeDataFound}
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeShapeModal} variant="outlined">
              {BUTTONS.common.close}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Route map modal */}
        <RoutePatternMap
          open={routeMapModalOpen}
          onClose={() => {
            setRouteMapModalOpen(false);
            setRouteMapShape([]);
            setRouteMapRouteData(null);
            setRouteMapColor(null);
          }}
          shape={routeMapShape}
          routeData={routeMapRouteData}
          routeColor={routeMapColor}
        />
      </Paper>
    </Box>
  );
};

export default FrequencyEditorPage;
