
import React, { useMemo, useState, useEffect } from "react";
import {
  Box,
  Paper,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
  IconButton,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { SIMULATION } from "@/strings";
import {
  SPEED_CHANGE_ALL_ID,
  SPEED_CHANGE_UI,
} from "../../../constant/simulationSpeedChange";

const strings = SIMULATION.speedChange;

const INDENT_PER_LEVEL = SPEED_CHANGE_UI.indentPerLevel; // visual indentation for nested tables
const ICON_COL_WIDTH = SPEED_CHANGE_UI.iconColWidth; // chevron column width (route level)
const ICON_COL_WIDTH_SM = SPEED_CHANGE_UI.iconColWidthSm; // chevron column width (pattern level)

function fmt(x, frac = 2, forceDecimals = false) {
  if (x === null || x === undefined) return strings.table.unknownDash;
  const n = Number(x);
  if (Number.isNaN(n)) return strings.table.unknownDash;
  return n.toLocaleString(undefined, {
    maximumFractionDigits: frac,
    minimumFractionDigits: forceDecimals ? frac : (Number.isInteger(n) ? 0 : Math.min(frac, 2)),
  });
}

function useNormalizedRoutes(data) {
  const rawRoutes = useMemo(() => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.routes)) return data.routes;
    if (Array.isArray(data?.data?.routes)) return data.data.routes;
    return [];
  }, [data]);

  const normalized = useMemo(() => {
    return (rawRoutes || []).map((r) => {
      const route_id = String(r?.route_id ?? "");
      const service_id = r?.service_id ?? undefined;

      const shapes = (r?.shapes || []).map((s) => {
        const pattern_id = String(
          s?.pattern_id ?? s?.route_pattern?.pattern_id ?? ""
        );
        const shape_id = String(
          s?.shape_id ?? s?.route_pattern?.shape_id ?? ""
        );
        const direction_id =
          s?.direction_id ?? s?.route_pattern?.direction_id ?? null;
        const segments = Array.isArray(s?.segments) ? s.segments : [];
        return { pattern_id, shape_id, direction_id, segments };
      });

      return { route_id, service_id, shapes };
    });
  }, [rawRoutes]);

  return normalized;
}

