// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  Box,
  Paper,
  FormControl,
  FormLabel,
  Select,
  MenuItem,
  InputLabel,
  Stack,
  Slider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Collapse,
  AppBar,
  Toolbar,
  DialogContent,
} from "@mui/material";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { downloadElementAsPng } from "../export/html2canvasExport";
import { buildFilename } from "../buildFilename";
import { VISUALIZATION } from "@/strings";

const normalizeRouteId = (v) => {
  if (typeof v !== "string") return v;
  return v.replace(/\s+/g, " ").trim();
};

// Slider marks
const timeMarks = [
  { value: 0, label: `0${VISUALIZATION.common.time.hourSuffix}` },
  { value: 6, label: `6${VISUALIZATION.common.time.hourSuffix}` },
  { value: 12, label: `12${VISUALIZATION.common.time.hourSuffix}` },
  { value: 18, label: `18${VISUALIZATION.common.time.hourSuffix}` },
  { value: 24, label: `24${VISUALIZATION.common.time.hourSuffix}` },
];

const formatTimeRangeText = ([s, e]) => `${s}:00 - ${e}:00`;

/* ===============================
 * Graph Component (NEW)
 * =============================== */
function HourlySegmentGraph({
  graphData,
  timeRange = [0, 24],
  selectedMode = "in_car",
  scenarioName,
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const chartFsRef = useRef(null);

  // Guard
  const rawSeries = Array.isArray(graphData?.series) ? graphData.series : [];

  // Filter by time range [start, end)
  const [startH, endH] = Array.isArray(timeRange) ? timeRange : [0, 24];

  const series = useMemo(() => {
    const parseH = (t) => {
      if (!t) return 0;
      const hh = String(t).split(":")[0];
      const n = Number(hh);
      return Number.isFinite(n) ? n : 0;
    };
    return rawSeries
      .map((d) => {
        const h = parseH(d.time);
        return {
          ...d,
          hour: h,
          label: `${h}${VISUALIZATION.common.time.hourSuffix}`,
        };
      })
      .filter((d) => d.hour >= startH && d.hour < endH);
  }, [rawSeries, startH, endH]);

  // Compute stats from filtered series when not provided
  const computed = useMemo(() => {
    if (series.length === 0) {
      return { average: 0, maximum: 0, total: 0 };
    }
    const total = series.reduce((s, d) => s + (Number(d.value) || 0), 0);
    const maximum = Math.max(...series.map((d) => Number(d.value) || 0));
    const average = total / series.length;
    return { average, maximum, total };
  }, [series]);

  const stats = {
    average:
      graphData?.stats?.average != null ? graphData.stats.average : computed.average,
    maximum:
      graphData?.stats?.maximum != null ? graphData.stats.maximum : computed.maximum,
    total:
      graphData?.stats?.total != null ? graphData.stats.total : computed.total,
  };

  // Y-axis max for a nicer headroom
  const yMax = useMemo(() => {
    const maxVal = Math.max(0, ...series.map((d) => Number(d.value) || 0));
    if (maxVal <= 10) return 10;
    // round up to nearest 50
    const step = 50;
    return Math.ceil(maxVal / step) * step;
  }, [series]);

  // Determine label and color based on mode
  const modeConfig = {
    in_car: {
      label:
        VISUALIZATION.boardingAlightingAnalysis.components.routeSegmentVisualization
          .series.inVehicle,
      color: "#f59e0b", // orange
    },
    boarding: {
      label:
        VISUALIZATION.boardingAlightingAnalysis.components.routeSegmentVisualization
          .series.boarding,
      color: "#1976d2", // blue
    },
    alighting: {
      label:
        VISUALIZATION.boardingAlightingAnalysis.components.routeSegmentVisualization
          .series.alighting,
      color: "#e53935", // red
    },
  };
  const { label: modeLabel, color: chartColor } = modeConfig[selectedMode] || modeConfig.in_car;

  // Tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const p = payload[0]?.payload;
      return (
        <Box sx={{ p: 1, bgcolor: "#fff", border: "1px solid #ddd" }}>
          <div><strong>{p?.label}</strong></div>
          <div>{modeLabel}: {p?.value ?? 0}</div>
        </Box>
      );
    }
    return null;
  };

  // Download PNG handler
      const handleDownloadImage = async () => {
    const wrapper = document.getElementById("chart-download-wrapper");
    if (!wrapper) return;

    const scenario = scenarioName || VISUALIZATION.common.scenarioFallbackName;
    const graphName = `${VISUALIZATION.boardingAlightingAnalysis.visualizationOptions.segmentUsersByTime}_${VISUALIZATION.boardingAlightingAnalysis.components.routeSegmentVisualization.title}`;
    const filename = buildFilename(
      scenario,
      VISUALIZATION.boardingAlightingAnalysis.exports.screenName,
      "graph",
      graphName,
      "png"
    );

    await downloadElementAsPng({
      element: wrapper,
      filename,
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      expandToScroll: true,
    });
  };

  const chartContent = (
    <Paper
      variant="outlined"
      sx={{
        mt: 2,
        borderRadius: 2,
        overflow: "visible",
        border: "1px solid #e0e0e0",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 2,
          borderBottom: expanded ? "1px solid #ffffffff" : "none",
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
        }}
      >
        <Typography
          sx={{
            fontSize: 18,
            fontWeight: 700,
            color: "#111827",
          }}
        >
          {VISUALIZATION.boardingAlightingAnalysis.components.routeSegmentVisualization.title}
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          {/* Fullscreen button */}
          <IconButton
            size="small"
            onClick={() => setFullscreen(true)}
            sx={{
              color: "#666",
              "&:hover": { bgcolor: "#e0e0e0" }
            }}
            aria-label="Fullscreen"
          >
          <span class="material-symbols-outlined outlined">
          fullscreen
          </span>
          </IconButton>
          {/* Expand/Collapse button */}
          <IconButton
            size="small"
            onClick={() => setExpanded(!expanded)}
            sx={{
              color: "#666",
              "&:hover": { bgcolor: "#e0e0e0" }
            }}
            aria-label="Toggle expand"
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ p: 2 }}>
          <Typography sx={{ fontWeight: 600, mb: 1.5 }}>
            {graphData?.segment.from_keyword || "-"} ~ {graphData?.segment.to_keyword || "-"}
          </Typography>
          <Box sx={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={series} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12 }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  domain={[0, yMax]}
                  tick={{ fontSize: 12 }}
                  label={{ value: modeLabel, angle: -90, position: "insideLeft", offset: 8 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  wrapperStyle={{ paddingBottom: 8 }}
                  formatter={() => modeLabel}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={modeLabel}
                  stroke={chartColor}
                  strokeWidth={3}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
          {/* Stats table */}
          <Box sx={{ mt: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.table.metric}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{modeLabel}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>
                    {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.table.average}
                  </TableCell>
                  <TableCell>{Math.round(stats.average)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.table.max}
                  </TableCell>
                  <TableCell>{stats.maximum}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.table.total}
                  </TableCell>
                  <TableCell>{stats.total}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );

  return (
    <>
      {chartContent}
      <Dialog
        open={fullscreen}
        onClose={() => setFullscreen(false)}
        maxWidth={false}
        fullScreen
        sx={{
          zIndex: (theme) => (theme.zIndex?.modal ?? 1300) + 10000,
        }}
        BackdropProps={{
          sx: {
            zIndex: (theme) => (theme.zIndex?.modal ?? 1300) + 9999,
          },
        }}
        PaperProps={{
          sx: {
            bgcolor: "#fff",
            position: "relative",
            zIndex: (theme) => (theme.zIndex?.modal ?? 1300) + 10000,
          },
        }}
      >
        <AppBar sx={{ position: "relative", bgcolor: "background.paper", color: "inherit", boxShadow: 3 }}>
          <Toolbar>
            <IconButton edge="start" onClick={() => setFullscreen(false)}>
              <CloseIcon />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" fontWeight="bold">
              {VISUALIZATION.boardingAlightingAnalysis.components.routeSegmentVisualization.title}
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <IconButton onClick={handleDownloadImage} size="small" title="Download PNG">
                <span class="material-symbols-outlined outlined" style ={{ fontSize: 45 }}>
                  file_png
                </span>
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>
        <DialogContent sx={{ p: 0, m: 0, height: "calc(100vh - 64px)", bgcolor: "#fff" }}>
          <Box
            id="chart-download-wrapper"
            sx={{
              px: 6,
              pt: 4,
              pb: 2,
            }}
          >
            <Typography sx={{ fontWeight: 600, mb: 1.5 }}>
              {graphData?.segment.from_keyword || "-"} ~ {graphData?.segment.to_keyword || "-"}
            </Typography>
            <Box
              ref={chartFsRef}
              sx={{
                width: "100vw",
                height: "60vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ResponsiveContainer width="95%" height="100%">
                <LineChart data={series} margin={{ top: 0, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 18 }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis
                    domain={[0, yMax]}
                    tick={{ fontSize: 18 }}
                    label={{ value: modeLabel, angle: -90, position: "insideLeft", offset: 8, fontSize: 20 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="top"
                    wrapperStyle={{ paddingBottom: 8, fontSize: 18 }}
                    formatter={() => modeLabel}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name={modeLabel}
                    stroke={chartColor}
                    strokeWidth={5}
                    dot={{ r: 6 }}
                    activeDot={{ r: 10 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Box>
            {/* Stats table in fullscreen */}
            <Box sx={{ mt: 3, pb: 6 }}>
              <Table size="medium">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: 18 }}>
                      {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.table.metric}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 18 }}>{modeLabel}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontSize: 16 }}>
                      {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.table.average}
                    </TableCell>
                    <TableCell sx={{ fontSize: 16 }}>{Math.round(stats.average)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontSize: 16 }}>
                      {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.table.max}
                    </TableCell>
                    <TableCell sx={{ fontSize: 16 }}>{stats.maximum}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontSize: 16 }}>
                      {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.table.total}
                    </TableCell>
                    <TableCell sx={{ fontSize: 16 }}>{stats.total}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ===============================
 * Main Component (existing)
 * =============================== */
