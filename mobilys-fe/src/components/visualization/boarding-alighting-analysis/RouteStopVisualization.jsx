// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { useMemo, useState, useEffect, useRef } from "react";
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
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import CloseIcon from "@mui/icons-material/Close";
import Collapse from "@mui/material/Collapse";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import DialogContent from "@mui/material/DialogContent";
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
 * Combined Boarding/Alighting Graph Component 
 * =============================== */
function CombinedBoardingAlightingGraph({
  boardingData,
  alightingData,
  timeRange = [0, 24],
  scenarioName,
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const inlineCaptureRef = useRef(null);
  const fsCaptureRef = useRef(null);

  const [startH, endH] = Array.isArray(timeRange) ? timeRange : [0, 24];

  const combinedSeries = useMemo(() => {
    const parseH = (t) => {
      if (!t) return 0;
      const hh = String(t).split(":")[0];
      const n = Number(hh);
      return Number.isFinite(n) ? n : 0;
    };

    const boardingSeries = Array.isArray(boardingData?.series) ? boardingData.series : [];
    const alightingSeries = Array.isArray(alightingData?.series) ? alightingData.series : [];

    const dataMap = new Map();

    boardingSeries.forEach((d) => {
      const h = parseH(d.time);
      if (h >= startH && h < endH) {
        dataMap.set(h, {
          hour: h,
          label: `${h}${VISUALIZATION.common.time.hourSuffix}`,
          boarding: Number(d.value) || 0,
          alighting: 0,
        });
      }
    });

    alightingSeries.forEach((d) => {
      const h = parseH(d.time);
      if (h >= startH && h < endH) {
        if (dataMap.has(h)) {
          dataMap.get(h).alighting = Number(d.value) || 0;
        } else {
          dataMap.set(h, {
            hour: h,
            label: `${h}${VISUALIZATION.common.time.hourSuffix}`,
            boarding: 0,
            alighting: Number(d.value) || 0,
          });
        }
      }
    });

    return Array.from(dataMap.values()).sort((a, b) => a.hour - b.hour);
  }, [boardingData, alightingData, startH, endH]);

  const boardingStats = useMemo(() => {
    if (combinedSeries.length === 0) return { average: 0, maximum: 0, total: 0 };
    const total = combinedSeries.reduce((s, d) => s + d.boarding, 0);
    const maximum = Math.max(...combinedSeries.map((d) => d.boarding));
    const average = total / combinedSeries.length;
    return { average, maximum, total };
  }, [combinedSeries]);

  const alightingStats = useMemo(() => {
    if (combinedSeries.length === 0) return { average: 0, maximum: 0, total: 0 };
    const total = combinedSeries.reduce((s, d) => s + d.alighting, 0);
    const maximum = Math.max(...combinedSeries.map((d) => d.alighting));
    const average = total / combinedSeries.length;
    return { average, maximum, total };
  }, [combinedSeries]);

  const yMax = useMemo(() => {
    const maxVal = Math.max(0, ...combinedSeries.map((d) => Math.max(d.boarding, d.alighting)));
    if (maxVal <= 10) return 10;
    const step = 50;
    return Math.ceil(maxVal / step) * step;
  }, [combinedSeries]);

  const tooltipLabels = VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.tooltip;

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const p = payload[0]?.payload;
      return (
        <Box sx={{ p: 1.5, bgcolor: "#fff", border: "1px solid #ddd", borderRadius: 1 }}>
          <div><strong>{p?.label}</strong></div>
          <div style={{ color: "#1976d2" }}>{tooltipLabels.boarding}: {p?.boarding ?? 0}</div>
          <div style={{ color: "#e53935" }}>{tooltipLabels.alighting}: {p?.alighting ?? 0}</div>
        </Box>
      );
    }
    return null;
  };

  const handleDownloadImage = async () => {
    const wrapper = fullscreen ? fsCaptureRef.current : inlineCaptureRef.current;
    if (!wrapper) return;

    const scenario = scenarioName || VISUALIZATION.common.scenarioFallbackName;
    const filename = buildFilename(
      scenario,
      VISUALIZATION.boardingAlightingAnalysis.exports.screenName,
      "graph",
      `${VISUALIZATION.boardingAlightingAnalysis.exports.stopGraph.total}_${VISUALIZATION.boardingAlightingAnalysis.exports.stopGraph.graphNameSuffix}`,
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
    <Paper variant="outlined" sx={{ mt: 2.5, p: 0, position: "relative", minWidth: 320, borderRadius: 2, overflow: "visible", border: "1px solid #e0e0e0" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 2, borderBottom: expanded ? "1px solid #eeeeee" : "none", borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 700 }}>
          {VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.title}
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <IconButton onClick={() => setFullscreen(true)} size="small" title={VISUALIZATION.common.map.fullscreen.enter}>
            <span className="material-symbols-outlined outlined">fullscreen</span>
          </IconButton>
          <IconButton onClick={() => setExpanded((v) => !v)} size="small">
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box ref={inlineCaptureRef} sx={{ px: 2, pt: 1, pb: 2 }}>
          <Box sx={{ width: "100%", height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={combinedSeries} margin={{ top: 0, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis domain={[0, yMax]} />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8 }} />
                <Line type="monotone" dataKey="boarding" name={tooltipLabels.boarding} stroke="#1976d2" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="alighting" name={tooltipLabels.alighting} stroke="#e53935" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </Box>

          <Box sx={{ mt: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>{VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.table.metric}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{tooltipLabels.boarding}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{tooltipLabels.alighting}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>{VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.table.average}</TableCell>
                  <TableCell>{Math.round(boardingStats.average)}</TableCell>
                  <TableCell>{Math.round(alightingStats.average)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.table.max}</TableCell>
                  <TableCell>{boardingStats.maximum}</TableCell>
                  <TableCell>{alightingStats.maximum}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.table.total}</TableCell>
                  <TableCell>{boardingStats.total}</TableCell>
                  <TableCell>{alightingStats.total}</TableCell>
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
      <Dialog open={fullscreen} onClose={() => setFullscreen(false)} maxWidth={false} fullScreen
        sx={{ zIndex: (theme) => (theme.zIndex?.modal ?? 1300) + 10000 }}
        BackdropProps={{ sx: { zIndex: (theme) => (theme.zIndex?.modal ?? 1300) + 9999 } }}
        PaperProps={{ sx: { bgcolor: "#fff", position: "relative", zIndex: (theme) => (theme.zIndex?.modal ?? 1300) + 10000 } }}>
        <AppBar sx={{ position: "relative", bgcolor: "background.paper", color: "inherit", boxShadow: 3 }}>
          <Toolbar>
            <IconButton edge="start" onClick={() => setFullscreen(false)}>
              <CloseIcon />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" fontWeight="bold">
              {VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.title}
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <IconButton onClick={handleDownloadImage} size="small" title={VISUALIZATION.common.map.actions.downloadPng}>
                <span className="material-symbols-outlined outlined" style={{ fontSize: 45 }}>file_png</span>
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>

        <DialogContent sx={{ p: 0, m: 0, height: "calc(100vh - 64px)", bgcolor: "#fff" }}>
          <Box ref={fsCaptureRef} sx={{ px: 6, pt: 4, pb: 2 }}>
            <Box sx={{ width: "100vw", height: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ResponsiveContainer width="95%" height="100%">
                <LineChart data={combinedSeries} margin={{ top: 0, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 18 }} interval={0} angle={-25} textAnchor="end" height={80} />
                  <YAxis domain={[0, yMax]} tick={{ fontSize: 18 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8, fontSize: 18 }} />
                  <Line type="monotone" dataKey="boarding" name={tooltipLabels.boarding} stroke="#1976d2" strokeWidth={5} dot={{ r: 6 }} activeDot={{ r: 10 }} />
                  <Line type="monotone" dataKey="alighting" name={tooltipLabels.alighting} stroke="#e53935" strokeWidth={5} dot={{ r: 6 }} activeDot={{ r: 10 }} />
                </LineChart>
              </ResponsiveContainer>
            </Box>

            <Box sx={{ mt: 3, pb: 6 }}>
              <Table size="medium">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: 18 }}>{VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.table.metric}</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 18 }}>{tooltipLabels.boarding}</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 18 }}>{tooltipLabels.alighting}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontSize: 16 }}>{VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.table.average}</TableCell>
                    <TableCell sx={{ fontSize: 16 }}>{Math.round(boardingStats.average)}</TableCell>
                    <TableCell sx={{ fontSize: 16 }}>{Math.round(alightingStats.average)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontSize: 16 }}>{VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.table.max}</TableCell>
                    <TableCell sx={{ fontSize: 16 }}>{boardingStats.maximum}</TableCell>
                    <TableCell sx={{ fontSize: 16 }}>{alightingStats.maximum}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontSize: 16 }}>{VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.table.total}</TableCell>
                    <TableCell sx={{ fontSize: 16 }}>{boardingStats.total}</TableCell>
                    <TableCell sx={{ fontSize: 16 }}>{alightingStats.total}</TableCell>
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

