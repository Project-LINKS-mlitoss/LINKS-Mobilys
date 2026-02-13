// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import {
  Box,
  Paper,
  Typography,
  Stack,
  Autocomplete,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Snackbar,
  Alert,
  CircularProgress,
  Divider,
  IconButton,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import React, { useEffect, useMemo, useState } from "react";
import { SIMULATION } from "@/strings";
import { useBenefitCalculation } from "./hooks/useBenefitCalculation";

const ALL = "__ALL__";
const INDENT_PER_LEVEL = 6;
const ICON_COL_WIDTH = 48;
const ICON_COL_WIDTH_SM = 40;
const strings = SIMULATION.benefitCalculation;

/* =========================
   Formatters
   ========================= */
// 円 (no unit conversion): used for 6 columns + 計
const fmtJPY = (n) =>
  Number.isFinite(n) ? `${Math.round(n).toLocaleString("ja-JP")}` : "—";

/** 年間内訳: breakdown */
const fmtAnnualItem = (valueK) => {
  if (!Number.isFinite(valueK)) return "—";
  const yen = Math.round(valueK * 1000); // convert to 円/年
  if (Math.abs(yen) < 1000) {
    return `${yen.toLocaleString("ja-JP")}円/年`;
  }
  const k = Math.round(valueK); // 千円/年
  return `${k.toLocaleString("ja-JP")}千円/年`;
};

/** 年間合計: annual total */
const fmtAnnualTotal = (valueK) => {
  if (!Number.isFinite(valueK)) return "—";
  const yen = Math.round(valueK * 1000);
  if (Math.abs(yen) < 1000) {
    return `${yen.toLocaleString("ja-JP")}円/年`;
  }
  const k = Math.round(valueK);
  return `${k.toLocaleString("ja-JP")}千円/年`;
};

const HeadTh = styled(TableCell)(({ theme }) => ({
  fontWeight: 700,
  background: theme.palette.grey[50],
  borderTop: `1px solid ${theme.palette.divider}`,
  borderBottom: `1px solid ${theme.palette.divider}`,
}));
const CellMono = styled(TableCell)(() => ({
  fontVariantNumeric: "tabular-nums",
}));

const cellTextSx = {
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  overflow: "hidden",
  maxWidth: "100%",
};
const EllipsisText = ({ children, title }) => (
  <Box sx={cellTextSx} title={title ?? String(children ?? "")}>
    {children}
  </Box>
);
function TwoLineHeader({ jp, en, level = "parent" }) {
  const hasEn = !!en && en.trim().length > 0;
  const jpColor = level === "parent" ? "text.primary" : "#616161";
  const enColor = level === "parent" ? "text.secondary" : "#9e9e9e";
  return (
    <Box sx={{ minWidth: 0 }} title={`${jp}${hasEn ? " / " + en : ""}`}>
      <Typography
        fontWeight="bold"
        fontSize={14}
        noWrap
        color={jpColor}
        sx={{ overflow: "hidden", textOverflow: "ellipsis" }}
      >
        {jp}
      </Typography>
      <Typography
        fontWeight="bold"
        fontSize={12}
        color={enColor}
        sx={{
          display: "block",
          lineHeight: "16px",
          minHeight: "16px",
          visibility: hasEn ? "visible" : "hidden",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {hasEn ? en : "x"}
      </Typography>
    </Box>
  );
}
const EqualColGroup = ({ cols, leadingPx = 0, trailingAuto = false }) => (
  <colgroup>
    {leadingPx ? <col style={{ width: leadingPx }} /> : null}
    {Array.from({ length: cols }).map((_, i) => (
      <col key={i} style={{ width: `${100 / cols}%` }} />
    ))}
    {trailingAuto ? <col /> : null}
  </colgroup>
);

/* ---------------- NEW: shared definition row ---------------- */
function RowDef({ label, body }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "240px 1fr" },
        gap: 6,
        alignItems: "start",
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography fontWeight="bold" fontSize={14} noWrap>
          {label}
        </Typography>
      </Box>
      <Box sx={{ "& p": { my: 0 } }}>{body}</Box>
    </Box>
  );
}

