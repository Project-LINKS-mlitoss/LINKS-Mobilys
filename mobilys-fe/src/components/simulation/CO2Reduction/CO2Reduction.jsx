// src/components/simulation/CO2Reduction/CO2Reduction.jsx
import React, { useMemo, useState, useEffect } from "react";
import {
  Typography,
  Table,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  TableHead,
  Box,
  Paper,
  IconButton,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Collapse,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

import LargeTooltip from "../../../components/LargeTooltip";
import { SIMULATION } from "@/strings";
import { CO2_REDUCTION_ALL_ID, CO2_REDUCTION_UI } from "../../../constant/simulationCo2";

const strings = SIMULATION.co2Reduction;

const OUTER_RADIUS = CO2_REDUCTION_UI.outerRadius ?? 12;
const CARD_RADIUS = CO2_REDUCTION_UI.cardRadius ?? 12;
const ICON_COL_WIDTH = CO2_REDUCTION_UI.iconColWidth ?? 56;

// keep header col count if you still want it elsewhere, but this implementation uses explicit OUTER_COLS
// const HEADER_COLS = CO2_REDUCTION_UI.headerCols;

const HeadTh = styled(TableCell)(({ theme }) => ({
  fontWeight: 700,
  background: theme.palette.grey[50],
  borderTop: `1px solid ${theme.palette.divider}`,
  borderBottom: `1px solid ${theme.palette.divider}`,
  paddingTop: theme.spacing(1),
  paddingBottom: theme.spacing(1),
}));

const cellTextSx = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 };

function toNum(v) {
  if (v === null || v === undefined || v === "") return NaN;
  const n = Number(v);
  return Number.isNaN(n) ? NaN : n;
}
function fint(v) {
  const n = toNum(v);
  return Number.isFinite(n) ? Math.round(n).toLocaleString() : strings.table.unknownDash;
}
// NOTE: for CO2 reduction, "smaller is better" could be treated as positive.
// keeping your original red-on-negative style; adjust if you want.
const negStyle = (v) => (toNum(v) < 0 ? { color: "error.main", fontWeight: 600 } : undefined);

function TwoLineHeader({ jp, en }) {
  const hasEn = !!en && en.trim().length > 0;
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography fontWeight="bold" fontSize={14} noWrap sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
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
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {hasEn ? en : "x"}
      </Typography>
    </Box>
  );
}

const H = ({ label, en = "", tip }) => (
  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
    <TwoLineHeader jp={label} en={en} />
    {tip && (
      <LargeTooltip title={tip}>
        <IconButton size="small" sx={{ ml: 0.25 }}>
          <InfoOutlinedIcon fontSize="inherit" />
        </IconButton>
      </LargeTooltip>
    )}
  </Box>
);

const TotalWithTip = ({ value, tip }) => (
  <Box sx={{ display: "inline-flex", alignItems: "center" }}>
    <span>{value}</span>
    {tip && (
      <LargeTooltip title={tip}>
        <IconButton size="small" sx={{ ml: 0.5 }}>
          <InfoOutlinedIcon fontSize="inherit" />
        </IconButton>
      </LargeTooltip>
    )}
  </Box>
);

// ==== Detail ====
function DetailPanel({ co2, route_id }) {
  const safeCo2 = co2 ?? {};
  const detail = strings.detail;

  return (
    <Box
      display="flex"
      gap={3}
      width="100%"
      sx={{ flexDirection: { xs: "column", md: "row" }, alignItems: "stretch", minWidth: 0 }}
    >
      {/* Left: VKT metrics */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: CARD_RADIUS, height: "100%" }}>
          <Typography variant="subtitle1" fontWeight="bold" mb={2}>
            {detail.vktTitle}
          </Typography>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell>
                  <H label={detail.fields.routeId.jp} en={detail.fields.routeId.en} />
                </TableCell>
                <TableCell align="right">{route_id ?? strings.table.unknownDash}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <H label={detail.fields.vktBefore.jp} en={detail.fields.vktBefore.en} />
                </TableCell>
                <TableCell align="right">
                  {fint(safeCo2.vkt_before_km_day)} <Box component="span">{detail.units.vkt}</Box>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <H label={detail.fields.vktAfter.jp} en={detail.fields.vktAfter.en} />
                </TableCell>
                <TableCell align="right">
                  {fint(safeCo2.vkt_after_km_day)} <Box component="span">{detail.units.vkt}</Box>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <H label={detail.fields.vktDelta.jp} en={detail.fields.vktDelta.en} />
                </TableCell>
                <TableCell align="right" sx={negStyle(-safeCo2.delta_vkt_km_day)}>
                  {fint(safeCo2.delta_vkt_km_day)} <Box component="span">{detail.units.vkt}</Box>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Paper>
      </Box>

      {/* Right: CO2 metrics */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: CARD_RADIUS, height: "100%" }}>
          <Typography variant="subtitle1" fontWeight="bold" mb={2}>
            {detail.co2Title}
          </Typography>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell>
                  <H label={detail.fields.ef.jp} en={detail.fields.ef.en} />
                </TableCell>
                <TableCell align="right">
                  {fint(safeCo2.ef_car_g_per_vkm)} <Box component="span">{detail.units.ef}</Box>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <H label={detail.fields.co2Annual.jp} en={detail.fields.co2Annual.en} />
                </TableCell>
                <TableCell align="right">
                  {fint(safeCo2.co2_tons_per_year)} <Box component="span">{detail.units.co2Annual}</Box>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <Divider sx={{ my: 2 }} />
          <Typography variant="body2" color="text.secondary">
            {detail.formulaNote.prefix} <strong>{detail.formulaNote.formula}</strong> {detail.formulaNote.suffix}
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}