function HourlySegmentGraph({
  graphData,
  timeRange = [0, 24],
  selectedMode,
  scenarioName,
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const inlineCaptureRef = useRef(null);
  const fsCaptureRef = useRef(null);

  const [startH, endH] = Array.isArray(timeRange) ? timeRange : [0, 24];

  const series = useMemo(() => {
    const parseH = (t) => {
      if (!t) return 0;
      const hh = String(t).split(":")[0];
      const n = Number(hh);
      return Number.isFinite(n) ? n : 0;
    };

    const raw = Array.isArray(graphData?.series) ? graphData.series : [];
    return raw
      .map((d) => {
        const h = parseH(d?.time);
        return {
          hour: h,
          label: `${h}${VISUALIZATION.common.time.hourSuffix}`,
          value: Number(d?.value) || 0,
        };
      })
      .filter((d) => d.hour >= startH && d.hour < endH)
      .sort((a, b) => a.hour - b.hour);
  }, [graphData, startH, endH]);

  const stats = useMemo(() => {
    if (series.length === 0) return { average: 0, maximum: 0, total: 0 };
    const total = series.reduce((s, d) => s + (Number(d.value) || 0), 0);
    const maximum = Math.max(0, ...series.map((d) => Number(d.value) || 0));
    const average = total / series.length;
    return { average, maximum, total };
  }, [series]);

  const yMax = useMemo(() => {
    const maxVal = Math.max(0, ...series.map((d) => Number(d.value) || 0));
    if (maxVal <= 10) return 10;
    const step = 50;
    return Math.ceil(maxVal / step) * step;
  }, [series]);

  const modeConfig = useMemo(() => {
    if (selectedMode === "boarding") {
      return {
        label: VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.tooltip.boarding,
        color: "#1976d2",
        screenPart: VISUALIZATION.boardingAlightingAnalysis.exports.stopGraph.boarding,
      };
    }
    if (selectedMode === "alighting") {
      return {
        label: VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.tooltip.alighting,
        color: "#e53935",
        screenPart: VISUALIZATION.boardingAlightingAnalysis.exports.stopGraph.alighting,
      };
    }
    return {
      label: VISUALIZATION.boardingAlightingAnalysis.exports.stopGraph.total,
      color: "#f59e0b",
      screenPart: VISUALIZATION.boardingAlightingAnalysis.exports.stopGraph.total,
    };
  }, [selectedMode]);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const p = payload[0]?.payload;
      return (
        <Box sx={{ p: 1.5, bgcolor: "#fff", border: "1px solid #ddd", borderRadius: 1 }}>
          <div><strong>{p?.label}</strong></div>
          <div>{modeConfig.label}: {p?.value ?? 0}</div>
        </Box>
      );
    }
    return null;
  };

  const handleDownloadImage = async () => {
    const wrapper = fullscreen ? fsCaptureRef.current : inlineCaptureRef.current;
    if (!wrapper) return;

    const scenario = scenarioName || VISUALIZATION.common.scenarioFallbackName;
    const filename = buildFilename(
      scenario,
      VISUALIZATION.boardingAlightingAnalysis.exports.screenName,
      "graph",
      `${modeConfig.screenPart}_${VISUALIZATION.boardingAlightingAnalysis.exports.stopGraph.graphNameSuffix}`,
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
    <Paper variant="outlined" sx={{ mt: 2.5, p: 0, position: "relative", minWidth: 320, borderRadius: 2, overflow: "visible", border: "1px solid #e0e0e0" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 2, borderBottom: expanded ? "1px solid #eeeeee" : "none", borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 700 }}>
          {VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.title}
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <IconButton onClick={() => setFullscreen(true)} size="small" title={VISUALIZATION.common.map.fullscreen.enter}>
            <span className="material-symbols-outlined outlined">fullscreen</span>
          </IconButton>
          <IconButton onClick={() => setExpanded((v) => !v)} size="small">
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box ref={inlineCaptureRef} sx={{ px: 2, pt: 1, pb: 2 }}>
          <Box sx={{ width: "100%", height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 0, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis domain={[0, yMax]} />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8 }} />
                <Line type="monotone" dataKey="value" name={modeConfig.label} stroke={modeConfig.color} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </Box>

          <Box sx={{ mt: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>{VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.table.metric}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{modeConfig.label}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>{VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.table.average}</TableCell>
                  <TableCell>{Math.round(stats.average)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.table.max}</TableCell>
                  <TableCell>{stats.maximum}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.table.total}</TableCell>
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
      <Dialog open={fullscreen} onClose={() => setFullscreen(false)} maxWidth={false} fullScreen
        sx={{ zIndex: (theme) => (theme.zIndex?.modal ?? 1300) + 10000 }}
        BackdropProps={{ sx: { zIndex: (theme) => (theme.zIndex?.modal ?? 1300) + 9999 } }}
        PaperProps={{ sx: { bgcolor: "#fff", position: "relative", zIndex: (theme) => (theme.zIndex?.modal ?? 1300) + 10000 } }}>
        <AppBar sx={{ position: "relative", bgcolor: "background.paper", color: "inherit", boxShadow: 3 }}>
          <Toolbar>
            <IconButton edge="start" onClick={() => setFullscreen(false)}>
              <CloseIcon />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" fontWeight="bold">
              {VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.title}
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <IconButton onClick={handleDownloadImage} size="small" title={VISUALIZATION.common.map.actions.downloadPng}>
                <span className="material-symbols-outlined outlined" style={{ fontSize: 45 }}>file_png</span>
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>

        <DialogContent sx={{ p: 0, m: 0, height: "calc(100vh - 64px)", bgcolor: "#fff" }}>
          <Box ref={fsCaptureRef} sx={{ px: 6, pt: 4, pb: 2 }}>
            <Box sx={{ width: "100vw", height: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ResponsiveContainer width="95%" height="100%">
                <LineChart data={series} margin={{ top: 0, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 18 }} interval={0} angle={-25} textAnchor="end" height={80} />
                  <YAxis domain={[0, yMax]} tick={{ fontSize: 18 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8, fontSize: 18 }} />
                  <Line type="monotone" dataKey="value" name={modeConfig.label} stroke={modeConfig.color} strokeWidth={5} dot={{ r: 6 }} activeDot={{ r: 10 }} />
                </LineChart>
              </ResponsiveContainer>
            </Box>

            <Box sx={{ mt: 3, pb: 6 }}>
              <Table size="medium">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: 18 }}>{VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.table.metric}</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 18 }}>{modeConfig.label}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontSize: 16 }}>{VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.table.average}</TableCell>
                    <TableCell sx={{ fontSize: 16 }}>{Math.round(stats.average)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontSize: 16 }}>{VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.table.max}</TableCell>
                    <TableCell sx={{ fontSize: 16 }}>{stats.maximum}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontSize: 16 }}>{VISUALIZATION.boardingAlightingAnalysis.components.routeStopVisualization.table.total}</TableCell>
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
 * Main Component
 * =============================== */