export default function SpeedChange({ data = [] }) {
  const routes = useNormalizedRoutes(data);
  // Build option lists and route->pattern map
  const { routeOptions, routeToPatterns, allPatternOptions } = useMemo(() => {
    const routeSet = new Set();
    const allPatterns = new Set();
    const r2p = new Map();

    for (const route of routes || []) {
      const routeId = String(route?.route_id ?? "");
      if (!routeId) continue;
      routeSet.add(routeId);

      for (const shape of route?.shapes || []) {
        const patternId = String(shape?.pattern_id ?? "");
        if (!patternId) continue;
        allPatterns.add(patternId);
        if (!r2p.has(routeId)) r2p.set(routeId, new Set());
        r2p.get(routeId).add(patternId);
      }
    }

    return {
      routeOptions: Array.from(routeSet).sort(),
      routeToPatterns: r2p,
      allPatternOptions: Array.from(allPatterns).sort(),
    };
  }, [routes]);

  // Filters
  const [selectedRoute, setSelectedRoute] = useState(SPEED_CHANGE_ALL_ID);
  const [selectedPattern, setSelectedPattern] = useState(SPEED_CHANGE_ALL_ID);

  const patternOptions = useMemo(() => {
    if (!selectedRoute) return allPatternOptions;
    const set = routeToPatterns.get(selectedRoute);
    return set ? Array.from(set).sort() : [];
  }, [selectedRoute, routeToPatterns, allPatternOptions]);

  useEffect(() => {
    setSelectedPattern(SPEED_CHANGE_ALL_ID);
  }, [selectedRoute]);

  // Build Route -> Pattern -> Segments with aggregates
  const grouped = useMemo(() => {
    const out = [];

    for (const route of routes || []) {
      const routeId = route?.route_id ?? "";
      if (selectedRoute && String(routeId) !== String(selectedRoute)) continue;

      const patterns = [];
      let r_sum_tpv_before = 0; // Σ time_per_vehicle_h (before)
      let r_sum_tpv_after = 0;  // Σ time_per_vehicle_h (after)
      let r_sum_ttv_before = 0; // Σ total_time_vehicle_h (before)
      let r_sum_ttv_after = 0;  // Σ total_time_vehicle_h (after)

      // ---- HARMEAN accumulators for route level ----
      let r_inv_before_sum = 0; // Σ (1/speed_before)
      let r_inv_after_sum = 0;  // Σ (1/speed_after)
      let r_cnt_before = 0;     // count of valid speed_before
      let r_cnt_after = 0;      // count of valid speed_after

      for (const shape of route?.shapes || []) {
        const pattern_id = shape?.pattern_id ?? "";
        if (!pattern_id) continue;
        if (selectedPattern && String(pattern_id) !== String(selectedPattern)) continue;

        const direction_id = shape?.direction_id ?? null;
        const shape_id = shape?.shape_id ?? "";

        let p_sum_tpv_before = 0;
        let p_sum_tpv_after = 0;
        let p_sum_ttv_before = 0;
        let p_sum_ttv_after = 0;

        // ---- HARMEAN accumulators for pattern level ----
        let p_inv_before_sum = 0;
        let p_inv_after_sum = 0;
        let p_cnt_before = 0;
        let p_cnt_after = 0;

        const rows = [];
        for (const seg of shape?.segments || []) {
          const m = seg?.metrics || {};
          const tpv_b = Number(m?.time_per_vehicle_h?.before ?? 0) || 0;
          const tpv_a = Number(m?.time_per_vehicle_h?.after ?? 0) || 0;
          const ttv_b = Number(m?.total_time_vehicle_h?.before ?? 0) || 0;
          const ttv_a = Number(m?.total_time_vehicle_h?.after ?? 0) || 0;

          const sp_b = m?.speed_kmh?.before;
          const sp_a = m?.speed_kmh?.after;

          // ---- collect for HARMEAN (positive speeds only) ----
          if (typeof sp_b === "number" && sp_b > 0) {
            p_inv_before_sum += 1 / sp_b;
            p_cnt_before += 1;
            r_inv_before_sum += 1 / sp_b;
            r_cnt_before += 1;
          }
          if (typeof sp_a === "number" && sp_a > 0) {
            p_inv_after_sum += 1 / sp_a;
            p_cnt_after += 1;
            r_inv_after_sum += 1 / sp_a;
            r_cnt_after += 1;
          }

          p_sum_tpv_before += tpv_b;
          p_sum_tpv_after += tpv_a;
          p_sum_ttv_before += ttv_b;
          p_sum_ttv_after += ttv_a;

          rows.push({
            section_code_csv: seg?.section_code_csv ?? "",
            matchcode_shp: seg?.matchcode_shp ?? "",
            road_name: seg?.road_name ?? "",
            speed_before: m?.speed_kmh?.before,
            speed_after: m?.speed_kmh?.after,
            time_before: m?.time_per_vehicle_h?.before,
            time_after: m?.time_per_vehicle_h?.after,
            total_before: m?.total_time_vehicle_h?.before,
            total_after: m?.total_time_vehicle_h?.after,
            key: `${routeId}::${pattern_id}::${seg?.matchcode_shp ?? Math.random().toString(36).slice(2)}`,
          });
        }

        // accumulate to route totals
        r_sum_tpv_before += p_sum_tpv_before;
        r_sum_tpv_after += p_sum_tpv_after;
        r_sum_ttv_before += p_sum_ttv_before;
        r_sum_ttv_after += p_sum_ttv_after;

        patterns.push({
          pattern_id,
          direction_id,
          shape_id,
          rows,
          agg: {
            tpv_before: p_sum_tpv_before,
            tpv_after: p_sum_tpv_after,
            ttv_before: p_sum_ttv_before,
            ttv_after: p_sum_ttv_after,
            // ---- HARMEAN speeds at pattern level ----
            avg_speed_before: p_cnt_before ? (p_cnt_before / p_inv_before_sum) : null,
            avg_speed_after:  p_cnt_after  ? (p_cnt_after  / p_inv_after_sum)  : null,
          },
        });
      }

      out.push({
        route_id: routeId,
        patterns: patterns.sort((a, b) => String(a.pattern_id).localeCompare(String(b.pattern_id))),
        agg: {
          tpv_before: r_sum_tpv_before,
          tpv_after: r_sum_tpv_after,
          ttv_before: r_sum_ttv_before,
          ttv_after: r_sum_ttv_after,
          // ---- HARMEAN speeds at route level ----
          avg_speed_before: r_cnt_before ? (r_cnt_before / r_inv_before_sum) : null,
          avg_speed_after:  r_cnt_after  ? (r_cnt_after  / r_inv_after_sum)  : null,
        },
      });
    }

    out.sort((a, b) => String(a.route_id).localeCompare(String(b.route_id)));
    return out;
  }, [routes, selectedRoute, selectedPattern]);

  const totals = useMemo(() => {
    let tpv_b = 0, tpv_a = 0, ttv_b = 0, ttv_a = 0;

    // ---- HARMEAN accumulators for totals ----
    let inv_b_sum = 0, cnt_b = 0;
    let inv_a_sum = 0, cnt_a = 0;

    for (const route of grouped || []) {
      for (const p of route?.patterns || []) {
        tpv_b += Number(p?.agg?.tpv_before ?? 0);
        tpv_a += Number(p?.agg?.tpv_after ?? 0);
        ttv_b += Number(p?.agg?.ttv_before ?? 0);
        ttv_a += Number(p?.agg?.ttv_after ?? 0);

        for (const r of p?.rows || []) {
          const sb = Number(r?.speed_before);
          if (!Number.isNaN(sb) && sb > 0) { inv_b_sum += 1 / sb; cnt_b += 1; }
          const sa = Number(r?.speed_after);
          if (!Number.isNaN(sa) && sa > 0) { inv_a_sum += 1 / sa; cnt_a += 1; }
        }
      }
    }

    return {
      // ---- HARMEAN speeds in totals row ----
      avg_speed_before: cnt_b ? (cnt_b / inv_b_sum) : null,
      avg_speed_after : cnt_a ? (cnt_a / inv_a_sum) : null,
      tpv_before      : tpv_b,
      tpv_after       : tpv_a,
      ttv_before      : ttv_b,
      ttv_after       : ttv_a,
    };
  }, [grouped]);

  // ===== Display components =====
  const TwoLineHeader = ({ jp, en, level = "parent" }) => {
    const hasEn = !!en && en.trim().length > 0;
    const jpColor = level === "parent" ? "text.primary" : "#616161";
    const enColor = level === "parent" ? "text.secondary" : "#9e9e9e";
    return (
      <Box sx={{ minWidth: 0 }} title={`${jp}${hasEn ? " / " + en : ""}`}>
        <Typography fontWeight="bold" fontSize={14} noWrap color={jpColor} sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {jp}
        </Typography>
        <Typography
          fontWeight="bold"
          fontSize={12}
          color={enColor}
          sx={{ display: "block", lineHeight: "16px", minHeight: "16px", visibility: hasEn ? "visible" : "hidden", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {hasEn ? en : "x"}
        </Typography>
      </Box>
    );
  };

  const EqualColGroup = ({ cols, leadingPx = 0, trailingAuto = false }) => (
    <colgroup>
      {leadingPx ? <col style={{ width: leadingPx }} /> : null}
      {Array.from({ length: cols }).map((_, i) => (
        <col key={i} style={{ width: `${100 / cols}%` }} />
      ))}
      {trailingAuto ? <col /> : null}
    </colgroup>
  );

  const cellTextSx = { whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden", maxWidth: "100%" };

  const EllipsisText = ({ children, title }) => (
    <Box sx={cellTextSx} title={title ?? String(children ?? "")}>
      {children}
    </Box>
  );

  const [openRows, setOpenRows] = useState({});
  const [openPatterns, setOpenPatterns] = useState({});
  const toggleRow = (routeId) => setOpenRows((prev) => ({ ...prev, [routeId]: !prev[routeId] }));
  const togglePattern = (key) => setOpenPatterns((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <Box sx={{ width: "100%" }}>
      {/* Filters */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
        <FormControl
          size="small"
          sx={{ minWidth: SPEED_CHANGE_UI.routeFilterMinWidth }}
        >
          <InputLabel id="route-filter-label" shrink>
            {strings.filters.routeId}
          </InputLabel>
          <Select
            labelId="route-filter-label"
            value={selectedRoute}
            label={strings.filters.routeId}
            displayEmpty
            renderValue={(v) => (v ? v : strings.filters.all)}
            onChange={(e) => setSelectedRoute(e.target.value)}
          >
            <MenuItem value={SPEED_CHANGE_ALL_ID}>
              <em>{strings.filters.all}</em>
            </MenuItem>
            {routeOptions.map((opt) => (
              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl
          size="small"
          sx={{ minWidth: SPEED_CHANGE_UI.patternFilterMinWidth }}
          disabled={!selectedRoute}
        >
          <InputLabel id="pattern-filter-label" shrink>
            {strings.filters.pattern}
          </InputLabel>
          <Select
            labelId="pattern-filter-label"
            value={selectedPattern}
            label={strings.filters.pattern}
            displayEmpty
            renderValue={(v) => (v ? v : strings.filters.all)}
            onChange={(e) => setSelectedPattern(e.target.value)}
          >
            <MenuItem value={SPEED_CHANGE_ALL_ID}>
              <em>{strings.filters.all}</em>
            </MenuItem>
            {patternOptions.map((opt) => (
              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {/* ===== LEVEL 0 (Routes) ===== */}
      <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
        <Table
          size="small"
          sx={{
            minWidth: SPEED_CHANGE_UI.tableMinWidth,
            width: "100%",
            tableLayout: "fixed",
          }}
        >
          {/* was cols={7}; now +3 route-level columns -> cols={10} */}
          <EqualColGroup cols={SPEED_CHANGE_UI.outerEqualCols} leadingPx={ICON_COL_WIDTH} />
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: ICON_COL_WIDTH }} />
              <TableCell sx={cellTextSx}>
                <TwoLineHeader
                  jp={strings.table.outer.routeId.jp}
                  en={strings.table.outer.routeId.en}
                  level="parent"
                />
              </TableCell>

              <TableCell align="right" sx={cellTextSx}>
                <TwoLineHeader
                  jp={strings.table.metrics.speedKmh}
                  en={strings.table.subheaders.before}
                  level="parent"
                />
              </TableCell>
              <TableCell align="right" sx={cellTextSx}>
                <TwoLineHeader
                  jp={strings.table.metrics.speedKmh}
                  en={strings.table.subheaders.after}
                  level="parent"
                />
              </TableCell>
              <TableCell align="right" sx={cellTextSx}>
                <TwoLineHeader
                  jp={strings.table.metrics.timePerVehicle}
                  en={strings.table.subheaders.before}
                  level="parent"
                />
              </TableCell>
              <TableCell align="right" sx={cellTextSx}>
                <TwoLineHeader
                  jp={strings.table.metrics.timePerVehicle}
                  en={strings.table.subheaders.after}
                  level="parent"
                />
              </TableCell>
              <TableCell align="right" sx={cellTextSx}>
                <TwoLineHeader
                  jp={strings.table.metrics.totalTimeVehicle}
                  en={strings.table.subheaders.before}
                  level="parent"
                />
              </TableCell>
              <TableCell align="right" sx={cellTextSx}>
                <TwoLineHeader
                  jp={strings.table.metrics.totalTimeVehicle}
                  en={strings.table.subheaders.after}
                  level="parent"
                />
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {grouped.map((route) => {
              const isOpen = !!openRows[route.route_id];
              return (
                <React.Fragment key={route.route_id}>
                  <TableRow hover>
                    <TableCell sx={{ width: ICON_COL_WIDTH }}>
                      <IconButton size="small" onClick={() => toggleRow(route.route_id)}>
                        {isOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell sx={cellTextSx}><EllipsisText>{route.route_id}</EllipsisText></TableCell>

                    <TableCell align="right" sx={cellTextSx}>{fmt(route.agg.avg_speed_before, 1)}</TableCell>
                    <TableCell align="right" sx={cellTextSx}>{fmt(route.agg.avg_speed_after, 1)}</TableCell>
                    <TableCell align="right" sx={cellTextSx}>{fmt(route.agg.tpv_before, 4)}</TableCell>
                    <TableCell align="right" sx={cellTextSx}>{fmt(route.agg.tpv_after, 4)}</TableCell>
                    <TableCell align="right" sx={cellTextSx}>{fmt(route.agg.ttv_before, 0)}</TableCell>
                    <TableCell align="right" sx={cellTextSx}>{fmt(route.agg.ttv_after, 0)}</TableCell>
                  </TableRow>

                  {/* ===== LEVEL 1 (Patterns) ===== */}
                  <TableRow>
                    <TableCell colSpan={SPEED_CHANGE_UI.outerColSpan} sx={{ p: 0, pl: INDENT_PER_LEVEL }}>
                      <Collapse in={isOpen} timeout="auto" unmountOnExit>
                        <Box sx={{ py: 1 }}>
                          <Table
                            size="small"
                            sx={{
                              tableLayout: "fixed",
                              width: "100%",
                              minWidth: SPEED_CHANGE_UI.tableMinWidth,
                            }}
                          >
                            <EqualColGroup cols={SPEED_CHANGE_UI.outerEqualCols} leadingPx={ICON_COL_WIDTH_SM} />
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ width: ICON_COL_WIDTH_SM }} />
                                <TableCell sx={cellTextSx}>
                                  <TwoLineHeader
                                    jp={strings.table.inner.patternIdInRoute.jp}
                                    en={strings.table.inner.patternIdInRoute.en}
                                    level="sub"
                                  />
                                </TableCell>
                                <TableCell align="right" sx={cellTextSx}>
                                  <TwoLineHeader
                                    jp={strings.table.metrics.speedKmh}
                                    en={strings.table.subheaders.before}
                                    level="sub"
                                  />
                                </TableCell>
                                <TableCell align="right" sx={cellTextSx}>
                                  <TwoLineHeader
                                    jp={strings.table.metrics.speedKmh}
                                    en={strings.table.subheaders.after}
                                    level="sub"
                                  />
                                </TableCell>
                                <TableCell align="right" sx={cellTextSx}>
                                  <TwoLineHeader
                                    jp={strings.table.metrics.timePerVehicle}
                                    en={strings.table.subheaders.before}
                                    level="sub"
                                  />
                                </TableCell>
                                <TableCell align="right" sx={cellTextSx}>
                                  <TwoLineHeader
                                    jp={strings.table.metrics.timePerVehicle}
                                    en={strings.table.subheaders.after}
                                    level="sub"
                                  />
                                </TableCell>
                                <TableCell align="right" sx={cellTextSx}>
                                  <TwoLineHeader
                                    jp={strings.table.metrics.totalTimeVehicle}
                                    en={strings.table.subheaders.before}
                                    level="sub"
                                  />
                                </TableCell>
                                <TableCell align="right" sx={cellTextSx}>
                                  <TwoLineHeader
                                    jp={strings.table.metrics.totalTimeVehicle}
                                    en={strings.table.subheaders.after}
                                    level="sub"
                                  />
                                </TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {route.patterns.map((p) => {
                                const patKey = `${route.route_id}::${p.pattern_id}::${p.direction_id ?? "null"}`;
                                const isPatOpen = !!openPatterns[patKey];
                                return (
                                  <React.Fragment key={patKey}>
                                    <TableRow hover>
                                      <TableCell sx={{ width: ICON_COL_WIDTH_SM }}>
                                        <IconButton size="small" onClick={() => togglePattern(patKey)}>
                                          {isPatOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                                        </IconButton>
                                      </TableCell>
                                      <TableCell sx={cellTextSx}><EllipsisText>{p.pattern_id}</EllipsisText></TableCell>
                                      <TableCell align="right" sx={cellTextSx}>{fmt(p.agg.avg_speed_before, 1)}</TableCell>
                                      <TableCell align="right" sx={cellTextSx}>{fmt(p.agg.avg_speed_after, 1)}</TableCell>
                                      <TableCell align="right" sx={cellTextSx}>{fmt(p.agg.tpv_before, 2)}</TableCell>
                                      <TableCell align="right" sx={cellTextSx}>{fmt(p.agg.tpv_after, 2)}</TableCell>
                                      <TableCell align="right" sx={cellTextSx}>{fmt(p.agg.ttv_before, 0)}</TableCell>
                                      <TableCell align="right" sx={cellTextSx}>{fmt(p.agg.ttv_after, 0)}</TableCell>
                                    </TableRow>

                                    {/* ===== LEVEL 2 (Segments) ===== */}
                                    <TableRow>
                                      <TableCell
                                        colSpan={SPEED_CHANGE_UI.outerColSpan}
                                        sx={{ p: 0, pl: SPEED_CHANGE_UI.segmentIndentPx }}
                                      >
                                        <Collapse in={isPatOpen} timeout="auto" unmountOnExit>
                                          <Box sx={{ py: 1 }}>
                                            <Table
                                              size="small"
                                              sx={{
                                                tableLayout: "fixed",
                                                width: "100%",
                                                minWidth: SPEED_CHANGE_UI.tableMinWidth,
                                              }}
                                            >
                                              <EqualColGroup cols={SPEED_CHANGE_UI.segmentCols} />
                                              <TableHead>
                                                <TableRow>
                                                  <TableCell sx={cellTextSx}>
                                                    <TwoLineHeader
                                                      jp={strings.table.segments.sectionCode.jp}
                                                      en={strings.table.segments.sectionCode.en}
                                                      level="sub"
                                                    />
                                                  </TableCell>
                                                  <TableCell sx={cellTextSx}>
                                                    <TwoLineHeader
                                                      jp={strings.table.segments.roadName.jp}
                                                      en={strings.table.segments.roadName.en}
                                                      level="sub"
                                                    />
                                                  </TableCell>
                                                  <TableCell align="right" sx={cellTextSx}>
                                                    <TwoLineHeader
                                                      jp={strings.table.metrics.speedKmh}
                                                      en={strings.table.subheaders.before}
                                                      level="sub"
                                                    />
                                                  </TableCell>
                                                  <TableCell align="right" sx={cellTextSx}>
                                                    <TwoLineHeader
                                                      jp={strings.table.metrics.speedKmh}
                                                      en={strings.table.subheaders.after}
                                                      level="sub"
                                                    />
                                                  </TableCell>
                                                  <TableCell align="right" sx={cellTextSx}>
                                                    <TwoLineHeader
                                                      jp={strings.table.metrics.timePerVehicle}
                                                      en={strings.table.subheaders.before}
                                                      level="sub"
                                                    />
                                                  </TableCell>
                                                  <TableCell align="right" sx={cellTextSx}>
                                                    <TwoLineHeader
                                                      jp={strings.table.metrics.timePerVehicle}
                                                      en={strings.table.subheaders.after}
                                                      level="sub"
                                                    />
                                                  </TableCell>
                                                  <TableCell align="right" sx={cellTextSx}>
                                                    <TwoLineHeader
                                                      jp={strings.table.metrics.totalTimeVehicle}
                                                      en={strings.table.subheaders.before}
                                                      level="sub"
                                                    />
                                                  </TableCell>
                                                  <TableCell align="right" sx={cellTextSx}>
                                                    <TwoLineHeader
                                                      jp={strings.table.metrics.totalTimeVehicle}
                                                      en={strings.table.subheaders.after}
                                                      level="sub"
                                                    />
                                                  </TableCell>
                                                </TableRow>
                                              </TableHead>
                                              <TableBody>
                                                {p.rows.map((r) => (
                                                  <TableRow key={r.key} hover>
                                                    <TableCell sx={cellTextSx}>
                                                      <EllipsisText>
                                                        {r.section_code_csv || strings.table.unknownDash}
                                                      </EllipsisText>
                                                    </TableCell>
                                                    <TableCell sx={cellTextSx}>
                                                      <EllipsisText>
                                                        {r.road_name || strings.table.unknownDash}
                                                      </EllipsisText>
                                                    </TableCell>
                                                    <TableCell align="right" sx={cellTextSx}>{fmt(r.speed_before, 1, true)}</TableCell>
                                                    <TableCell align="right" sx={cellTextSx}>{fmt(r.speed_after, 1, true)}</TableCell>
                                                    <TableCell align="right" sx={cellTextSx}>{fmt(r.time_before, 4)}</TableCell>
                                                    <TableCell align="right" sx={cellTextSx}>{fmt(r.time_after, 4)}</TableCell>
                                                    <TableCell align="right" sx={cellTextSx}>{fmt(r.total_before, 0)}</TableCell>
                                                    <TableCell align="right" sx={cellTextSx}>{fmt(r.total_after, 0)}</TableCell>
                                                  </TableRow>
                                                ))}
                                              </TableBody>
                                            </Table>
                                          </Box>
                                        </Collapse>
                                      </TableCell>
                                    </TableRow>
                                  </React.Fragment>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}

            {/* ===== 合計 row ===== */}
            <TableRow>
              <TableCell sx={{ width: ICON_COL_WIDTH }} />
              <TableCell
                sx={(th) => ({
                  fontWeight: 700,
                  background: th.palette.grey[50],
                  borderTop: `1px solid ${th.palette.divider}`,
                  borderBottom: `1px solid ${th.palette.divider}`,
                })}
              >
                {strings.table.totals.total}
              </TableCell>

              <TableCell
                align="right"
                sx={(th) => ({
                  fontWeight: 700,
                  background: th.palette.grey[50],
                  borderTop: `1px solid ${th.palette.divider}`,
                  borderBottom: `1px solid ${th.palette.divider}`,
                })}
              >
                {strings.table.naDash}
              </TableCell>
              <TableCell
                align="right"
                sx={(th) => ({
                  fontWeight: 700,
                  background: th.palette.grey[50],
                  borderTop: `1px solid ${th.palette.divider}`,
                  borderBottom: `1px solid ${th.palette.divider}`,
                })}
              >
                {strings.table.naDash}
              </TableCell>
              <TableCell
                align="right"
                sx={(th) => ({
                  fontWeight: 700,
                  background: th.palette.grey[50],
                  borderTop: `1px solid ${th.palette.divider}`,
                  borderBottom: `1px solid ${th.palette.divider}`,
                })}
              >
                {fmt(totals.tpv_before, 2)}
              </TableCell>
              <TableCell
                align="right"
                sx={(th) => ({
                  fontWeight: 700,
                  background: th.palette.grey[50],
                  borderTop: `1px solid ${th.palette.divider}`,
                  borderBottom: `1px solid ${th.palette.divider}`,
                })}
              >
                {fmt(totals.tpv_after, 2)}
              </TableCell>
              <TableCell
                align="right"
                sx={(th) => ({
                  fontWeight: 700,
                  background: th.palette.grey[50],
                  borderTop: `1px solid ${th.palette.divider}`,
                  borderBottom: `1px solid ${th.palette.divider}`,
                })}
              >
                {fmt(totals.ttv_before, 0)}
              </TableCell>
              <TableCell
                align="right"
                sx={(th) => ({
                  fontWeight: 700,
                  background: th.palette.grey[50],
                  borderTop: `1px solid ${th.palette.divider}`,
                  borderBottom: `1px solid ${th.palette.divider}`,
                })}
              >
                {fmt(totals.ttv_after, 0)}
              </TableCell>
            </TableRow>

            {/* ===== 平均 row (HARMEAN for speed only; others not applicable) ===== */}
            <TableRow>
              <TableCell sx={(th) => ({ width: ICON_COL_WIDTH, background: th.palette.grey[50] })} />
              <TableCell
                sx={(th) => ({
                  fontWeight: 700,
                  background: th.palette.grey[50],
                  borderBottom: `1px solid ${th.palette.divider}`,
                })}
              >
                {strings.table.totals.average}
              </TableCell>
              <TableCell align="right" sx={(th) => ({ fontWeight: 700, background: th.palette.grey[50] })}>
                {fmt(totals.avg_speed_before, 1)}
              </TableCell>
              <TableCell align="right" sx={(th) => ({ fontWeight: 700, background: th.palette.grey[50] })}>
                {fmt(totals.avg_speed_after, 1)}
              </TableCell>
              <TableCell align="right" sx={(th) => ({ fontWeight: 700, background: th.palette.grey[50] })}>
                {strings.table.naDash}
              </TableCell>
              <TableCell align="right" sx={(th) => ({ fontWeight: 700, background: th.palette.grey[50] })}>
                {strings.table.naDash}
              </TableCell>
              <TableCell align="right" sx={(th) => ({ fontWeight: 700, background: th.palette.grey[50] })}>
                {strings.table.naDash}
              </TableCell>
              <TableCell align="right" sx={(th) => ({ fontWeight: 700, background: th.palette.grey[50] })}>
                {strings.table.naDash}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