export default function RouteSegmentVisualization({
  disabled = false,
  boardingAlightingData,
  onChange,

  selectedDate,
  setSelectedDate,
  selectedRouteGroup,
  setSelectedRouteGroup,
  selectedRoute,
  setSelectedRoute,
  selectedTrip,
  setSelectedTrip,
  selectedMode,

  selectedTimeRange,          // now expected as [startHour, endHour], e.g. [0,24]
  setSelectedTimeRange,

  routeSegmentFilterData = [],
  routeSegmentGraphData = [],
  scenarioName,
}) {
  const allFilter = VISUALIZATION.common.filters.all;

  /** === ROUTE GROUP === **/
  const rawGroupList = useMemo(() => {
    if (!Array.isArray(routeSegmentFilterData)) return [allFilter];
    return [
      allFilter,
      ...routeSegmentFilterData.map((g) => g.route_group).filter(Boolean),
    ];
  }, [routeSegmentFilterData]);

  /** === DATE OPTIONS === **/
  const dateOptions = useMemo(() => {
    const dates = Array.isArray(boardingAlightingData)
      ? Array.from(
          new Set(
            boardingAlightingData.map((d) => d?.date).filter(Boolean)
          )
        )
      : [];
    return [allFilter, ...dates];
  }, [boardingAlightingData]);

  /** === LOCAL STATES (non-time) === **/
  const [metric, setMetric] = useState("in_car"); 

  // ensure selected values exist
  useEffect(() => {
    if (!selectedRouteGroup) setSelectedRouteGroup?.(allFilter);
    if (!selectedRoute) setSelectedRoute?.(allFilter);
    if (!selectedTrip) setSelectedTrip?.(allFilter);
    if (!selectedDate) setSelectedDate?.(allFilter);
    if (
      !Array.isArray(selectedTimeRange) ||
      selectedTimeRange.length !== 2
    ) {
      setSelectedTimeRange?.([0, 24]);
    }
  }, []);

  /** === ROUTE OPTIONS (distinct) === **/
  const routeOptions = useMemo(() => {
    if (
      !Array.isArray(routeSegmentFilterData) ||
      !selectedRouteGroup ||
      selectedRouteGroup === allFilter
    ) {
      return [{ id: allFilter, name: allFilter }];
    }
    const groupObj = routeSegmentFilterData.find(
      (g) => g.route_group === selectedRouteGroup
    );
    if (!groupObj || !Array.isArray(groupObj.routes)) {
      return [{ id: allFilter, name: allFilter }];
    }
    const uniq = new Map();
    groupObj.routes.forEach((r) => {
      const id = r.route_id;
      if (!id) return;
      if (!uniq.has(id)) uniq.set(id, { id, name: id });
    });
    return [{ id: allFilter, name: allFilter }, ...Array.from(uniq.values())];
  }, [routeSegmentFilterData, selectedRouteGroup]);

  // Reset route & trip when group changes
  useEffect(() => {
    setSelectedRoute?.(allFilter);
    setSelectedTrip?.(allFilter);
  }, [selectedRouteGroup]);

  // Ensure selectedRoute remains valid when route options change
  useEffect(() => {
    if (!routeOptions.length) return;
    const ids = routeOptions.map((r) => r.id);
    if (!ids.includes(selectedRoute)) {
      setSelectedRoute?.(allFilter);
      setSelectedTrip?.(allFilter);
    }
  }, [routeOptions, selectedRoute]);

  /** === TRIP OPTIONS === **/
  const tripOptions = useMemo(() => {
    if (
      !Array.isArray(routeSegmentFilterData) ||
      !selectedRouteGroup ||
      selectedRouteGroup === allFilter ||
      !selectedRoute ||
      selectedRoute === allFilter
    ) {
      return [{ id: allFilter, name: allFilter }];
    }
    const groupObj = routeSegmentFilterData.find(
      (g) => g.route_group === selectedRouteGroup
    );
    if (!groupObj || !Array.isArray(groupObj.routes)) {
      return [{ id: allFilter, name: allFilter }];
    }
    const routeObj = groupObj.routes.find((r) => r.route_id === selectedRoute);
    if (!routeObj || !Array.isArray(routeObj.trips)) {
      return [{ id: allFilter, name: allFilter }];
    }
    const uniq = new Map();
    routeObj.trips.forEach((tid) => {
      if (!tid) return;
      if (!uniq.has(tid)) uniq.set(tid, { id: tid, name: tid });
    });
    return [{ id: allFilter, name: allFilter }, ...Array.from(uniq.values())];
  }, [routeSegmentFilterData, selectedRouteGroup, selectedRoute]);

  /** === HELPERS === **/
  function formatDateOption(dateStr) {
    if (!dateStr || dateStr === allFilter) return dateStr;
    const y = String(dateStr).slice(0, 4);
    const m = String(dateStr).slice(4, 6);
    const d = String(dateStr).slice(6, 8);
    const dateObj = new Date(`${y}-${m}-${d}`);
    const days = VISUALIZATION.common.weekdays.short;
    const dayKanji = days[dateObj.getDay()];
    return `${y}/${m}/${d} (${dayKanji})`;
  }

  const timeRange = useMemo(() => {
    if (Array.isArray(selectedTimeRange)) return selectedTimeRange;
    if (
      selectedTimeRange &&
      typeof selectedTimeRange === "object" &&
      "start_time" in selectedTimeRange &&
      "end_time" in selectedTimeRange
    ) {
      // Convert "HH:MM:SS" to hour number
      const parseHour = (s) => Number(String(s).split(":")[0]) || 0;
      return [
        parseHour(selectedTimeRange.start_time),
        parseHour(selectedTimeRange.end_time),
      ];
    }
    return [0, 24];
  }, [selectedTimeRange]);

  return (
    <>
      {/* === FORM === */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack spacing={2.5}>
          {/* Time range (Slider) */}
          <FormControl component="fieldset" disabled={disabled} sx={{ mb: 1 }}>
            <FormLabel sx={{ mb: 1, fontWeight: 500, fontSize: 15 }}>
              {VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.form.timeRange}{" "}
              {formatTimeRangeText(timeRange)}
            </FormLabel>
            <Box sx={{ px: 1.5, py: 2 }}>
              <Slider
                value={timeRange}
                min={0}
                max={24}
                step={1}
                marks={timeMarks}
                disableSwap
                valueLabelDisplay="auto"
                getAriaLabel={() => "time range"}
                getAriaValueText={(v) => `${v}${VISUALIZATION.common.time.hourSuffix}`}
                valueLabelFormat={(v) => `${v}${VISUALIZATION.common.time.hourSuffix}`}
                onChange={(_, v) => {
                  if (Array.isArray(v)) {
                    // Convert to format { start_time, end_time }
                    const pad = (n) => String(n).padStart(2, "0");
                    setSelectedTimeRange?.({
                      start_time: `${pad(v[0])}:00:00`,
                      end_time: `${pad(v[1])}:00:00`,
                    });
                  }
                }}
                sx={{
                  "& .MuiSlider-thumb": { width: 24, height: 24 },
                  "& .MuiSlider-markLabel": { mt: 1 },
                }}
              />
            </Box>
          </FormControl>

          {/* Date */}
          <FormControl fullWidth disabled={disabled}>
            <FormLabel sx={{ mb: 1 }}>
              {VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.form.date}
            </FormLabel>
            <Select
              value={selectedDate ?? allFilter}
              onChange={(e) => {
                setSelectedDate?.(e.target.value);
              }}
            >
              {dateOptions.length > 0
                ? dateOptions.map((d) => (
                    <MenuItem key={d} value={d}>
                      {formatDateOption(d)}
                    </MenuItem>
                  ))
                : (
                  <MenuItem value={selectedDate ?? allFilter}>
                    {formatDateOption(selectedDate ?? allFilter)}
                  </MenuItem>
                )}
            </Select>
          </FormControl>

          {/* Route Group */}
          <FormControl fullWidth disabled={disabled}>
            <InputLabel id="route-group-label">
              {VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.form.routeGroup}
            </InputLabel>
            <Select
              labelId="route-group-label"
              label={VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.form.routeGroup}
              value={selectedRouteGroup ?? allFilter}
              onChange={(e) => setSelectedRouteGroup?.(e.target.value)}
            >
              {rawGroupList.map((g) => (
                <MenuItem key={g} value={g}>
                  {g}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Route */}
          {selectedRouteGroup && selectedRouteGroup !== allFilter && (
            <FormControl fullWidth disabled={disabled}>
              <InputLabel id="route-label">
                {VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.form.route}
              </InputLabel>
              <Select
                labelId="route-label"
                label={VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.form.route}
                value={selectedRoute ?? allFilter}
                onChange={(e) => setSelectedRoute?.(e.target.value)}
              >
                {routeOptions.map((r) => (
                  <MenuItem key={r.id} value={r.id}>
                    {r.id}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Trip */}
          {selectedRoute && selectedRoute !== allFilter && (
            <FormControl fullWidth disabled={disabled}>
              <InputLabel id="trip-label">
                {VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.form.tripId}
              </InputLabel>
              <Select
                labelId="trip-label"
                label={VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.form.tripId}
                value={selectedTrip ?? allFilter}
                onChange={(e) => setSelectedTrip?.(e.target.value)}
              >
                {tripOptions.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Stack>
      </Paper>

      {/* === CHART === */}
      {Array.isArray(routeSegmentGraphData?.series) && routeSegmentGraphData.series.length > 0 && (
        <HourlySegmentGraph
          graphData={routeSegmentGraphData}
          timeRange={timeRange}
          selectedMode={selectedMode}
          scenarioName={scenarioName}
        />
      )}
    </>
  );
}
