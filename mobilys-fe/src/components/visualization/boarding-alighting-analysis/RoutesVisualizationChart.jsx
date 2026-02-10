import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  Box,
  Paper,
  Dialog,
  DialogContent,
  IconButton,
  Typography,
  Collapse,
  AppBar,
  Toolbar,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { downloadElementAsPng } from "../export/html2canvasExport";
import { buildFilename } from "../buildFilename";
import { VISUALIZATION } from "@/strings";
import { DotTrip } from "./helpers/charts/DotTrip";
import { BOARDING_ALIGHTING_ANALYSIS_COLORS } from "../../../constant/colors";

// Utils
import {
  stripSequenceSuffix,
  addStopSequenceLabels,
  calculateChartStats,
  formatToInt,
} from "./utils";

// Chart Helpers
import {
  BarsTooltip,
  LinesTooltip,
} from "./helpers/charts/ChartTooltips";
import RouteTotalChart from "./helpers/charts/RouteTotalChart";
import TripVisibilityToggle from "./helpers/charts/TripVisibilityToggle";

const LINE_COLOR = BOARDING_ALIGHTING_ANALYSIS_COLORS.LINE_COLOR;
const BAR_UP = BOARDING_ALIGHTING_ANALYSIS_COLORS.BAR_UP;
const BAR_DOWN = BOARDING_ALIGHTING_ANALYSIS_COLORS.BAR_DOWN;
const BAR_DIVIDER = BOARDING_ALIGHTING_ANALYSIS_COLORS.BAR_DIVIDER;

const captureElementAsPng = async (element, filename) => {
  await downloadElementAsPng({
    element,
    filename,
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
    expandToScroll: true,
  });
};