/* ---------- Explanation box ---------- */
function BenefitExplanation() {
  return (
    <Paper variant="outlined" sx={{ mt: 2, p: 2, borderRadius: 1.5 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        {strings.glossary.title}
      </Typography>
      <Stack
        spacing={2}
        divider={
          <Box sx={{ borderBottom: (t) => `1px solid ${t.palette.divider}` }} />
        }
      >
        <RowDef
          label="走行時間費用（Before）"
          body={<p>現行シナリオの走行時間における費用（単位：千円/年）</p>}
        />
        <RowDef
          label="走行時間費用（After）"
          body={<p>将来シナリオの走行時間における費用（単位：千円/年）</p>}
        />
        <RowDef
          label="走行時間短縮便益"
          body={<p>現行シナリオと将来シナリオの総走行時間に基づく費用の差分（単位：千円/年）</p>}
        />
        <RowDef
          label="走行経費（Before）"
          body={<p>現行シナリオの運行コストのうち、走行時間以外（燃料費やオイル代など）の費用（単位：千円/年）</p>}
        />
        <RowDef
          label="走行経費（After）"
          body={<p>将来シナリオの運行コストのうち、走行時間以外（燃料費やオイル代など）の費用（単位：千円/年）</p>}
        />
        <RowDef
          label="走行経費減少便益"
          body={<p>現行シナリオと将来シナリオの走行経費の差分（単位：千円/年）</p>}
        />
        <RowDef
          label="交通事故損失額（Before）"
          body={<p>現行シナリオの交通事故における損失額（単位：千円/年）</p>}
        />
        <RowDef
          label="交通事故損失額（After）"
          body={<p>将来シナリオの交通事故における損失額（単位：千円/年）</p>}
        />
        <RowDef
          label="交通事故減少便益"
          body={<p>現行シナリオと将来シナリオの交通事故損失額の差分（単位：千円/年）</p>}
        />
      </Stack>
    </Paper>
  );
}

/* ---------------- helpers ---------------- */
function buildGroups(payload, routeId, patternId) {
  const data = payload || {};
  const routes = data.routes || [];
  const selectedRoutes =
    routeId === ALL ? routes : routes.filter((r) => r.route_id === routeId);

  const map = new Map();

  selectedRoutes.forEach((r) => {
    const shapes = r.shapes || [];
    shapes.forEach((s) => {
      const rp = s?.route_pattern || {};
      const pid = rp?.pattern_id ?? s?.pattern_id ?? null;
      if (!pid) return;
      if (patternId !== ALL && String(pid) !== String(patternId)) return;

      const dir = rp?.direction_id ?? s?.direction_id;
      const rows = (s.segments || []).map((seg, idx) => {
        const m = seg.metrics || {};
        const tt = m.travel_time_savings_benefit_yen_per_year || {};
        const oc = m.operating_cost_reduction_benefit_yen_per_year || {};
        const ac = m.traffic_accident_reduction_benefit_yen_per_year || {};
        return {
          key: `${r.route_id}|${pid}|${seg.matchcode_shp ?? idx}`,
          route_id: r.route_id,
          pattern_id: pid,
          direction_id: dir,
          section_code: seg.section_code_csv ?? "",
          matchcode_shp: seg.matchcode_shp ?? "",
          road_name: seg.road_name ?? "",
          tt_before: Number(tt.before ?? 0),
          tt_after: Number(tt.after ?? 0),
          oc_before: Number(oc.before ?? 0),
          oc_after: Number(oc.after ?? 0),
          ac_before: Number(ac.before ?? 0),
          ac_after: Number(ac.after ?? 0),
        };
      });

      const key = `${r.route_id}|${pid}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          route_id: r.route_id,
          pattern_id: pid,
          direction_id: dir,
          rows: [],
        });
      }
      const g = map.get(key);
      g.rows.push(...rows);
      if (g.direction_id !== dir) g.direction_id = undefined;
    });
  });

  return Array.from(map.values());
}

function computeTotals(rows) {
  const sum = (arr, k) =>
    arr.reduce((a, r) => a + (Number.isFinite(r[k]) ? r[k] : 0), 0);

  const tt_before = sum(rows, "tt_before");
  const tt_after = sum(rows, "tt_after");
  const oc_before = sum(rows, "oc_before");
  const oc_after = sum(rows, "oc_after");
  const ac_before = sum(rows, "ac_before");
  const ac_after = sum(rows, "ac_after");

  // Local recompute (for filtered views) — not directly used for display now
  const annual_tt_myen = ((tt_before - tt_after) * 365) / 1_000_000;
  const annual_oc_myen = ((oc_before - oc_after) * 365) / 1_000_000;
  const annual_ac_myen = (ac_before - ac_after) / 1_000_000;
  const annual_total_myen = annual_tt_myen + annual_oc_myen + annual_ac_myen;

  return {
    tt_before,
    tt_after,
    oc_before,
    oc_after,
    ac_before,
    ac_after,
    annual_tt_myen,
    annual_oc_myen,
    annual_ac_myen,
    annual_total_myen,
  };
}

export default function RoadBenefitTab({ simulationId }) {
  const { data, loading, error, clearError } =
    useBenefitCalculation(simulationId);

  const [selectedRoute, setSelectedRoute] = useState(ALL);
  const [selectedPattern, setSelectedPattern] = useState(ALL);
  const [openRoutes, setOpenRoutes] = useState({});
  const [openPatterns, setOpenPatterns] = useState({});

  useEffect(() => {
    setSelectedRoute(ALL);
    setSelectedPattern(ALL);
    setOpenRoutes({});
    setOpenPatterns({});
  }, [simulationId]);

  // Route options
  const routeOptions = useMemo(() => {
    const opts = (data?.routes || []).map((r) => ({
      id: r.route_id,
      label: r.route_id,
    }));
    return [{ id: ALL, label: strings.filters.all }, ...opts];
  }, [data]);

  const patternOptions = useMemo(() => {
    if (selectedRoute === ALL)
      return [{ id: ALL, label: strings.filters.all }];
    const r = (data?.routes || []).find((x) => x.route_id === selectedRoute);
    const uniq = new Map();
    for (const s of r?.shapes || []) {
      const rp = s?.route_pattern || {};
      const pid = rp?.pattern_id ?? s?.pattern_id;
      if (!pid) continue;
      if (!uniq.has(pid)) uniq.set(pid, { id: pid, label: `${pid}` });
    }
    const arr = Array.from(uniq.values()).sort((a, b) =>
      String(a.id).localeCompare(String(b.id))
    );
    return arr.length > 1 ? [{ id: ALL, label: strings.filters.all }, ...arr] : arr;
  }, [data, selectedRoute]);

  // Groups & rows
  const groups = useMemo(
    () => buildGroups(data, selectedRoute, selectedPattern),
    [data, selectedRoute, selectedPattern]
  );
  const rows = useMemo(() => groups.flatMap((g) => g.rows), [groups]);
  const totals = useMemo(() => computeTotals(rows), [rows]);

  // Nested (Route -> Patterns -> Segments)
  const nested = useMemo(() => {
    const byRoute = new Map();
    for (const g of groups) {
      if (!byRoute.has(g.route_id)) byRoute.set(g.route_id, []);
      byRoute.get(g.route_id).push(g);
    }
    const out = [];
    for (const [route_id, gs] of byRoute.entries()) {
      const routeRows = gs.flatMap((x) => x.rows);
      const patterns = gs
        .map((x) => ({
          pattern_id: x.pattern_id,
          direction_id: x.direction_id,
          rows: x.rows,
          agg: computeTotals(x.rows),
        }))
        .sort((a, b) =>
          String(a.pattern_id).localeCompare(String(b.pattern_id))
        );
      out.push({
        route_id,
        patterns,
        agg: computeTotals(routeRows),
      });
    }
    return out.sort((a, b) =>
      String(a.route_id).localeCompare(String(b.route_id))
    );
  }, [groups]);

  // Expand states
  const toggleRoute = (routeId) =>
    setOpenRoutes((p) => ({ ...p, [routeId]: !p[routeId] }));
  const togglePattern = (key) =>
    setOpenPatterns((p) => ({ ...p, [key]: !p[key] }));

  /* === Annual values (千円/年) ===
     BE returns annual_benefits in 千円/年 (components) and annual_total_benefit in 千円.
     When ALL/ALL is selected, prefer API; otherwise compute locally from per-day/year 円 totals.
  */
  const annualForDisplay = useMemo(() => {
    // Local recompute in 千円/年 from 円:
    const localK = {
      tt: ((totals.tt_before - totals.tt_after) * 365) / 1000, // 円→千円
      oc: ((totals.oc_before - totals.oc_after) * 365) / 1000, // 円→千円
      ac: (totals.ac_before - totals.ac_after) / 1000, // 円→千円
    };

    if (
      data &&
      selectedRoute === ALL &&
      selectedPattern === ALL &&
      data.annual_benefits
    ) {
      const v = data.annual_benefits; // already 千円/年
      const api = {
        tt: Number(v.annual_travel_time_savings_benefit),
        oc: Number(v.annual_operating_cost_reduction_benefit),
        ac: Number(v.annual_traffic_accident_reduction_benefit),
      };
      const prefer = (a, b) => (Number.isFinite(a) ? a : b);
      const tt = prefer(api.tt, localK.tt);
      const oc = prefer(api.oc, localK.oc);
      const ac = prefer(api.ac, localK.ac);

      const apiTotal = Number(data.annual_total_benefit); // 千円
      const total = Number.isFinite(apiTotal)
        ? apiTotal
        : Math.round(tt + oc + ac);
      return { tt, oc, ac, total };
    }

    const total = Math.round(localK.tt + localK.oc + localK.ac);
    return { ...localK, total };
  }, [data, selectedRoute, selectedPattern, totals]);

  if (loading) {
    return (
      <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
        <CircularProgress size={24} />
      </Box>
    );
  }
  return (
    <Box sx={{ width: "100%" }}>
      <Stack
        sx={{ mb: 2 }}
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems="center"
      >
        <Autocomplete
          size="small"
          sx={{ minWidth: 220 }}
          disableClearable
          options={routeOptions}
          value={
            routeOptions.find((o) => o.id === selectedRoute) || routeOptions[0]
          }
          onChange={(_, v) => {
            setSelectedRoute(v?.id ?? ALL);
            setSelectedPattern(ALL);
          }}
          renderInput={(p) => <TextField {...p} label={strings.filters.route} />}
        />

        <Autocomplete
          size="small"
          sx={{ minWidth: 220 }}
          disableClearable
          options={patternOptions}
          value={
            patternOptions.find((o) => o.id === selectedPattern) ||
            patternOptions[0]
          }
          onChange={(_, v) => setSelectedPattern(v?.id ?? ALL)}
          disabled={selectedRoute === ALL}
          renderInput={(p) => (
            <TextField {...p} label={strings.filters.pattern} />
          )}
        />
      </Stack>
      <TableContainer
        component={Paper}
        sx={{ overflowX: "auto", borderRadius: 1 }}
      >
        <Table
          size="small"
          sx={{
            minWidth: 1200,
            width: "100%",
            tableLayout: "fixed",
          }}
        >
          <EqualColGroup cols={7} leadingPx={ICON_COL_WIDTH} />
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: ICON_COL_WIDTH }} />
              <TableCell sx={cellTextSx}>
                <TwoLineHeader
                  jp={strings.table.routeId}
                  en="route_id"
                  level="parent"
                />
              </TableCell>
              <TableCell align="right" sx={cellTextSx}>
                <TwoLineHeader
                  jp={strings.table.travelTimeCost}
                  en={strings.table.before}
                  level="parent"
                />
              </TableCell>
              <TableCell align="right" sx={cellTextSx}>
                <TwoLineHeader
                  jp={strings.table.travelTimeCost}
                  en={strings.table.after}
                  level="parent"
                />
              </TableCell>
              <TableCell align="right" sx={cellTextSx}>
                <TwoLineHeader
                  jp={strings.table.operatingCost}
                  en={strings.table.before}
                  level="parent"
                />
              </TableCell>
              <TableCell align="right" sx={cellTextSx}>
                <TwoLineHeader
                  jp={strings.table.operatingCost}
                  en={strings.table.after}
                  level="parent"
                />
              </TableCell>
              <TableCell align="right" sx={cellTextSx}>
                <TwoLineHeader
                  jp={strings.table.accidentLoss}
                  en={strings.table.before}
                  level="parent"
                />
              </TableCell>
              <TableCell align="right" sx={cellTextSx}>
                <TwoLineHeader
                  jp={strings.table.accidentLoss}
                  en={strings.table.after}
                  level="parent"
                />
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {nested.map((route) => {
              const isOpen = !!openRoutes[route.route_id];
              return (
                <React.Fragment key={route.route_id}>
                  <TableRow hover>
                    <TableCell sx={{ width: ICON_COL_WIDTH }}>
                      <IconButton
                        size="small"
                        onClick={() => toggleRoute(route.route_id)}
                      >
                        {isOpen ? (
                          <KeyboardArrowUpIcon />
                        ) : (
                          <KeyboardArrowDownIcon />
                        )}
                      </IconButton>
                    </TableCell>
                    <TableCell sx={cellTextSx}>
                      <EllipsisText>{route.route_id}</EllipsisText>
                    </TableCell>
                    <TableCell align="right" sx={cellTextSx}>
                      {fmtJPY(route.agg.tt_before)}
                    </TableCell>
                    <TableCell align="right" sx={cellTextSx}>
                      {fmtJPY(route.agg.tt_after)}
                    </TableCell>
                    <TableCell align="right" sx={cellTextSx}>
                      {fmtJPY(route.agg.oc_before)}
                    </TableCell>
                    <TableCell align="right" sx={cellTextSx}>
                      {fmtJPY(route.agg.oc_after)}
                    </TableCell>
                    <TableCell align="right" sx={cellTextSx}>
                      {fmtJPY(route.agg.ac_before)}
                    </TableCell>
                    <TableCell align="right" sx={cellTextSx}>
                      {fmtJPY(route.agg.ac_after)}
                    </TableCell>
                  </TableRow>

                  {/* Level 1: Patterns */}
                  <TableRow>
                    <TableCell colSpan={8} sx={{ p: 0, pl: INDENT_PER_LEVEL }}>
                      <Box
                        sx={{
                          py: 1,
                          display: isOpen ? "block" : "none",
                        }}
                      >
                        <Table
                          size="small"
                          sx={{
                            tableLayout: "fixed",
                            width: "100%",
                            minWidth: 1200,
                          }}
                        >
                          <EqualColGroup
                            cols={7}
                            leadingPx={ICON_COL_WIDTH_SM}
                          />
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ width: ICON_COL_WIDTH_SM }} />
                              <TableCell sx={cellTextSx}>
                                <TwoLineHeader
                                  jp="運行パターンID"
                                  level="sub"
                                />
                              </TableCell>
                              <TableCell align="right" sx={cellTextSx}>
                                <TwoLineHeader
                                  jp="走行時間費用（千円/年）"
                                  en="Before"
                                  level="sub"
                                />
                              </TableCell>
                              <TableCell align="right" sx={cellTextSx}>
                                <TwoLineHeader
                                  jp="走行時間費用（千円/年）"
                                  en="After"
                                  level="sub"
                                />
                              </TableCell>
                              <TableCell align="right" sx={cellTextSx}>
                                <TwoLineHeader
                                  jp="走行経費（千円/年）"
                                  en="Before"
                                  level="sub"
                                />
                              </TableCell>
                              <TableCell align="right" sx={cellTextSx}>
                                <TwoLineHeader
                                  jp="走行経費（千円/年）"
                                  en="After"
                                  level="sub"
                                />
                              </TableCell>
                              <TableCell align="right" sx={cellTextSx}>
                                <TwoLineHeader
                                  jp="交通事故損失額（千円/年）"
                                  en="Before"
                                  level="sub"
                                />
                              </TableCell>
                              <TableCell align="right" sx={cellTextSx}>
                                <TwoLineHeader
                                  jp="交通事故損失額（千円/年）"
                                  en="After"
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
                                    <TableCell
                                      sx={{ width: ICON_COL_WIDTH_SM }}
                                    >
                                      <IconButton
                                        size="small"
                                        onClick={() => togglePattern(patKey)}
                                      >
                                        {isPatOpen ? (
                                          <KeyboardArrowUpIcon />
                                        ) : (
                                          <KeyboardArrowDownIcon />
                                        )}
                                      </IconButton>
                                    </TableCell>
                                    <TableCell sx={cellTextSx}>
                                      <EllipsisText>
                                        {p.pattern_id}
                                      </EllipsisText>
                                    </TableCell>
                                    <TableCell align="right" sx={cellTextSx}>
                                      {fmtJPY(p.agg.tt_before)}
                                    </TableCell>
                                    <TableCell align="right" sx={cellTextSx}>
                                      {fmtJPY(p.agg.tt_after)}
                                    </TableCell>
                                    <TableCell align="right" sx={cellTextSx}>
                                      {fmtJPY(p.agg.oc_before)}
                                    </TableCell>
                                    <TableCell align="right" sx={cellTextSx}>
                                      {fmtJPY(p.agg.oc_after)}
                                    </TableCell>
                                    <TableCell align="right" sx={cellTextSx}>
                                      {fmtJPY(p.agg.ac_before)}
                                    </TableCell>
                                    <TableCell align="right" sx={cellTextSx}>
                                      {fmtJPY(p.agg.ac_after)}
                                    </TableCell>
                                  </TableRow>

                                  {/* Level 2: Segments */}
                                  <TableRow>
                                    <TableCell
                                      colSpan={8}
                                      sx={{ p: 0, pl: 10 }}
                                    >
                                      <Box
                                        sx={{
                                          py: 1,
                                          display: isPatOpen
                                            ? "block"
                                            : "none",
                                        }}
                                      >
                                        <Table
                                          size="small"
                                          sx={{
                                            tableLayout: "fixed",
                                            width: "100%",
                                            minWidth: 1200,
                                          }}
                                        >
                                          <EqualColGroup cols={8} />
                                          <TableHead>
                                            <TableRow>
                                              <TableCell sx={cellTextSx}>
                                                <TwoLineHeader
                                                  jp="区間番号"
                                                  level="sub"
                                                />
                                              </TableCell>
                                              <TableCell sx={cellTextSx}>
                                                <TwoLineHeader
                                                  jp="路線名"
                                                  level="sub"
                                                />
                                              </TableCell>
                                              <TableCell
                                                align="right"
                                                sx={cellTextSx}
                                              >
                                                <TwoLineHeader
                                                  jp="走行時間費用（千円/年）"
                                                  en="Before"
                                                  level="sub"
                                                />
                                              </TableCell>
                                              <TableCell
                                                align="right"
                                                sx={cellTextSx}
                                              >
                                                <TwoLineHeader
                                                  jp="走行時間費用（千円/年）"
                                                  en="After"
                                                  level="sub"
                                                />
                                              </TableCell>
                                              <TableCell
                                                align="right"
                                                sx={cellTextSx}
                                              >
                                                <TwoLineHeader
                                                  jp="走行経費（千円/年）"
                                                  en="Before"
                                                  level="sub"
                                                />
                                              </TableCell>
                                              <TableCell
                                                align="right"
                                                sx={cellTextSx}
                                              >
                                                <TwoLineHeader
                                                  jp="走行経費（千円/年）"
                                                  en="After"
                                                  level="sub"
                                                />
                                              </TableCell>
                                              <TableCell
                                                align="right"
                                                sx={cellTextSx}
                                              >
                                                <TwoLineHeader
                                                  jp="交通事故損失額（千円/年）"
                                                  en="Before"
                                                  level="sub"
                                                />
                                              </TableCell>
                                              <TableCell
                                                align="right"
                                                sx={cellTextSx}
                                              >
                                                <TwoLineHeader
                                                  jp="交通事故損失額（千円/年）"
                                                  en="After"
                                                  level="sub"
                                                />
                                              </TableCell>
                                            </TableRow>
                                          </TableHead>
                                          <TableBody>
                                            {p.rows.map((r) => (
                                              <TableRow key={r.key} hover>
                                                <CellMono sx={cellTextSx}>
                                                  <EllipsisText>
                                                    {r.section_code || "—"}
                                                  </EllipsisText>
                                                </CellMono>
                                                <TableCell sx={cellTextSx}>
                                                  <EllipsisText>
                                                    {r.road_name || "—"}
                                                  </EllipsisText>
                                                </TableCell>
                                                <CellMono
                                                  align="right"
                                                  sx={cellTextSx}
                                                >
                                                  {fmtJPY(r.tt_before)}
                                                </CellMono>
                                                <CellMono
                                                  align="right"
                                                  sx={cellTextSx}
                                                >
                                                  {fmtJPY(r.tt_after)}
                                                </CellMono>
                                                <CellMono
                                                  align="right"
                                                  sx={cellTextSx}
                                                >
                                                  {fmtJPY(r.oc_before)}
                                                </CellMono>
                                                <CellMono
                                                  align="right"
                                                  sx={cellTextSx}
                                                >
                                                  {fmtJPY(r.oc_after)}
                                                </CellMono>
                                                <CellMono
                                                  align="right"
                                                  sx={cellTextSx}
                                                >
                                                  {fmtJPY(r.ac_before)}
                                                </CellMono>
                                                <CellMono
                                                  align="right"
                                                  sx={cellTextSx}
                                                >
                                                  {fmtJPY(r.ac_after)}
                                                </CellMono>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </Box>
                                    </TableCell>
                                  </TableRow>
                                </React.Fragment>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </Box>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}

            {/* GRAND TOTAL (filters applied) — display in 円 */}
            <TableRow>
              <TableCell
                sx={(th) => ({
                  width: ICON_COL_WIDTH,
                  background: th.palette.grey[50],
                })}
              />
              <TableCell
                sx={(th) => ({
                  fontWeight: 700,
                  background: th.palette.grey[50],
                  borderTop: `1px solid ${th.palette.divider}`,
                  borderBottom: `1px solid ${th.palette.divider}`,
                })}
              >
                {strings.summary.grandTotal}
              </TableCell>
              <HeadTh align="right">{fmtJPY(totals.tt_before)}</HeadTh>
              <HeadTh align="right">{fmtJPY(totals.tt_after)}</HeadTh>
              <HeadTh align="right">{fmtJPY(totals.oc_before)}</HeadTh>
              <HeadTh align="right">{fmtJPY(totals.oc_after)}</HeadTh>
              <HeadTh align="right">{fmtJPY(totals.ac_before)}</HeadTh>
              <HeadTh align="right">{fmtJPY(totals.ac_after)}</HeadTh>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {/* Difference between before and after value */}
      <Paper variant="outlined" sx={{ p: 2, mt: 2, borderRadius: 2 }}>
        <Box sx={{ mt: 2 }}>
          <Typography fontWeight={700} sx={{ mb: 0.5 }}>
            {strings.summary.diffTitle}
          </Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
            <Typography>
              {strings.summary.travelTimeBenefit}：
              <b>{fmtAnnualItem(annualForDisplay.tt)}</b>
            </Typography>
            <Typography>
              {strings.summary.operatingCostBenefit}：
              <b>{fmtAnnualItem(annualForDisplay.oc)}</b>
            </Typography>
            <Typography>
              {strings.summary.accidentBenefit}：
              <b>{fmtAnnualItem(annualForDisplay.ac)}</b>
            </Typography>
            <Divider flexItem orientation="vertical" />
            <Typography>
              {strings.summary.total}：
              <b>{fmtAnnualTotal(annualForDisplay.total)}</b>
            </Typography>
          </Stack>
        </Box>
      </Paper>

      {/* Explanation box */}
      <BenefitExplanation />

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={clearError}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" variant="filled">
          {String(error)}
        </Alert>
      </Snackbar>
    </Box>
  );
}