export default function RouteStopVisualization({
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

  selectedTimeRange,
  setSelectedTimeRange,

  routeStopFilterData = [],
  routeStopGraphData = [],

  scenarioName,
}) {
  const allFilter = VISUALIZATION.common.filters.all;

  const rawGroupList = useMemo(() => {
    if (!Array.isArray(routeStopFilterData)) return [allFilter];
    return [
      allFilter,
      ...routeStopFilterData.map((g) => g.route_group).filter(Boolean),
    ];
  }, [routeStopFilterData]);

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

  const [metric, setMetric] = useState("in_car");

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

  const routeOptions = useMemo(() => {
    if (
      !Array.isArray(routeStopFilterData) ||
      !selectedRouteGroup ||
      selectedRouteGroup === allFilter
    ) {
      return [{ id: allFilter, name: allFilter }];
    }
    const groupObj = routeStopFilterData.find(
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
  }, [routeStopFilterData, selectedRouteGroup]);

  useEffect(() => {
    setSelectedRoute?.(allFilter);
    setSelectedTrip?.(allFilter);
  }, [selectedRouteGroup]);

  useEffect(() => {
    if (!routeOptions.length) return;
    const ids = routeOptions.map((r) => r.id);
    if (!ids.includes(selectedRoute)) {
      setSelectedRoute?.(allFilter);
      setSelectedTrip?.(allFilter);
    }
  }, [routeOptions, selectedRoute]);

  const tripOptions = useMemo(() => {
    if (
      !Array.isArray(routeStopFilterData) ||
      !selectedRouteGroup ||
      selectedRouteGroup === allFilter ||
      !selectedRoute ||
      selectedRoute === allFilter
    ) {
      return [{ id: allFilter, name: allFilter }];
    }
    const groupObj = routeStopFilterData.find(
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
  }, [routeStopFilterData, selectedRouteGroup, selectedRoute]);

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
      const parseHour = (s) => Number(String(s).split(":")[0]) || 0;
      return [
        parseHour(selectedTimeRange.start_time),
        parseHour(selectedTimeRange.end_time),
      ];
    }
    return [0, 24];
  }, [selectedTimeRange]);

  const handleApplyFilter = () => {
    const routeIdNorm =
      selectedRoute === allFilter ? allFilter : normalizeRouteId(selectedRoute);

    onChange?.({
      type: metric,
      date: selectedDate ?? allFilter,
      time: timeRange,
      routeId: routeIdNorm,
      tripId: selectedTrip ?? allFilter,
      routeGroup: selectedRouteGroup ?? allFilter,
    });
  };

  return (
    <>
      {/* === FORM === */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack spacing={2.5}>
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
      {selectedMode === "both" && routeStopGraphData?.boarding && routeStopGraphData?.alighting ? (
        <CombinedBoardingAlightingGraph
          boardingData={routeStopGraphData.boarding}
          alightingData={routeStopGraphData.alighting}
          timeRange={timeRange}
          scenarioName={scenarioName}
        />
      ) : (
        Array.isArray(routeStopGraphData?.series) && routeStopGraphData.series.length > 0 && (
          <HourlySegmentGraph
            graphData={routeStopGraphData}
            timeRange={timeRange}
            selectedMode={selectedMode}
            scenarioName={scenarioName}
          />
        )
      )}
    </>
  );
}
