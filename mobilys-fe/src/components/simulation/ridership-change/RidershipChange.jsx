// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React, { useMemo, useState, useEffect } from "react";
import {
  Box,
  Collapse,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

import { SIMULATION } from "@/strings";
import { RIDERSHIP_CHANGE_ALL_ID, RIDERSHIP_CHANGE_UI } from "../../../constant/simulationRidershipChange";

const strings = SIMULATION.ridershipChange;

const OUTER_RADIUS = RIDERSHIP_CHANGE_UI.outerRadius ?? 12;
const CARD_RADIUS = RIDERSHIP_CHANGE_UI.cardRadius ?? 12;
const GLOSSARY_LABEL_COL_WIDTH = RIDERSHIP_CHANGE_UI.glossaryLabelColWidth ?? 220;

const HeadTh = styled(TableCell)(({ theme }) => ({
  fontWeight: 700,
  background: theme.palette.grey[50],
  borderTop: `1px solid ${theme.palette.divider}`,
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const cellTextSx = { whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden", maxWidth: "100%" };

function toNum(v) {
  if (v === null || v === undefined || v === "") return NaN;
  const n = Number(v);
  return Number.isNaN(n) ? NaN : n;
}
function fmtInt(v) {
  const n = toNum(v);
  return Number.isFinite(n) ? Math.round(n).toLocaleString() : strings?.table?.unknownDash ?? "-";
}
function fmt1(v) {
  const n = toNum(v);
  return Number.isFinite(n) ? n.toFixed(1) : strings?.table?.unknownDash ?? "-";
}
const negStyle = (v) => (toNum(v) < 0 ? { color: "error.main", fontWeight: 600 } : undefined);

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

const H = ({ label, en, level = "parent" }) => (
  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
    <TwoLineHeader jp={label} en={en} level={level} />
  </Box>
);

function DetailPanel({ row, sensitivityUp, sensitivityDown }) {
  const safeRow = row ?? {};
  return (
    <Box display="flex" gap={3} width="100%" sx={{ flexDirection: { xs: "column", md: "row" }, alignItems: "stretch", minWidth: 0 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: CARD_RADIUS, height: "100%" }}>
          <Typography variant="subtitle1" fontWeight="bold" mb={2}>
            {strings.detail.titles.conditions}
          </Typography>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell><H label={strings.detail.fields.routeId.jp} en={strings.detail.fields.routeId.en} level="sub" /></TableCell>
                <TableCell align="right">{safeRow.route_id ?? strings.table.unknownDash}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell><H label={strings.detail.fields.baselineTrips.jp} en={strings.detail.fields.baselineTrips.en} level="sub" /></TableCell>
                <TableCell align="right">{fmtInt(safeRow.baseline_trips_per_day)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell><H label={strings.detail.fields.baselineRiders.jp} en={strings.detail.fields.baselineRiders.en} level="sub" /></TableCell>
                <TableCell align="right">{fmtInt(safeRow.baseline_riders_per_day)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell><H label={strings.detail.fields.epsilonInc.jp} en={strings.detail.fields.epsilonInc.en} level="sub" /></TableCell>
                <TableCell align="right">{fmt1(sensitivityUp)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell><H label={strings.detail.fields.epsilonDec.jp} en={strings.detail.fields.epsilonDec.en} level="sub" /></TableCell>
                <TableCell align="right">{fmt1(sensitivityDown)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Paper>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: CARD_RADIUS, height: "100%" }}>
          <Typography variant="subtitle1" fontWeight="bold" mb={2}>
            {strings.detail.titles.results}
          </Typography>
          <Table size="small">
            <TableBody>
              {(() => {
                const B0 = Number(safeRow?.baseline_trips_per_day) || 0;
                const D0 = Number(safeRow?.baseline_riders_per_day) || 0;
                const dB = Number(safeRow?.delta_trips_per_day) || 0;
                const dD = Number(safeRow?.delta_riders_per_day) || 0;
                const B1 = B0 + dB;
                const D1 = D0 + dD;
                return (
                  <>
                    <TableRow>
                      <TableCell><H label={strings.detail.fields.afterTrips.jp} en={strings.detail.fields.afterTrips.en} level="sub" /></TableCell>
                      <TableCell align="right">{fmtInt(B1)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><H label={strings.detail.fields.afterRiders.jp} en={strings.detail.fields.afterRiders.en} level="sub" /></TableCell>
                      <TableCell align="right">{fmtInt(D1)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><H label={strings.detail.fields.deltaTrips.jp} en={strings.detail.fields.deltaTrips.en} level="sub" /></TableCell>
                      <TableCell align="right">{fmtInt(safeRow.delta_trips_per_day)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><H label={strings.detail.fields.deltaRiders.jp} en={strings.detail.fields.deltaRiders.en} level="sub" /></TableCell>
                      <TableCell align="right" sx={negStyle(dD)}>{fmtInt(dD)}</TableCell>
                    </TableRow>
                  </>
                );
              })()}
            </TableBody>
          </Table>
        </Paper>
      </Box>
    </Box>
  );
}

/* Glossary */
function RowDef({ label, body }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: `${GLOSSARY_LABEL_COL_WIDTH}px 1fr` },
        gap: 2,
        alignItems: "start",
      }}
    >
      <Typography fontWeight="bold" fontSize={14} noWrap>{label}</Typography>
      <Box sx={{ "& p": { my: 0 } }}>{body}</Box>
    </Box>
  );
}

function RidershipChangeExplanation() {
  return (
    <Paper variant="outlined" sx={{ mt: 2, p: 2, borderRadius: 1.5 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        {strings.glossary.title}
      </Typography>
      <Stack spacing={2} divider={<Box sx={{ borderBottom: (t) => `1px solid ${t.palette.divider}` }} />}>
        {strings.glossary.items.map((item) => (
          <RowDef
            key={item.label}
            label={item.label}
            body={<Typography component="p" sx={{ whiteSpace: "pre-line" }}>{item.body}</Typography>}
          />
        ))}
      </Stack>
    </Paper>
  );
}

function ExpandableRouteRow({ route, isOpen, onToggle, sensitivityUp, sensitivityDown }) {
  const OUTER_COLS = 6;

  return (
    <>
      <TableRow hover onClick={onToggle} sx={{ cursor: "pointer" }}>
        <TableCell sx={cellTextSx}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              aria-label="expand row"
            >
              {isOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            </IconButton>
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap>{route.route_id}</Typography>
            </Box>
          </Box>
        </TableCell>

        <TableCell align="right">{fmtInt(route.B0)}</TableCell>
        <TableCell align="right">{fmtInt(route.B1)}</TableCell>
        <TableCell align="right">{fmtInt(route.D0)}</TableCell>
        <TableCell align="right">{fmtInt(route.D1)}</TableCell>
        <TableCell align="right" sx={negStyle(route.delta_riders_per_day)}>
          {fmtInt(route.delta_riders_per_day)}
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={OUTER_COLS} sx={{ p: 0, borderBottom: 0 }}>
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2, pb: 3 }}>
              <DetailPanel row={route.row} sensitivityUp={sensitivityUp} sensitivityDown={sensitivityDown} />
              <Box sx={{ mt: 2, height: 1, bgcolor: "divider" }} />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function RidershipChange({ routes = [], sensitivityUp, sensitivityDown }) {
  const routeOptions = useMemo(() => {
    const list = Array.isArray(routes) ? routes : [];
    const seen = new Set();
    const opts = [{ id: RIDERSHIP_CHANGE_ALL_ID, label: strings.filters.all }];
    list.forEach((r) => {
      const id = String(r?.route_id ?? "");
      if (!id || seen.has(id)) return;
      seen.add(id);
      opts.push({ id, label: id });
    });
    return opts;
  }, [routes]);

  const [selectedRoute, setSelectedRoute] = useState(RIDERSHIP_CHANGE_ALL_ID);
  const [openMap, setOpenMap] = useState({});

  const nested = useMemo(() => {
    const list = Array.isArray(routes) ? routes : [];
    const src =
      selectedRoute === RIDERSHIP_CHANGE_ALL_ID
        ? list
        : list.filter((r) => String(r.route_id) === selectedRoute);

    return src.map((r) => {
      const rc = r?.ridership_change || {};
      const row = { ...rc, route_id: rc.route_id ?? r.route_id };

      const B0 = Number(row.baseline_trips_per_day) || 0;
      const D0 = Number(row.baseline_riders_per_day) || 0;
      const dB = Number(row.delta_trips_per_day) || 0;
      const dD = Number(row.delta_riders_per_day) || 0;

      return {
        route_id: String(r.route_id ?? row.route_id ?? ""),
        B0,
        B1: B0 + dB,
        D0,
        D1: D0 + dD,
        delta_riders_per_day: dD,
        row,
      };
    });
  }, [routes, selectedRoute]);

  const pageTotals = useMemo(() => {
    return nested.reduce(
      (t, r) => {
        t.B0 += Number(r.B0) || 0;
        t.B1 += Number(r.B1) || 0;
        t.D0 += Number(r.D0) || 0;
        t.D1 += Number(r.D1) || 0;
        t.dD += Number(r.delta_riders_per_day) || 0;
        return t;
      },
      { B0: 0, B1: 0, D0: 0, D1: 0, dD: 0 }
    );
  }, [nested]);

  // NEW: hide totals while any row is expanded (removes the bottom "計" line in your screenshot)
  const isAnyOpen = useMemo(() => Object.values(openMap).some(Boolean), [openMap]);

  useEffect(() => {
    if (selectedRoute !== RIDERSHIP_CHANGE_ALL_ID) {
      setOpenMap((m) => ({ ...m, [selectedRoute]: true }));
    }
  }, [selectedRoute]);

  return (
    <Box sx={{ width: "100%", py: 2 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: RIDERSHIP_CHANGE_UI.filterMinWidth ?? 220 }}>
          <InputLabel id="route-filter-label" shrink>
            {strings.filters.routeId}
          </InputLabel>
          <Select
            labelId="route-filter-label"
            value={selectedRoute}
            label={strings.filters.routeId}
            displayEmpty
            renderValue={(v) => (v === RIDERSHIP_CHANGE_ALL_ID ? strings.filters.all : v)}
            onChange={(e) => setSelectedRoute(e.target.value)}
          >
            {routeOptions.map((opt) => (
              <MenuItem key={opt.id} value={opt.id}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: OUTER_RADIUS, overflow: "hidden" }}>
        <TableContainer>
          <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
            <TableHead>
              <TableRow>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                    {/* spacer to align with the row chevron */}
                    <Box sx={{ width: 40, flex: "0 0 40px" }} />
                    <Box sx={{ minWidth: 0 }}>
                      <H
                        label={strings.table.outer.routeId.jp}
                        en={strings.table.outer.routeId.en}
                      />
                    </Box>
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <TwoLineHeader jp={strings.table.outer.tripsPerDay.jp} en={strings.table.outer.tripsPerDay.beforeEn} level="sub" />
                </TableCell>
                <TableCell align="right">
                  <TwoLineHeader jp={strings.table.outer.tripsPerDay.jp} en={strings.table.outer.tripsPerDay.afterEn} level="sub" />
                </TableCell>
                <TableCell align="right">
                  <TwoLineHeader jp={strings.table.outer.ridersPerDay.jp} en={strings.table.outer.ridersPerDay.beforeEn} level="sub" />
                </TableCell>
                <TableCell align="right">
                  <TwoLineHeader jp={strings.table.outer.ridersPerDay.jp} en={strings.table.outer.ridersPerDay.afterEn} level="sub" />
                </TableCell>
                <TableCell align="right">
                  <TwoLineHeader jp={strings.table.outer.deltaRidersPerDay.jp} en={strings.table.outer.deltaRidersPerDay.en} level="sub" />
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {nested.map((route) => {
                const isOpen = !!openMap[route.route_id];
                return (
                  <ExpandableRouteRow
                    key={route.route_id}
                    route={route}
                    isOpen={isOpen}
                    onToggle={() => setOpenMap((m) => ({ ...m, [route.route_id]: !m[route.route_id] }))}
                    sensitivityUp={sensitivityUp}
                    sensitivityDown={sensitivityDown}
                  />
                );
              })}

              {!isAnyOpen && (
                <TableRow>
                  <HeadTh>{strings.table.totals.total}</HeadTh>
                  <HeadTh align="right">{fmtInt(pageTotals.B0)}</HeadTh>
                  <HeadTh align="right">{fmtInt(pageTotals.B1)}</HeadTh>
                  <HeadTh align="right">{fmtInt(pageTotals.D0)}</HeadTh>
                  <HeadTh align="right">{fmtInt(pageTotals.D1)}</HeadTh>
                  <HeadTh align="right" sx={{ ...negStyle(pageTotals.dD) }}>{fmtInt(pageTotals.dD)}</HeadTh>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <RidershipChangeExplanation />
    </Box>
  );
}