export const ChartBoardingAlighting = React.memo(
  function ChartBoardingAlighting({ chartData, routeId, routeName, tripSeries, scenarioName, }) {
    const [hoverTrip, setHoverTrip] = useState(null);
    const [selectedTrip, setSelectedTrip] = useState(null);
    const [showAllTrips, setShowAllTrips] = useState(false);

    const activeDotFor = useCallback(
      (tripId) => {
        const isSelected = !!selectedTrip && selectedTrip === tripId;
        const isHovered = !!hoverTrip && hoverTrip === tripId;

        return {
          r: isSelected ? 7 : isHovered ? 6 : 5,
          stroke: "#ffffff",
          strokeWidth: 2,
        };
      },
      [hoverTrip, selectedTrip]
    );

    const tripMeta = useMemo(() => {
      const seen = new Set();
      return (tripSeries || []).map((t, i) => {
        const tid = String(t?.trip_id || t?.tripId || "");
        let base = tid.replace(/[^\w-]+/g, "_") || `trip_${i}`;
        let k = base;
        let n = 1;
        while (seen.has(k)) k = `${base}_${n++}`;
        seen.add(k);

        const stops = Array.isArray(t?.graph_data || t?.stops)
          ? t.graph_data || t.stops
          : [];

        const indexByStopSeq = new Map();
        const perStopCounter = new Map();

        stops.forEach((s, idx) => {
          const rawStop =
            s?.stop ??
            s?.stop_name ??
            s?.stopName ??
            s?.stop_label ??
            "";
          const prev = perStopCounter.get(rawStop) ?? 0;
          const current = prev + 1;
          perStopCounter.set(rawStop, current);
          indexByStopSeq.set(`${rawStop}#${current}`, idx);
        });

        return { tid, key: k, stops, indexByStopSeq };
      });
    }, [tripSeries]);


    const tidToKey = useMemo(() => {
      const m = {};
      tripMeta.forEach((x) => {
        m[x.tid] = x.key;
      });
      return m;
    }, [tripMeta]);

    const perTripRows = useMemo(() => {
      if (!Array.isArray(chartData)) return [];

      // Build base rows with sequenced stop labels
      const rows = addStopSequenceLabels(chartData);

      // Attach per-trip metrics aligned by stop name + sequence
      tripMeta.forEach((m) => {
        const indexByStopSeq = m.indexByStopSeq;
        rows.forEach((row) => {
          const key = `${row.stopRaw}#${row.stopSeq}`;
          const idx = indexByStopSeq?.get(key);
          const s = typeof idx === "number" ? m.stops[idx] : null;

          row[`b__${m.key}`] = Number(
            s?.boardings ?? s?.count_geton ?? 0
          );
          row[`a__${m.key}`] = Number(
            s?.alightings ?? s?.count_getoff ?? 0
          );
          row[`v__${m.key}`] = Number(
            s?.inVehicle ?? s?.count_in_bus ?? 0
          );
        });
      });

      return rows;
    }, [chartData, tripMeta]);


    const hasManyTrips = tripMeta.length > 10;

    // Calculate per-trip totals (boardings + alightings across all stops)
    const tripTotals = useMemo(() => {
      const totals = new Map();
      if (!perTripRows.length || !tripMeta.length) return totals;
      tripMeta.forEach((m) => {
        let sum = 0;
        for (const r of perTripRows) {
          sum += (Number(r[`b__${m.key}`]) || 0) + (Number(r[`a__${m.key}`]) || 0);
        }
        totals.set(m.tid, sum);
      });
      return totals;
    }, [perTripRows, tripMeta]);

    const visibleTripMeta = useMemo(() => {
      if (!tripMeta.length) return [];
      if (showAllTrips) return tripMeta;
      const withScore = tripMeta.map((m, i) => ({
        m,
        i,
        score: Number(tripTotals.get(m.tid)) || 0,
      }));
      withScore.sort((a, b) => (b.score - a.score) || (a.i - b.i));
      return withScore.slice(0, 10).map((x) => x.m);
    }, [tripMeta, showAllTrips, tripTotals]);

    useEffect(() => {
      if (!hasManyTrips && showAllTrips) {
        setShowAllTrips(false);
      }
    }, [hasManyTrips, showAllTrips]);

    useEffect(() => {
      if (showAllTrips) return;
      const visible = new Set(visibleTripMeta.map((m) => m.tid));
      setHoverTrip((current) =>
        current && !visible.has(current) ? null : current
      );
      setSelectedTrip((current) =>
        current && !visible.has(current) ? null : current
      );
    }, [showAllTrips, visibleTripMeta]);


    const stats = useMemo(() => calculateChartStats(chartData), [chartData]);

    const renderHeaderRouteInfo = useCallback(
      (size = "sm") => {
        const labels =
          VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart
            .labels;

        const isLg = size === "lg";
        const nameText = routeName || "-";
        const idText = routeId || "-";

        return (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
            <Box sx={{ display: "flex", gap: 1, alignItems: "baseline", flexWrap: "wrap" }}>
              <Typography sx={{ fontWeight: 700, fontSize: isLg ? 16 : 13, color: "#111827" }}>
                {labels.routeName}:
              </Typography>
              <Typography sx={{ fontSize: isLg ? 16 : 13, color: "#111827" }}>
                {nameText}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 1, alignItems: "baseline", flexWrap: "wrap" }}>
              <Typography sx={{ fontWeight: 700, fontSize: isLg ? 14 : 12, color: "#6b7280" }}>
                {labels.routeId}:
              </Typography>
              <Typography sx={{ fontSize: isLg ? 14 : 12, color: "#6b7280" }}>
                {idText}
              </Typography>
            </Box>
          </Box>
        );
      },
      [routeId, routeName]
    );

    const [expanded, setExpanded] = useState(true);
    const [fullscreen, setFullscreen] = useState(false);
    const [fullscreenTripPassing, setFullscreenTripPassing] = useState(false);
    const [fullscreenTripBoarding, setFullscreenTripBoarding] =
      useState(false);

    const boxRef = useRef(null);
    const [w, setW] = useState(0);
    useEffect(() => {
      if (!boxRef.current) return;
      const ro = new ResizeObserver((entries) => {
        const el = entries?.[0];
        if (!el) return;
        const width = Math.floor(el.contentRect.width);
        setW((prev) => (prev !== width ? width : prev));
      });
      ro.observe(boxRef.current);
      return () => ro.disconnect();
    }, []);



    const captureRef = useRef(null);
    const capturePassingRef = useRef(null);
    const captureBoardingRef = useRef(null);

    const handleDownloadImage = async () => {
      if (!captureRef.current) return;

      const scenario = scenarioName || VISUALIZATION.common.scenarioFallbackName;

      const filename = buildFilename(
        scenario,
        VISUALIZATION.boardingAlightingAnalysis.exports.screenName,
        "graph",
        VISUALIZATION.boardingAlightingAnalysis.exports.routeGraph.byRoute,
        "png"
      );

      await captureElementAsPng(captureRef.current, filename);
    };

    const handleDownloadTripPassingImage = async () => {
      if (!capturePassingRef.current) return;

      const scenario = scenarioName || VISUALIZATION.common.scenarioFallbackName;

      const filename = buildFilename(
        scenario,
        VISUALIZATION.boardingAlightingAnalysis.exports.screenName, // screenName
        "graph", // type
        VISUALIZATION.boardingAlightingAnalysis.exports.routeGraph.byTripInVehicle, // graphName
        "png" // ext
      );

      await captureElementAsPng(capturePassingRef.current, filename);
    };


    const handleDownloadTripBoardingImage = async () => {
      if (!captureBoardingRef.current) return;

      const scenario = scenarioName || VISUALIZATION.common.scenarioFallbackName;

      const filename = buildFilename(
        scenario,
        VISUALIZATION.boardingAlightingAnalysis.exports.screenName, // screenName
        "graph", // type
        VISUALIZATION.boardingAlightingAnalysis.exports.routeGraph.byTripBoardingAlighting, // graphName
        "png" // ext
      );

      await captureElementAsPng(captureBoardingRef.current, filename);
    };



    return (
      <>
        <Paper
          variant="outlined"
          sx={{
            mt: 2,
            borderRadius: 2,
            overflow: "visible",
            border: "1px solid #e0e0e0",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              p: 2,
              borderTopLeftRadius: 2,
              borderTopRightRadius: 2,
            }}
          >
            <Typography
              sx={{ fontSize: 18, fontWeight: 700, color: "#111827" }}
            >
              {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.sections.graphTitle}
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <IconButton
                size="small"
                onClick={() => setFullscreen(true)}
                sx={{ color: "#666", "&:hover": { bgcolor: "#e0e0e0" } }}
                aria-label="Fullscreen"
              >
                <span className="material-symbols-outlined outlined">
                  fullscreen
                </span>
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setExpanded((v) => !v)}
                sx={{ color: "#666", "&:hover": { bgcolor: "#e0e0e0" } }}
                aria-label="Toggle expand"
              >
                {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
          </Box>

          <Collapse in={expanded} timeout={200}>
            <Box ref={boxRef} sx={{ p: 2 }}>
              <Box sx={{ mb: 0.5 }}>{renderHeaderRouteInfo()}</Box>

              <Box sx={{ mt: 3 }}>
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: 14,
                    color: "#111",
                    mb: 0.5,
                  }}
                >
                  {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.sections.byRoute}
                </Typography>
              </Box>

              <Box sx={{ height: 380, width: "100%" }}>
                <RouteTotalChart data={chartData} width={w} height={360} />
              </Box>

              <Box sx={{ mt: 3 }}>
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: 14,
                    color: "#111",
                    mb: 0.5,
                  }}
                >
                  {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.sections.stats}
                </Typography>
              </Box>
              {Array.isArray(chartData) && chartData.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>
                          {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.table.metric}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>
                          {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.series.boardings}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>
                          {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.series.alightings}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>
                          {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.series.inVehicle}
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell>
                          {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.table.average}
                        </TableCell>
                        <TableCell>
                          {formatToInt(stats.boardings.average)}
                        </TableCell>
                        <TableCell>
                          {formatToInt(stats.alightings.average)}
                        </TableCell>
                        <TableCell>
                          {formatToInt(stats.inVehicle.average)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.table.max}
                        </TableCell>
                        <TableCell>{stats.boardings.maximum}</TableCell>
                        <TableCell>{stats.alightings.maximum}</TableCell>
                        <TableCell>{stats.inVehicle.maximum}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.table.total}
                        </TableCell>
                        <TableCell>{stats.boardings.total}</TableCell>
                        <TableCell>{stats.alightings.total}</TableCell>
                        <TableCell>{stats.inVehicle.total}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Box>
              )}

              <Box
                sx={{
                  mt: 3,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Box>
                  <Typography
                    sx={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: "#111",
                      mb: 0.5,
                    }}
                  >
                    {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.sections.byTripInVehicle}
                  </Typography>
                  <TripVisibilityToggle
                    enabled={hasManyTrips}
                    showAllTrips={showAllTrips}
                    onShowTop10={() => setShowAllTrips(false)}
                    onShowAll={() => setShowAllTrips(true)}
                    labels={VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.actions}
                    sx={{ mt: 1 }}
                  />
                </Box>
                <IconButton
                  size="small"
                  onClick={() => setFullscreenTripPassing(true)}
                  sx={{ color: "#666", "&:hover": { bgcolor: "#e0e0e0" } }}
                  aria-label="Fullscreen trip passing chart"
                >
                  <span className="material-symbols-outlined outlined">
                    fullscreen
                  </span>
                </IconButton>
              </Box>
              {visibleTripMeta.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Box sx={{ height: 360, width: "100%" }}>
                    <ComposedChart
                      width={w}
                      height={340}
                      data={perTripRows}
                      margin={{
                        top: 10,
                        right: 24,
                        bottom: 10,
                        left: 20,
                      }}
                    >
                      <CartesianGrid stroke="#e5e7eb" vertical={false} />
                      <XAxis
                        dataKey="stop"
                        tick={{ fontSize: 12, fill: "#666" }}
                        angle={-45}
                        textAnchor="end"
                        interval={0}
                        height={60}
                        tickFormatter={stripSequenceSuffix}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#666" }}
                        label={{
                          value: VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.axis.people,
                          angle: -90,
                          position: "insideLeft",
                          offset: 10,
                          style: { fill: "#666", fontSize: 12 },
                        }}
                      />
                      <Tooltip content={<LinesTooltip />} />

                      {visibleTripMeta.map((m, i) => {
                        const dim =
                          selectedTrip && selectedTrip !== m.tid;
                        if (dim) return null;
                        return (
                          <Line
                            key={`v:${i}:${m.key}`}
                            type="monotone"
                            name={`${VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.series.inVehicle} (${m.tid})`}
                            dataKey={`v__${m.key}`}
                            stroke={LINE_COLOR}
                            strokeWidth={selectedTrip === m.tid ? 4 : 3}
                            opacity={dim ? 0.35 : 1}
                            dot={<DotTrip />}
                            activeDot={activeDotFor(m.tid)}
                            onMouseOver={() => setHoverTrip(m.tid)}
                            onClick={() =>
                              setSelectedTrip((prev) =>
                                prev === m.tid ? null : m.tid
                              )
                            }
                          />
                        );
                      })}
                    </ComposedChart>
                  </Box>
                </Box>
              )}

              <Box
                sx={{
                  mt: 3,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: 14,
                    color: "#111",
                    mb: 0.5,
                  }}
                >
                  {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.sections.byTripBoardingAlighting}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => setFullscreenTripBoarding(true)}
                  sx={{ color: "#666", "&:hover": { bgcolor: "#e0e0e0" } }}
                  aria-label="Fullscreen trip boarding chart"
                >
                  <span className="material-symbols-outlined outlined">
                    fullscreen
                  </span>
                </IconButton>
              </Box>
              {visibleTripMeta.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Box sx={{ height: 300, width: "100%" }}>
                    <ComposedChart
                      width={w}
                      height={280}
                      data={perTripRows}
                      margin={{
                        top: 10,
                        right: 24,
                        bottom: 10,
                        left: 20,
                      }}
                    >
                      <CartesianGrid stroke="#e5e7eb" vertical={false} />
                      <XAxis
                        dataKey="stop"
                        tick={{ fontSize: 12, fill: "#666" }}
                        angle={-45}
                        textAnchor="end"
                        interval={0}
                        height={60}
                        tickFormatter={stripSequenceSuffix}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#666" }}
                        label={{
                          value: VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.axis.people,
                          angle: -90,
                          position: "insideLeft",
                          offset: 10,
                          style: { fill: "#666", fontSize: 12 },
                        }}
                      />
                      <Tooltip content={<BarsTooltip />} />

                      {visibleTripMeta.map((m, i) => {
                        const dim =
                          selectedTrip && selectedTrip !== m.tid;
                        if (dim) return null;
                        return (
                          <Bar
                            key={`b:${i}:${m.key}`}
                            name={`${VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.series.boardings} (${m.tid})`}
                            dataKey={`b__${m.key}`}
                            stackId="B"
                            barSize={12}
                            fill={BAR_UP}
                            stroke={BAR_DIVIDER}
                            strokeWidth={1.2}
                            radius={[2, 2, 0, 0]}
                            opacity={dim ? 0.35 : 1}
                            onMouseOver={() => setHoverTrip(m.tid)}
                            onClick={() =>
                              setSelectedTrip((prev) =>
                                prev === m.tid ? null : m.tid
                              )
                            }
                          />
                        );
                      })}

                      {visibleTripMeta.map((m, i) => {
                        const dim =
                          selectedTrip && selectedTrip !== m.tid;
                        if (dim) return null;
                        return (
                          <Bar
                            key={`a:${i}:${m.key}`}
                            name={`${VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.series.alightings} (${m.tid})`}
                            dataKey={`a__${m.key}`}
                            stackId="A"
                            barSize={12}
                            fill={BAR_DOWN}
                            stroke={BAR_DIVIDER}
                            strokeWidth={1.2}
                            radius={[2, 2, 0, 0]}
                            opacity={dim ? 0.35 : 1}
                            onMouseOver={() => setHoverTrip(m.tid)}
                            onClick={() =>
                              setSelectedTrip((prev) =>
                                prev === m.tid ? null : m.tid
                              )
                            }
                          />
                        );
                      })}
                    </ComposedChart>
                  </Box>
                </Box>
              )}
            </Box>
          </Collapse>
        </Paper>

        {/* Fullscreen main (chart 1 + stats) */}
        <Dialog
          open={fullscreen}
          onClose={() => setFullscreen(false)}
          maxWidth={false}
          fullScreen
          sx={{ zIndex: (t) => (t.zIndex?.modal ?? 1300) + 10000 }}
          BackdropProps={{
            sx: { zIndex: (t) => (t.zIndex?.modal ?? 1300) + 9999 },
          }}
          PaperProps={{
            sx: {
              bgcolor: "#fff",
              position: "relative",
              zIndex: (t) => (t.zIndex?.modal ?? 1300) + 10000,
            },
          }}
        >
          <AppBar
            sx={{
              position: "relative",
              bgcolor: "background.paper",
              color: "inherit",
            }}
          >
            <Toolbar>
              <IconButton
                edge="start"
                onClick={() => setFullscreen(false)}
                aria-label="close"
              >
                <CloseIcon />
              </IconButton>
              <Typography
                sx={{ ml: 2, flex: 1 }}
                variant="h6"
                fontWeight="bold"
              >
                {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.sections.graphTitle}
              </Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                <IconButton
                  onClick={handleDownloadImage}
                  size="small"
                  title="Download PNG"
                  aria-label="download"
                >
                  <span className="material-symbols-outlined outlined" style={{ fontSize: 45 }}>
                    file_png
                  </span>
                </IconButton>
              </Box>
            </Toolbar>
          </AppBar>

          <DialogContent sx={{ p: 0, m: 0, bgcolor: "#fff" }}>
            <Box ref={captureRef}>
              <Box
                sx={{
                  px: 4,
                  pt: 3,
                  pb: 2,
                  position: "sticky",
                  top: 0,
                  bgcolor: "#fff",
                  zIndex: 1,
                  borderBottom: "1px solid #eee",
                }}
              >
                {renderHeaderRouteInfo("lg")}
              </Box>

              <Box
                sx={{
                  px: 4,
                  pt: 3,
                  pb: 2,
                  bgcolor: "#fff",
                  zIndex: 1,
                }}
              >
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: 16,
                    color: "#111",
                  }}
                >
                  {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.sections.byRoute}
                </Typography>
              </Box>

              <Box
                sx={{
                  px: 4,
                  pb: 4,
                  pt: 1,
                }}
              >
                <Box
                  sx={{
                    width: "100%",
                    height: "calc(100vh - 260px)",
                    minHeight: 280,
                    maxHeight: 600,
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <RouteTotalChart data={chartData} />
                  </ResponsiveContainer>
                </Box>
              </Box>

              <Box
                sx={{
                  px: 4,
                  pt: 3,
                  pb: 2,
                  bgcolor: "#fff",
                  zIndex: 1,
                }}
              >
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: 16,
                    color: "#111",
                  }}
                >
                  {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.sections.stats}
                </Typography>
              </Box>
              {Array.isArray(chartData) && chartData.length > 0 && (
                <Box sx={{ px: 4, pb: 4 }}>
                  <Table size="medium">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, fontSize: 18 }}>
                          {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.table.metric}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 18 }}>
                          {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.series.boardings}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 18 }}>
                          {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.series.alightings}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 18 }}>
                          {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.series.inVehicle}
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ fontSize: 16 }}>
                          {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.table.average}
                        </TableCell>
                        <TableCell sx={{ fontSize: 16 }}>
                          {formatToInt(stats.boardings.average)}
                        </TableCell>
                        <TableCell sx={{ fontSize: 16 }}>
                          {formatToInt(stats.alightings.average)}
                        </TableCell>
                        <TableCell sx={{ fontSize: 16 }}>
                          {formatToInt(stats.inVehicle.average)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontSize: 16 }}>
                          {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.table.max}
                        </TableCell>
                        <TableCell sx={{ fontSize: 16 }}>
                          {stats.boardings.maximum}
                        </TableCell>
                        <TableCell sx={{ fontSize: 16 }}>
                          {stats.alightings.maximum}
                        </TableCell>
                        <TableCell sx={{ fontSize: 16 }}>
                          {stats.inVehicle.maximum}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontSize: 16 }}>
                          {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.table.total}
                        </TableCell>
                        <TableCell sx={{ fontSize: 16 }}>
                          {stats.boardings.total}
                        </TableCell>
                        <TableCell sx={{ fontSize: 16 }}>
                          {stats.alightings.total}
                        </TableCell>
                        <TableCell sx={{ fontSize: 16 }}>
                          {stats.inVehicle.total}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Box>
              )}
            </Box>
          </DialogContent>
        </Dialog>

        {/* Fullscreen: chart 3 only */}
        <Dialog
          open={fullscreenTripPassing}
          onClose={() => setFullscreenTripPassing(false)}
          maxWidth={false}
          fullScreen
          sx={{ zIndex: (t) => (t.zIndex?.modal ?? 1300) + 10000 }}
          BackdropProps={{
            sx: { zIndex: (t) => (t.zIndex?.modal ?? 1300) + 9999 },
          }}
          PaperProps={{
            sx: {
              bgcolor: "#fff",
              position: "relative",
              zIndex: (t) => (t.zIndex?.modal ?? 1300) + 10000,
            },
          }}
        >
          <AppBar
            sx={{
              position: "relative",
              bgcolor: "background.paper",
              color: "inherit",
            }}
          >
            <Toolbar>
              <IconButton
                edge="start"
                onClick={() => setFullscreenTripPassing(false)}
                aria-label="close"
              >
                <CloseIcon />
              </IconButton>
              <Typography
                sx={{ ml: 2, flex: 1 }}
                variant="h6"
                fontWeight="bold"
              >
                {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.sections.graphTitle}
              </Typography>
              <IconButton
                onClick={handleDownloadTripPassingImage}
                size="small"
                title="Download PNG"
                aria-label="download trip passing"
              >
                <span className="material-symbols-outlined outlined" style={{ fontSize: 45 }}>
                  file_png
                </span>
              </IconButton>
            </Toolbar>
          </AppBar>

          <DialogContent sx={{ p: 0, m: 0, bgcolor: "#fff" }}>
            <Box ref={capturePassingRef}>
              <Box
                sx={{
                  px: 4,
                  pt: 3,
                  pb: 2,
                  position: "sticky",
                  top: 0,
                  bgcolor: "#fff",
                  zIndex: 1,
                  borderBottom: "1px solid #eee",
                }}
              >
                {renderHeaderRouteInfo("lg")}
              </Box>

              <Box
                sx={{
                  px: 4,
                  pt: 3,
                  pb: 2,
                  bgcolor: "#fff",
                  zIndex: 1,
                }}
              >
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: 16,
                    color: "#111",
                  }}
                >
                  {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.sections.byTripInVehicle}
                </Typography>
              </Box>
              {visibleTripMeta.length > 0 && (
                <Box sx={{ px: 4, pb: 4, pt: 1 }}>
                  <Box
                    sx={{
                      width: "100%",
                      height: "calc(100vh - 260px)",
                      minHeight: 280,
                      maxHeight: 600,
                    }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={perTripRows}
                        margin={{ top: 10, right: 24, bottom: 10, left: 20 }}
                      >
                        <CartesianGrid stroke="#e5e7eb" vertical={false} />
                        <XAxis
                          dataKey="stop"
                          tick={{ fontSize: 12, fill: "#666" }}
                          angle={-45}
                          textAnchor="end"
                          interval={0}
                          height={60}
                          tickFormatter={stripSequenceSuffix}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: "#666" }}
                          label={{
                            value: VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.axis.people,
                            angle: -90,
                            position: "insideLeft",
                            offset: 10,
                            style: { fill: "#666", fontSize: 12 },
                          }}
                        />
                        <Tooltip content={<LinesTooltip />} />

                        {visibleTripMeta.map((m, i) => {
                          const dim = selectedTrip && selectedTrip !== m.tid;
                          if (dim) return null;
                          return (
                            <Line
                              key={`fs2-v:${i}:${m.key}`}
                              type="monotone"
                              name={`${VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.series.inVehicle} (${m.tid})`}
                              dataKey={`v__${m.key}`}
                              stroke={LINE_COLOR}
                              strokeWidth={selectedTrip === m.tid ? 6 : 4}
                              opacity={dim ? 0.35 : 1}
                              dot={<DotTrip />}
                              onMouseOver={() => setHoverTrip(m.tid)}
                              onClick={() =>
                                setSelectedTrip((prev) =>
                                  prev === m.tid ? null : m.tid
                                )
                              }
                            />
                          );
                        })}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </Box>
                </Box>
              )}

            </Box>
          </DialogContent>
        </Dialog>

        {/* Fullscreen: chart 4 only */}
        <Dialog
          open={fullscreenTripBoarding}
          onClose={() => setFullscreenTripBoarding(false)}
          maxWidth={false}
          fullScreen
          sx={{ zIndex: (t) => (t.zIndex?.modal ?? 1300) + 10000 }}
          BackdropProps={{
            sx: { zIndex: (t) => (t.zIndex?.modal ?? 1300) + 9999 },
          }}
          PaperProps={{
            sx: {
              bgcolor: "#fff",
              position: "relative",
              zIndex: (t) => (t.zIndex?.modal ?? 1300) + 10000,
            },
          }}
        >
          <AppBar
            sx={{
              position: "relative",
              bgcolor: "background.paper",
              color: "inherit",
            }}
          >
            <Toolbar>
              <IconButton
                edge="start"
                onClick={() => setFullscreenTripBoarding(false)}
                aria-label="close"
              >
                <CloseIcon />
              </IconButton>
              <Typography
                sx={{ ml: 2, flex: 1 }}
                variant="h6"
                fontWeight="bold"
              >
                {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.sections.byTripBoardingAlighting}
              </Typography>
              <IconButton
                onClick={handleDownloadTripBoardingImage}
                size="small"
                title="Download PNG"
                aria-label="download trip boarding"
              >
                <span className="material-symbols-outlined outlined" style={{ fontSize: 45 }}>
                  file_png
                </span>
              </IconButton>
            </Toolbar>
          </AppBar>

          <DialogContent sx={{ p: 0, m: 0, bgcolor: "#fff" }}>
            <Box ref={captureBoardingRef}>
              <Box
                sx={{
                  px: 4,
                  pt: 3,
                  pb: 2,
                  position: "sticky",
                  top: 0,
                  bgcolor: "#fff",
                  zIndex: 1,
                  borderBottom: "1px solid #eee",
                }}
              >
                {renderHeaderRouteInfo("lg")}
              </Box>

              <Box
                sx={{
                  px: 4,
                  pt: 3,
                  pb: 2,
                  bgcolor: "#fff",
                  zIndex: 1,
                }}
              >
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: 16,
                    color: "#111",
                  }}
                >
                  {VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.sections.byTripBoardingAlighting}
                </Typography>
              </Box>
              {visibleTripMeta.length > 0 && (
                <Box sx={{ px: 4, pb: 2, pt: 1 }}>
                  <Box
                    sx={{
                      width: "100%",
                      height: "calc(100vh - 260px)",
                      minHeight: 280,
                      maxHeight: 600,
                    }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={perTripRows}
                        margin={{ top: 10, right: 24, bottom: 10, left: 20 }}
                      >
                        <CartesianGrid stroke="#e5e7eb" vertical={false} />
                        <XAxis
                          dataKey="stop"
                          tick={{ fontSize: 12, fill: "#666" }}
                          angle={-45}
                          textAnchor="end"
                          interval={0}
                          height={60}
                          tickFormatter={stripSequenceSuffix}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: "#666" }}
                          label={{
                            value: VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.axis.people,
                            angle: -90,
                            position: "insideLeft",
                            offset: 10,
                            style: { fill: "#666", fontSize: 12 },
                          }}
                        />
                        <Tooltip content={<BarsTooltip />} />

                        {visibleTripMeta.map((m, i) => {
                          const dim = selectedTrip && selectedTrip !== m.tid;
                          if (dim) return null;
                          return (
                            <Bar
                              key={`fs2-b:${i}:${m.key}`}
                              name={`${VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.series.boardings} (${m.tid})`}
                              dataKey={`b__${m.key}`}
                              stackId="B"
                              barSize={12}
                              fill={BAR_UP}
                              stroke={BAR_DIVIDER}
                              strokeWidth={1.2}
                              radius={[2, 2, 0, 0]}
                              opacity={dim ? 0.35 : 1}
                              onMouseOver={() => setHoverTrip(m.tid)}
                              onClick={() =>
                                setSelectedTrip((prev) =>
                                  prev === m.tid ? null : m.tid
                                )
                              }
                            />
                          );
                        })}
                        {visibleTripMeta.map((m, i) => {
                          const dim = selectedTrip && selectedTrip !== m.tid;
                          if (dim) return null;
                          return (
                            <Bar
                              key={`fs2-a:${i}:${m.key}`}
                              name={`${VISUALIZATION.boardingAlightingAnalysis.components.routesVisualizationChart.series.alightings} (${m.tid})`}
                              dataKey={`a__${m.key}`}
                              stackId="A"
                              barSize={12}
                              fill={BAR_DOWN}
                              stroke={BAR_DIVIDER}
                              strokeWidth={1.2}
                              radius={[2, 2, 0, 0]}
                              opacity={dim ? 0.35 : 1}
                              onMouseOver={() => setHoverTrip(m.tid)}
                              onClick={() =>
                                setSelectedTrip((prev) =>
                                  prev === m.tid ? null : m.tid
                                )
                              }
                            />
                          );
                        })}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </Box>
                </Box>
              )}

            </Box>
          </DialogContent>
        </Dialog>
      </>
    );
  },
  (prev, next) => {
    if (prev.chartData !== next.chartData) return false;
    if (prev.routeId !== next.routeId) return false;
    if (prev.routeName !== next.routeName) return false;
    return true;
  }
);

export default ChartBoardingAlighting;