function ExpandableRouteRow({ route, isOpen, onToggle }) {
  // icon + route + value = 3 cols
  const OUTER_COLS = 3;

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

        <TableCell sx={cellTextSx}>{route.route_id}</TableCell>

        <TableCell align="right">{fint(route.co2_tons_per_year)}</TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={OUTER_COLS} sx={{ p: 0, borderBottom: 0 }}>
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2, pb: 3, pl: 4 }}>
              <DetailPanel co2={route.co2} route_id={route.route_id} />
              <Box sx={{ mt: 2, height: 1, bgcolor: "divider" }} />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function CO2Reduction({ routes = [] }) {
  const routeOptions = useMemo(() => {
    const list = Array.isArray(routes) ? routes : [];
    const seen = new Set();
    const opts = [{ id: CO2_REDUCTION_ALL_ID, label: strings.filters.all }];
    list.forEach((r) => {
      const id = String(r?.route_id ?? "");
      if (!id || seen.has(id)) return;
      seen.add(id);
      opts.push({ id, label: id });
    });
    return opts;
  }, [routes]);

  const [selectedRoute, setSelectedRoute] = useState(CO2_REDUCTION_ALL_ID);
  const [openMap, setOpenMap] = useState({});

  const nested = useMemo(() => {
    const list = Array.isArray(routes) ? routes : [];
    const src =
      selectedRoute === CO2_REDUCTION_ALL_ID
        ? list
        : list.filter((r) => String(r.route_id) === selectedRoute);

    return src.map((r) => {
      const co2 = r?.co2_reduction || {};
      const row = { ...co2, route_id: co2.route_id ?? r.route_id };
      const routeCO2 = Number(row.co2_tons_per_year) || 0;

      return {
        route_id: String(r.route_id ?? row.route_id ?? ""),
        co2_tons_per_year: routeCO2,
        co2: row,
      };
    });
  }, [routes, selectedRoute]);

  const pageTotal = useMemo(
    () => nested.reduce((sum, r) => sum + (Number(r.co2_tons_per_year) || 0), 0),
    [nested]
  );

  const isAnyOpen = useMemo(() => Object.values(openMap).some(Boolean), [openMap]);

  // Auto-open when selecting a single route from the filter (same UX as other tabs)
  useEffect(() => {
    if (selectedRoute !== CO2_REDUCTION_ALL_ID) {
      setOpenMap((m) => ({ ...m, [selectedRoute]: true }));
    }
  }, [selectedRoute]);

  return (
    <Box sx={{ width: "100%", py: 2 }}>
      {/* Filters */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: CO2_REDUCTION_UI.filterMinWidth ?? 220 }}>
          <InputLabel id="route-filter-label" shrink>
            {strings.filters.routeId}
          </InputLabel>
          <Select
            labelId="route-filter-label"
            value={selectedRoute}
            label={strings.filters.routeId}
            displayEmpty
            renderValue={(v) => (v === CO2_REDUCTION_ALL_ID ? strings.filters.all : v)}
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
                {/* Keep the icon column, like your other expandable tables */}
                <TableCell sx={{ width: ICON_COL_WIDTH }} />

                <TableCell>
                  <H label={strings.table.routeId.jp} en={strings.table.routeId.en} />
                </TableCell>

                <TableCell align="right">
                  <H label={strings.table.co2ReductionHeader(strings.unit)} />
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

              {/* Hide totals while any row is expanded (removes the bottom overlap/“計” line issue) */}
              {!isAnyOpen && (
                <TableRow>
                  <HeadTh sx={{ width: ICON_COL_WIDTH }} />
                  <HeadTh sx={{ fontWeight: 700 }}>{strings.table.total}</HeadTh>
                  <HeadTh align="right" sx={{ fontWeight: 700 }}>
                    <TotalWithTip value={fint(pageTotal)} />
                  </HeadTh>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}