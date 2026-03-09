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
  Tooltip,
  Snackbar,
  Alert,
  CircularProgress,
  IconButton,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import React, { useEffect, useState, useMemo } from "react";
import { getDetailCarVolumeService } from "../../services/simulationService";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import LargeTooltip from "../../components/LargeTooltip";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

const ALL = "__ALL__";
const INDENT_PER_LEVEL = 6;
const ICON_COL_WIDTH = 48;
const ICON_COL_WIDTH_SM = 40;

// === Number formatters (ja-JP: thousands=comma, decimal=dot) ===
const NF_INT = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });
const NF_1 = new Intl.NumberFormat("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const NF_0_1 = new Intl.NumberFormat("ja-JP", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
const NF_3 = new Intl.NumberFormat("ja-JP", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const dash = "—";

// Helpers
const fmtInt = (n) => (Number.isFinite(n) ? NF_INT.format(Math.round(n)) : dash);
const fmtDecimalFixed = (n) => (Number.isFinite(n) ? NF_0_1.format(n) : dash);
const fmtKmHeader = (m) => (m == null ? dash : NF_1.format(m / 1000));
const fmtKmForDetail = (m) => (m == null ? dash : NF_3.format(m / 1000));

const HeadTh = styled(TableCell)(({ theme }) => ({
  fontWeight: 700,
  background: theme.palette.grey[50],
  borderTop: `1px solid ${theme.palette.divider}`,
  borderBottom: `1px solid ${theme.palette.divider}`,
}));
const CellMono = styled(TableCell)(() => ({ fontVariantNumeric: "tabular-nums" }));

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
      <Typography fontWeight="bold" fontSize={14} noWrap color={jpColor} sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
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

function RowDef({ jp, en, body }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "240px 1fr" }, gap: 1.5, alignItems: "start" }}>
      <Box sx={{ minWidth: 0 }}>
        <TwoLineHeader jp={jp} en={en} level="parent" />
      </Box>
      <Box sx={{ "& p": { my: 0.5 } }}>{body}</Box>
    </Box>
  );
}

