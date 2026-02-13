// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React, { useMemo, useState, useEffect } from "react";
import {
  Typography,
  Table,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  TableHead,
  Divider,
  Box,
  Paper,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
  IconButton,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

import { SIMULATION } from "@/strings";
import {
  OPERATING_ECONOMICS_ALL_ID,
  OPERATING_ECONOMICS_UI,
} from "../../../constant/simulationOperatingEconomics";

const strings = SIMULATION.operatingEconomics;

/* visual constants */
const OUTER_RADIUS = OPERATING_ECONOMICS_UI.outerRadius ?? 12;
const CARD_RADIUS = OPERATING_ECONOMICS_UI.cardRadius ?? 12;
const ICON_COL_WIDTH = OPERATING_ECONOMICS_UI.iconColWidth ?? 56;
const GLOSSARY_LABEL_COL_WIDTH = OPERATING_ECONOMICS_UI.glossaryLabelColWidth ?? 220;

/* helpers */
function toNum(v) {
  if (v === null || v === undefined || v === "") return NaN;
  const n = Number(v);
  return Number.isNaN(n) ? NaN : n;
}
function formatInt(v) {
  const n = toNum(v);
  return Number.isFinite(n)
    ? Math.round(n).toLocaleString("ja-JP")
    : strings.table.unknownDash;
}
function format1(v) {
  const n = toNum(v);
  return Number.isFinite(n) ? n.toFixed(1) : strings.table.unknownDash;
}

// If you later want red for negative, switch this to check toNum(v) < 0 like RidershipChange.
const negStyle = () => undefined;

const HeadTh = styled(TableCell)(({ theme }) => ({
  fontWeight: 700,
  background: theme.palette.grey[50],
  borderTop: `1px solid ${theme.palette.divider}`,
  borderBottom: `1px solid ${theme.palette.divider}`,
  paddingTop: theme.spacing(1),
  paddingBottom: theme.spacing(1),
}));

function TwoLineHeader({ jp, en }) {
  const hasEn = !!en && en.trim().length > 0;
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography fontWeight="bold" fontSize={14} noWrap>
        {jp}
      </Typography>
      <Typography
        fontWeight="bold"
        fontSize={12}
        color="text.secondary"
        sx={{
          lineHeight: "16px",
          minHeight: "16px",
          visibility: hasEn ? "visible" : "hidden",
          whiteSpace: "nowrap",
        }}
      >
        {hasEn ? en : "x"}
      </Typography>
    </Box>
  );
}

const H = ({ label, en = "" }) => (
  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
    <TwoLineHeader jp={label} en={en} />
  </Box>
);

const TotalWithTip = ({ value }) => (
  <Box sx={{ display: "inline-flex", alignItems: "center" }}>
    <span>{value}</span>
  </Box>
);

/* --- Summary panel --- */
function RowDef({ label, body }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          md: `${GLOSSARY_LABEL_COL_WIDTH}px 1fr`,
        },
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

function MetricExplanation() {
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
            body={
              <Typography component="p" sx={{ whiteSpace: "pre-line" }}>
                {item.body}
              </Typography>
            }
          />
        ))}
      </Stack>
    </Paper>
  );
}
/* ------------------------------------------------------- */