function MetricExplanation() {
  return (
    <Paper variant="outlined" sx={{ mt: 2, p: 2, borderRadius: 1.5 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        用語説明
      </Typography>

      <Stack spacing={2} divider={<Box sx={{ borderBottom: (t) => `1px solid ${t.palette.divider}` }} />}>
        <RowDef
          jp="自動車の増減台数"
          en=""
          body={
            <>
              <p>シナリオ変更による自家用車の走行台数の増減数（単位：台/日）</p>
            </>
          }
        />

        <RowDef
          jp="延長"
          en=""
          body={
            <p>対象区間の距離（単位：km）</p>
          }
        />

        <RowDef
          jp="交通量（Before）"
          body={
            <>
              <p>現行シナリオの交通量（単位：台/日）</p>
            </>
          }
        />

        <RowDef
          jp="交通量（After）"
          body={
            <>
              <p>将来シナリオの交通量（単位：台/日）</p>
            </>
          }
        />
        <RowDef
          jp="走行台キロ（Before）"
          body={
            <>
              <p>
                現行シナリオの1日に走行した車両の延べ距離（単位：台キロ/日）<br />
                算出方法：交通量（台）× 延長（km）<br />
                ※計行には各路線で算出した値の合算を表示する
              </p>
            </>
          }
        />
        <RowDef
          jp="走行台キロ（After）"
          body={
            <>
              <p>
                将来シナリオの1日に走行した車両の延べ距離（単位：台キロ/日）<br />
                算出方法：交通量（台）× 延長（km）<br />
                ※計行には各路線で算出した値の合算を表示する
              </p>
            </>
          }
        />
      </Stack>
    </Paper>
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

function buildGroups(d4, routeId, patternId) {
  if (!d4?.routes?.length) return [];
  const selectedRoutes = routeId === ALL ? d4.routes : d4.routes.filter((r) => r.route_id === routeId);

  const groups = [];
  selectedRoutes.forEach((r) => {
    const patterns = r.route_patterns || [];
    const usedPatterns =
      routeId === ALL || patternId === ALL ? patterns : patterns.filter((p) => p.pattern_id === patternId);

    usedPatterns.forEach((p) => {
      const rows = (p.segments || []).map((g) => ({
        route_id: r.route_id,
        route_name: r.route_name,
        pattern_id: p.pattern_id,
        shape_id: p.shape_id,
        direction_id: p.direction_id,
        matchcode_shp: g.matchcode_shp ?? "",
        section_code: g.section_code_csv ?? "",
        road_name: g.road_name ?? "",
        length_m: g.length_m ?? 0,
        before_vol: g.before_cars_per_day ?? 0,
        after_vol: Math.max(Number(g.after_cars_per_day) || 0, 0),
        before_vkm: g.before_vehicle_km_per_day ?? 0,
        after_vkm: Math.max(Number(g.after_vehicle_km_per_day) || 0, 0),
      }));

      groups.push({
        key: `${r.route_id}|${p.pattern_id}`,
        car_change: p.need_cars_per_day,
        route_id: r.route_id,
        route_name: r.route_name,
        pattern_id: p.pattern_id,
        shape_id: p.shape_id,
        direction_id: p.direction_id,
        rows,
      });
    });
  });
  return groups;
}

function computeTotals(rows) {
  const lenSum_m = rows.reduce((a, r) => a + (r.length_m || 0), 0);
  const beforeMax = rows.reduce((a, r) => Math.max(a, r.before_vol || 0), 0);
  const afterMax = rows.reduce((a, r) => Math.max(a, r.after_vol || 0), 0);

  return {
    len_km: lenSum_m / 1000,
    beforeAvg: beforeMax,
    afterAvg: afterMax,
    beforeVkm: rows.reduce((a, r) => a + (r.before_vkm || 0), 0),
    afterVkm: rows.reduce((a, r) => a + (r.after_vkm || 0), 0),
  };
}

export default function VolumeCarTab(simulationId) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [d4, setD4] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(ALL);
  const [selectedPattern, setSelectedPattern] = useState(ALL);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getDetailCarVolumeService(simulationId.simulationId);
        if (!alive) return;
        setD4(res || null);
        setSelectedRoute(ALL);
        setSelectedPattern(ALL);
      } catch (e) {
        setError(String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [simulationId]);

  const routeOptions = useMemo(() => {
    const opts = (d4?.routes || []).map((r) => ({ id: r.route_id, label: r.route_id }));
    return [{ id: ALL, label: "すべて" }, ...opts];
  }, [d4]);

  const patternOptions = useMemo(() => {
    if (selectedRoute === ALL) return [{ id: ALL, label: "すべて" }];
    const r = (d4?.routes || []).find((x) => x.route_id === selectedRoute);
    const patterns = (r?.route_patterns || []).map((p) => ({ id: p.pattern_id, label: `${p.pattern_id}` }));
    return patterns.length > 1 ? [{ id: ALL, label: "すべて" }, ...patterns] : patterns;
  }, [d4, selectedRoute]);

  const groups = useMemo(() => buildGroups(d4, selectedRoute, selectedPattern), [d4, selectedRoute, selectedPattern]);

  const nested = useMemo(() => {
    const map = new Map();
    for (const g of groups) {
      if (!map.has(g.route_id)) map.set(g.route_id, []);
      map.get(g.route_id).push(g);
    }
    const out = [];
    for (const [route_id, gs] of map.entries()) {
      const routeRows = gs.flatMap((x) => x.rows);
      const routeCarChange = gs.reduce((a, g) => a + (Number(g.car_change) || 0), 0);

      const patterns = gs
        .map((x) => ({
          pattern_id: x.pattern_id,
          direction_id: x.direction_id,
          car_change: x.car_change,
          shape_id: x.shape_id,
          rows: x.rows,
          agg: x.rows.length ? computeTotals(x.rows) : null,
          hasRows: x.rows.length > 0,
        }))
        .sort((a, b) => String(a.pattern_id).localeCompare(String(b.pattern_id)));
      out.push({
        route_id,
        car_change: routeCarChange,
        patterns,
        agg: routeRows.length ? computeTotals(routeRows) : null,
        hasSegments: routeRows.length > 0,
      });
    }
    return out.sort((a, b) => String(a.route_id).localeCompare(String(b.route_id)));
  }, [groups]);

  const totals = useMemo(() => {
    const countedRoutes = nested.filter((r) => r.hasSegments);
    const routeCount = countedRoutes.length || 1;

    const carChange = nested.reduce((a, r) => a + (Number(r.car_change) || 0), 0);
    const len_km = countedRoutes.reduce((a, r) => a + (Number(r.agg?.len_km) || 0), 0);

    const beforeAvg = Math.round(
      countedRoutes.reduce((a, r) => a + (Number(r.agg?.beforeAvg) || 0), 0) / routeCount
    );
    const afterAvg = Math.round(
      countedRoutes.reduce((a, r) => a + (Number(r.agg?.afterAvg) || 0), 0) / routeCount
    );

    const beforeVkm = countedRoutes.reduce((a, r) => a + (Number(r.agg?.beforeVkm) || 0), 0);
    const afterVkm = countedRoutes.reduce((a, r) => a + (Number(r.agg?.afterVkm) || 0), 0);

    return { carChange, len_km, beforeAvg, afterAvg, beforeVkm, afterVkm };
  }, [nested]);

  const [openRoutes, setOpenRoutes] = useState({});
  const [openPatterns, setOpenPatterns] = useState({});
  const toggleRoute = (routeId) => setOpenRoutes((p) => ({ ...p, [routeId]: !p[routeId] }));
  const togglePattern = (key) => setOpenPatterns((p) => ({ ...p, [key]: !p[key] }));

  if (loading) {
    return (
      <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%" }}>
      <Stack sx={{ mb: 2 }} direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
        <Autocomplete
          size="small"
          sx={{ minWidth: 220 }}
          disableClearable
          options={routeOptions}
          value={routeOptions.find((o) => o.id === selectedRoute) || routeOptions[0]}
          onChange={(_, v) => {
            setSelectedRoute(v?.id ?? ALL);
            setSelectedPattern(ALL);
          }}
          renderInput={(p) => <TextField {...p} label="路線" />}
        />

        <Autocomplete
          size="small"
          sx={{ minWidth: 220 }}
          disableClearable
          options={patternOptions}
          value={patternOptions.find((o) => o.id === selectedPattern) || patternOptions[0]}
          onChange={(_, v) => setSelectedPattern(v?.id ?? ALL)}
          disabled={selectedRoute === ALL}
          renderInput={(p) => <TextField {...p} label="運行パターン" />}
        />
      </Stack>

      <TableContainer component={Paper} sx={{ overflowX: "auto", borderRadius: 1 }}>
        <Table size="small" sx={{ minWidth: 1200, width: "100%", tableLayout: "fixed" }}>
          <EqualColGroup cols={7} leadingPx={ICON_COL_WIDTH} />
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: ICON_COL_WIDTH }} />
              <TableCell sx={cellTextSx}>
                <TwoLineHeader jp="路線ID" en="route_id" level="parent" />
              </TableCell>
              <TableCell align="right" sx={cellTextSx}>
                <TwoLineHeader jp="自動車の増減台数（台/日）" level="parent" />
              </TableCell>
              <TableCell align="right" sx={cellTextSx}>
                <TwoLineHeader jp="延長（km）" level="parent" />
              </TableCell>
              <TableCell align="right" sx={cellTextSx}>
                <TwoLineHeader jp="交通量（台/日）" en="Before" level="parent" />
              </TableCell>
              <TableCell align="right" sx={cellTextSx}>
                <TwoLineHeader jp="交通量（台/日）" en="After" level="parent" />
              </TableCell>
              <TableCell align="right" sx={cellTextSx}>
                <TwoLineHeader jp="走行台キロ（台キロ/日）" en="Before" level="parent" />
              </TableCell>
              <TableCell align="right" sx={cellTextSx}>
                <TwoLineHeader jp="走行台キロ（台キロ/日）" en="After" level="parent" />
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
                      <IconButton size="small" onClick={() => toggleRoute(route.route_id)}>
                        {isOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell sx={cellTextSx}>
                      <EllipsisText>{route.route_id}</EllipsisText>
                    </TableCell>
                    <TableCell align="right" sx={cellTextSx}>
                      {fmtInt(Number(route.car_change))}
                    </TableCell>
                    <TableCell align="right" sx={cellTextSx}>
                      {route.agg ? fmtKmHeader(route.agg.len_km * 1000) : dash}
                    </TableCell>
                    <TableCell align="right" sx={cellTextSx}>{route.agg ? fmtInt(route.agg.beforeAvg) : dash}</TableCell>
                    <TableCell align="right" sx={cellTextSx}>{route.agg ? fmtInt(route.agg.afterAvg) : dash}</TableCell>
                    <TableCell align="right" sx={cellTextSx}>{route.agg ? fmtInt(route.agg.beforeVkm) : dash}</TableCell>
                    <TableCell align="right" sx={cellTextSx}>{route.agg ? fmtInt(route.agg.afterVkm) : dash}</TableCell>
                  </TableRow>

                  {/* Level 1: Patterns */}
                  <TableRow>
                    <TableCell colSpan={8} sx={{ p: 0, pl: INDENT_PER_LEVEL }}>
                      <Box sx={{ py: 1, display: isOpen ? "block" : "none" }}>
                        <Table size="small" sx={{ tableLayout: "fixed", width: "100%", minWidth: 1200 }}>
                          <EqualColGroup cols={7} leadingPx={ICON_COL_WIDTH_SM} />
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ width: ICON_COL_WIDTH_SM }} />
                              <TableCell sx={cellTextSx}>
                                <TwoLineHeader jp="路線内の運行パターンID" level="sub" />
                              </TableCell>
                              <TableCell align="right" sx={cellTextSx}>
                                <TwoLineHeader jp="自動車の増減台数（台/日）" level="sub" />
                              </TableCell>
                              <TableCell align="right" sx={cellTextSx}>
                                <TwoLineHeader jp="延長（km）" level="sub" />
                              </TableCell>
                              <TableCell align="right" sx={cellTextSx}>
                                <TwoLineHeader jp="交通量（台/日）" en="Before" level="sub" />
                              </TableCell>
                              <TableCell align="right" sx={cellTextSx}>
                                <TwoLineHeader jp="交通量（台/日）" en="After" level="sub" />
                              </TableCell>
                              <TableCell align="right" sx={cellTextSx}>
                                <TwoLineHeader jp="走行台キロ（台キロ/日）" en="Before" level="sub" />
                              </TableCell>
                              <TableCell align="right" sx={cellTextSx}>
                                <TwoLineHeader jp="走行台キロ（台キロ/日）" en="After" level="sub" />
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
                                    <TableCell sx={cellTextSx}>
                                      <EllipsisText>{p.pattern_id}</EllipsisText>
                                    </TableCell>
                                    <TableCell align="right" sx={cellTextSx}>{fmtInt(Number(p.car_change))}</TableCell>
                                    <TableCell align="right" sx={cellTextSx}>{p.agg ? fmtKmHeader(p.agg.len_km * 1000) : dash}</TableCell>
                                    <TableCell align="right" sx={cellTextSx}>{p.agg ? fmtInt(p.agg.beforeAvg) : dash}</TableCell>
                                    <TableCell align="right" sx={cellTextSx}>{p.agg ? fmtInt(p.agg.afterAvg) : dash}</TableCell>
                                    <TableCell align="right" sx={cellTextSx}>{p.agg ? fmtInt(p.agg.beforeVkm) : dash}</TableCell>
                                    <TableCell align="right" sx={cellTextSx}>{p.agg ? fmtInt(p.agg.afterVkm) : dash}</TableCell>
                                  </TableRow>

                                  {/* Level 2: Segments */}
                                  <TableRow>
                                    <TableCell colSpan={8} sx={{ p: 0, pl: 10 }}>
                                      <Box sx={{ py: 1, display: isPatOpen ? "block" : "none" }}>
                                        <Table size="small" sx={{ tableLayout: "fixed", width: "100%", minWidth: 1200 }}>
                                          <EqualColGroup cols={7} />
                                          <TableHead>
                                            <TableRow>
                                              <TableCell sx={cellTextSx}>
                                                <TwoLineHeader jp="区間番号" level="sub" />
                                              </TableCell>
                                              <TableCell sx={cellTextSx}>
                                                <TwoLineHeader jp="路線名" level="sub" />
                                              </TableCell>
                                              <TableCell align="right" sx={cellTextSx}>
                                                <TwoLineHeader jp="延長（km）" level="sub" />
                                              </TableCell>
                                              <TableCell align="right" sx={cellTextSx}>
                                                <TwoLineHeader jp="交通量（台/日）" en="Before" level="sub" />
                                              </TableCell>
                                              <TableCell align="right" sx={cellTextSx}>
                                                <TwoLineHeader jp="交通量（台/日）" en="After" level="sub" />
                                              </TableCell>
                                              <TableCell align="right" sx={cellTextSx}>
                                                <TwoLineHeader jp="走行台キロ（台キロ/日）" en="Before" level="sub" />
                                              </TableCell>
                                              <TableCell align="right" sx={cellTextSx}>
                                                <TwoLineHeader jp="走行台キロ（台キロ/日）" en="After" level="sub" />
                                              </TableCell>
                                            </TableRow>
                                          </TableHead>
                                          <TableBody>
                                            {p.rows.map((r, i) => (
                                              <TableRow key={`${patKey}-${r.matchcode_shp}-${i}`} hover>
                                                <TableCell sx={cellTextSx}>
                                                  <EllipsisText>{r.section_code || dash}</EllipsisText>
                                                </TableCell>
                                                <TableCell sx={cellTextSx}>
                                                  <EllipsisText>{r.road_name || "—"}</EllipsisText>
                                                </TableCell>
                                                <CellMono align="right" sx={cellTextSx}>{fmtKmForDetail(r.length_m)}</CellMono>
                                                <CellMono align="right" sx={cellTextSx}>{fmtInt(r.before_vol)}</CellMono>
                                                <CellMono align="right" sx={cellTextSx}>{fmtInt(r.after_vol)}</CellMono>
                                                <CellMono align="right" sx={cellTextSx}>{fmtInt(r.before_vkm)}</CellMono>
                                                <CellMono align="right" sx={cellTextSx}>{fmtInt(r.after_vkm)}</CellMono>
                                              </TableRow>
                                            ))}
                                            {!p.rows.length && (
                                              <TableRow>
                                                <TableCell colSpan={7} align="center" sx={{ color: "text.secondary", py: 2 }}>
                                                  セグメントがありません
                                                </TableCell>
                                              </TableRow>
                                            )}
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

            {/* Totals & Averages */}
            <TableRow>
              <TableCell sx={(th) => ({ width: ICON_COL_WIDTH, background: th.palette.grey[50] })} />
              <TableCell
                sx={(th) => ({
                  fontWeight: 700,
                  background: th.palette.grey[50],
                  borderTop: `1px solid ${th.palette.divider}`,
                  borderBottom: `1px solid ${th.palette.divider}`,
                })}
              >
                計
              </TableCell>

              <HeadTh align="right">
                {fmtInt(totals.carChange)}
              </HeadTh>

              <HeadTh align="right">
                {Number.isFinite(totals.len_km) ? NF_0_1.format(totals.len_km) : dash}
              </HeadTh>

              <HeadTh align="right">—</HeadTh>
              <HeadTh align="right">—</HeadTh>

              <HeadTh align="right">
                {fmtInt(totals.beforeVkm)}
              </HeadTh>

              <HeadTh align="right">
                {fmtInt(totals.afterVkm)}
              </HeadTh>
            </TableRow>

            <TableRow>
              <TableCell sx={(th) => ({ width: ICON_COL_WIDTH, background: th.palette.grey[50] })} />
              <TableCell
                sx={(th) => ({
                  fontWeight: 700,
                  background: th.palette.grey[50],
                  borderBottom: `1px solid ${th.palette.divider}`,
                })}
              >
                平均
              </TableCell>

              <HeadTh align="right">—</HeadTh>
              <HeadTh align="right">—</HeadTh>
              <HeadTh align="right">{fmtInt(totals.beforeAvg)}</HeadTh>
              <HeadTh align="right">{fmtInt(totals.afterAvg)}</HeadTh>
              <HeadTh align="right">—</HeadTh>
              <HeadTh align="right">—</HeadTh>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <MetricExplanation />

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError("")}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" variant="filled">
          {String(error)}
        </Alert>
      </Snackbar>
    </Box>
  );
}