function DetailPanel({ row }) {
  const safeRow = row ?? {};
  const fare = safeRow.fare_yen ?? safeRow.fare_override_yen;

  return (
    <Box
      display="flex"
      gap={3}
      width="100%"
      sx={{
        flexDirection: { xs: "column", md: "row" },
        alignItems: "stretch",
        minWidth: 0,
      }}
    >
      {/* Left card */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            borderRadius: CARD_RADIUS,
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Typography variant="subtitle1" fontWeight="bold" mb={2}>
            {strings.detail.titles.conditions}
          </Typography>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell>
                  <H label={strings.detail.fields.routeId.jp} en={strings.detail.fields.routeId.en} />
                </TableCell>
                <TableCell align="right">
                  {safeRow.route_id ?? strings.table.unknownDash}
                </TableCell>
              </TableRow>

              <TableRow>
                <TableCell>
                  <H label={strings.detail.fields.routeLengthKm.jp} en={strings.detail.fields.routeLengthKm.en} />
                </TableCell>
                <TableCell align="right">
                  {format1(safeRow.route_length_km)} <Box component="span">{strings.detail.units.km}</Box>
                </TableCell>
              </TableRow>

              <TableRow>
                <TableCell>
                  <H label={strings.detail.fields.costPerVkm.jp} en={strings.detail.fields.costPerVkm.en} />
                </TableCell>
                <TableCell align="right">
                  {format1(safeRow.cost_per_vkm_yen)}{" "}
                  <Box component="span">{strings.detail.units.yenPerVkm}</Box>
                </TableCell>
              </TableRow>

              <TableRow>
                <TableCell>
                  <H label={strings.detail.fields.fareOd.jp} en={strings.detail.fields.fareOd.en} />
                </TableCell>
                <TableCell align="right">
                  {formatInt(fare)} <Box component="span">{strings.detail.units.yenPerPerson}</Box>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Paper>
      </Box>

      {/* Right card */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            borderRadius: CARD_RADIUS,
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Typography variant="subtitle1" fontWeight="bold" mb={2}>
            {strings.detail.titles.results}
          </Typography>

          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell>
                  <H label={strings.detail.fields.deltaVehicleKm.jp} en={strings.detail.fields.deltaVehicleKm.en} />
                </TableCell>
                <TableCell align="right">
                  {format1(safeRow.delta_vehicle_km_per_day)}{" "}
                  <Box component="span">{strings.detail.units.vkm}</Box>
                </TableCell>
              </TableRow>

              <TableRow>
                <TableCell>
                  <H label={strings.detail.fields.deltaCost.jp} en={strings.detail.fields.deltaCost.en} />
                </TableCell>
                <TableCell align="right" sx={negStyle(safeRow.delta_cost_yen_per_day)}>
                  {formatInt(safeRow.delta_cost_yen_per_day)}{" "}
                  <Box component="span">{strings.detail.units.yenPerDay}</Box>
                </TableCell>
              </TableRow>

              <TableRow>
                <TableCell>
                  <H label={strings.detail.fields.deltaRevenue.jp} en={strings.detail.fields.deltaRevenue.en} />
                </TableCell>
                <TableCell align="right">
                  {formatInt(safeRow.delta_revenue_yen_per_day)}{" "}
                  <Box component="span">{strings.detail.units.yenPerDay}</Box>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" fontWeight="bold" mb={1}>
            {strings.detail.titles.netResult}
          </Typography>

          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell>
                  <H label={strings.detail.fields.netPerDay.jp} en={strings.detail.fields.netPerDay.en} />
                </TableCell>
                <TableCell align="right" sx={negStyle(safeRow.net_per_day_yen)}>
                  {formatInt(safeRow.net_per_day_yen)}{" "}
                  <Box component="span">{strings.detail.units.yenPerDay}</Box>
                </TableCell>
              </TableRow>

              <TableRow>
                <TableCell>
                  <H label={strings.detail.fields.annualized.jp} en={strings.detail.fields.annualized.en} />
                </TableCell>
                <TableCell align="right" sx={negStyle(safeRow.annual_benefit_k_yen)}>
                  {formatInt(safeRow.annual_benefit_k_yen)}{" "}
                  <Box component="span">{strings.detail.units.kYenPerYear}</Box>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Paper>
      </Box>
    </Box>
  );
}

function ExpandableRouteRow({ route, isOpen, onToggle }) {
  // icon + route + 4 numeric = 6 columns total
  const OUTER_COLS = 6;

  const cellTextSxLocal = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

  return (
    <>
      <TableRow hover onClick={onToggle} sx={{ cursor: "pointer" }}>
        <TableCell sx={{ width: ICON_COL_WIDTH }}>
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
        </TableCell>

        <TableCell sx={cellTextSxLocal}>{route.route_id}</TableCell>

        <TableCell align="right" sx={negStyle(route.row?.delta_cost_yen_per_day)}>
          {formatInt(route.row?.delta_cost_yen_per_day)}
        </TableCell>

        <TableCell align="right" sx={negStyle(route.row?.delta_revenue_yen_per_day)}>
          {formatInt(route.row?.delta_revenue_yen_per_day)}
        </TableCell>

        <TableCell align="right" sx={negStyle(route.row?.net_per_day_yen)}>
          {formatInt(route.row?.net_per_day_yen)}
        </TableCell>

        <TableCell align="right" sx={negStyle(route.annual_benefit_k_yen)}>
          {formatInt(route.annual_benefit_k_yen)}
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={OUTER_COLS} sx={{ p: 0, borderBottom: 0 }}>
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2, pb: 3, pl: 4 }}>
              <DetailPanel row={route.row} />
              <Box sx={{ mt: 2, height: 1, bgcolor: "divider" }} />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function OperatingEconomics({ routes = [] }) {
  const routeOptions = useMemo(() => {
    const list = Array.isArray(routes) ? routes : [];
    const seen = new Set();
    const opts = [{ id: OPERATING_ECONOMICS_ALL_ID, label: strings.filters.all }];
    list.forEach((r) => {
      const id = String(r?.route_id ?? "");
      if (!id || seen.has(id)) return;
      seen.add(id);
      opts.push({ id, label: id });
    });
    return opts;
  }, [routes]);

  const [selectedRoute, setSelectedRoute] = useState(OPERATING_ECONOMICS_ALL_ID);
  const [openMap, setOpenMap] = useState({});

  const nested = useMemo(() => {
    const list = Array.isArray(routes) ? routes : [];
    const source =
      selectedRoute === OPERATING_ECONOMICS_ALL_ID
        ? list
        : list.filter((r) => String(r.route_id) === selectedRoute);

    return source.map((r) => {
      const oe = r?.operating_economics || {};
      const row = { ...oe, route_id: oe.route_id ?? r.route_id };
      const routeAnnualK = Number(row.annual_benefit_k_yen) || 0;

      return {
        route_id: String(r.route_id ?? row.route_id ?? ""),
        annual_benefit_k_yen: routeAnnualK,
        row,
      };
    });
  }, [routes, selectedRoute]);

  const pageTotalK = useMemo(
    () => nested.reduce((sum, r) => sum + (Number(r.annual_benefit_k_yen) || 0), 0),
    [nested]
  );

  // Hide totals while any row is expanded (same behavior you wanted in RidershipChange)
  const isAnyOpen = useMemo(() => Object.values(openMap).some(Boolean), [openMap]);

  // Optional: when filtering to a single route, auto-open it (matches your RidershipChange behavior)
  useEffect(() => {
    if (selectedRoute !== OPERATING_ECONOMICS_ALL_ID) {
      setOpenMap((m) => ({ ...m, [selectedRoute]: true }));
    }
  }, [selectedRoute]);

  return (
    <Box sx={{ width: "100%", py: 2 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: OPERATING_ECONOMICS_UI.filterMinWidth ?? 220 }}>
          <InputLabel id="route-filter-label" shrink>
            {strings.filters.routeId}
          </InputLabel>
          <Select
            labelId="route-filter-label"
            value={selectedRoute}
            label={strings.filters.routeId}
            displayEmpty
            renderValue={(v) => (v === OPERATING_ECONOMICS_ALL_ID ? strings.filters.all : v)}
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
                <TableCell sx={{ width: ICON_COL_WIDTH }} />
                <TableCell>
                  <H label={strings.table.columns.routeId.jp} en={strings.table.columns.routeId.en} />
                </TableCell>
                <TableCell align="right">
                  <H label={strings.table.columns.deltaCostPerDay.jp} en={strings.table.columns.deltaCostPerDay.en} />
                </TableCell>
                <TableCell align="right">
                  <H label={strings.table.columns.deltaRevenuePerDay.jp} en={strings.table.columns.deltaRevenuePerDay.en} />
                </TableCell>
                <TableCell align="right">
                  <H label={strings.table.columns.netPerDay.jp} en={strings.table.columns.netPerDay.en} />
                </TableCell>
                <TableCell align="right">
                  <H label={strings.table.columns.annualBenefit.jp} en={strings.table.columns.annualBenefit.en} />
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
                  />
                );
              })}

              {!isAnyOpen && (
                <TableRow>
                  <HeadTh sx={{ width: ICON_COL_WIDTH }} />
                  <HeadTh colSpan={4} align="left" sx={{ fontWeight: 700 }}>
                    {strings.table.totals.total}
                  </HeadTh>
                  <HeadTh align="right" sx={{ fontWeight: 700, ...negStyle(pageTotalK) }}>
                    <TotalWithTip value={formatInt(pageTotalK)} />
                  </HeadTh>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <MetricExplanation />
    </Box>
  );
}