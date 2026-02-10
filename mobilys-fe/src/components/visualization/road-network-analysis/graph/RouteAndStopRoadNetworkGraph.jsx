import React, { useMemo, useRef, useState } from "react";
import {
  AppBar,
  Box,
  Collapse,
  Dialog,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Toolbar,
  Typography,
} from "@mui/material";
import {
  Close as CloseIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
} from "@mui/icons-material";
import { downloadElementAsPng } from "../../export/html2canvasExport";
import * as XLSX from "xlsx";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { trimText } from "../../../../utils/text";

import { VISUALIZATION } from "@/strings";
import { UI } from "@/constant/ui";
import { buildFilename } from "../../buildFilename";

const TITLE = VISUALIZATION.roadNetworkAnalysisOsm.components.graphs.routesAndStops.title;
const HEADERS = VISUALIZATION.roadNetworkAnalysisOsm.components.graphs.routesAndStops.csvHeaders;

const toMinutes = (seconds) => {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n / 60);
};

function countStops(route) {
  if (Array.isArray(route?.stops) && route.stops.length > 0) {
    const first = route.stops[0];
    if (first && typeof first === "object" && Array.isArray(first.stops)) {
      return route.stops.reduce((sum, g) => sum + (Array.isArray(g.stops) ? g.stops.length : 0), 0);
    }
    if (typeof first === "string") return route.stops.filter(Boolean).length;
    return route.stops.length;
  }
  if (Array.isArray(route?.stop_names)) return route.stop_names.length;
  if (Array.isArray(route?.stop_times)) return route.stop_times.length;
  if (typeof route?.stops_text === "string" && route.stops_text.trim()) {
    return route.stops_text.split(",").map((s) => s.trim()).filter(Boolean).length;
  }
  return 0;
}

function getStopNames(route) {
  if (Array.isArray(route?.stops) && route.stops.length > 0) {
    const first = route.stops[0];
    if (first && typeof first === "object" && Array.isArray(first.stops)) {
      const names = [];
      for (const group of route.stops) {
        const list = Array.isArray(group?.stops) ? group.stops : [];
        for (const s of list) {
          const name = s?.stop_name ?? s?.name ?? s?.parent_stop ?? s?.stop ?? s?.stop_id ?? "";
          if (name) names.push(String(name));
        }
      }
      return names;
    }
    if (typeof first === "string") return route.stops.filter((v) => typeof v === "string" && v.trim().length > 0);
    return route.stops
      .map((s) => s?.stop_name ?? s?.name ?? s?.parent_stop ?? s?.stop ?? s?.stop_id ?? "")
      .filter((v) => v && String(v).trim());
  }

  if (Array.isArray(route?.stop_names)) return route.stop_names.filter((v) => typeof v === "string" && v.trim().length > 0);
  if (Array.isArray(route?.stop_times)) {
    return route.stop_times
      .map((st) => st?.stop_name ?? st?.name ?? st?.stop?.stop_name ?? st?.stop?.name ?? "")
      .filter((v) => v && String(v).trim());
  }
  if (typeof route?.stops_text === "string" && route.stops_text.trim()) return route.stops_text.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

function stopTextOrFallback(route) {
  const total = countStops(route);
  if (total > 0) return `${VISUALIZATION.common.labels.total}${total}`;
  return VISUALIZATION.common.dateParts.noData;
}

export default function RouteAndStopRoadNetworkGraph({
  data = [],
  maxMinutes = null,
  filterChartWithMinutes = true,
  scenarioName = VISUALIZATION.common.scenarioFallbackName,
  screenName = VISUALIZATION.roadNetworkAnalysisOsm.screenName,
}) {
  const [openFs, setOpenFs] = useState(false);
  const [open, setOpen] = useState(true);
  const chartRef = useRef(null);

  const sorted = useMemo(() => {
    const arr = Array.isArray(data) ? data : [];
    return [...arr].sort((a, b) => (a?.cutoff_time ?? 0) - (b?.cutoff_time ?? 0));
  }, [data]);

  const filtered = useMemo(() => {
    if (maxMinutes == null) return sorted;
    const limitSec = maxMinutes * 60;
    return sorted.filter((tg) => (tg?.cutoff_time ?? 0) <= limitSec);
  }, [sorted, maxMinutes]);

  const chartSource = filterChartWithMinutes ? filtered : sorted;

  const chartData = useMemo(() => {
    return chartSource.map((tg) => {
      const minutes = toMinutes(tg?.cutoff_time ?? 0);
      const timeRange = `${minutes}${VISUALIZATION.common.time.minutesSuffix}`;
      const routesData = Array.isArray(tg?.routes_data) ? tg.routes_data : [];
      const routeCount = routesData.reduce((sum, grp) => sum + (Array.isArray(grp?.routes) ? grp.routes.length : 0), 0);
      const stopCount = routesData.reduce((sumG, grp) => {
        const routes = Array.isArray(grp?.routes) ? grp.routes : [];
        return sumG + routes.reduce((s, r) => s + countStops(r), 0);
      }, 0);
      return { timeRange, routeCount, stopCount };
    });
  }, [chartSource]);

  const ticks = useMemo(() => {
    const all = chartData.flatMap((d) => [d.routeCount, d.stopCount]);
    const maxVal = Math.max(...all, 0);
    if (maxVal <= 0) return [0];
    const maxTicks = 10;
    const step = Math.max(1, Math.ceil(maxVal / (maxTicks - 1)));
    let arr = Array.from(
      { length: Math.min(maxTicks, Math.floor(maxVal / step) + 1) },
      (_, i) => i * step,
    );
    if (arr[arr.length - 1] < maxVal) arr.push(maxVal);
    return arr;
  }, [chartData]);

  const handleDownloadImage = async () => {
    const el = chartRef.current;
    if (!el) return;
    await downloadElementAsPng({
      element: el,
      filename: buildFilename(scenarioName, screenName, "graph", TITLE, "png"),
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      expandToScroll: true,
    });
  };

  const handleExportExcel = () => {
    const rows = [[HEADERS.time, HEADERS.groupName, HEADERS.routeId, HEADERS.stopInfo]];
    const merges = [];
    let rowIndex = 1;

    filtered.forEach((tg) => {
      const minutes = toMinutes(tg?.cutoff_time ?? 0);
      const timeLabel = `${minutes}${VISUALIZATION.common.time.minutesSuffix}`;
      const routesData = Array.isArray(tg?.routes_data) ? tg.routes_data : [];
      const totalRoutes = routesData.reduce((sum, g) => sum + (Array.isArray(g?.routes) ? g.routes.length : 0), 0);

      if (totalRoutes > 1) {
        merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex + totalRoutes - 1, c: 0 } });
      }

      routesData.forEach((grp) => {
        const routes = Array.isArray(grp?.routes) ? grp.routes : [];
        const grpCount = routes.length;
        if (grpCount > 1) {
          merges.push({ s: { r: rowIndex, c: 1 }, e: { r: rowIndex + grpCount - 1, c: 1 } });
        }

        routes.forEach((route) => {
          const names = getStopNames(route);
          const stopCell = names.length > 0 ? names.join(", ") : stopTextOrFallback(route);
          rows.push([timeLabel, grp?.route_group_name ?? grp?.route_group ?? "", route?.route_id ?? "", stopCell]);
          rowIndex++;
        });
      });
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!merges"] = merges;
    ws["!cols"] = rows[0].map((_, i) => ({
      wch: rows.reduce((m, r) => Math.max(m, (r[i]?.toString().length || 0)), 0) + 2,
    }));
    XLSX.utils.book_append_sheet(wb, ws, TITLE);
    XLSX.writeFile(wb, buildFilename(scenarioName, screenName, "graph", TITLE, "xlsx"));
  };

  const headerCellSx = (isFs) => ({
    py: 0.5,
    px: 1,
    ...(isFs ? {} : { position: "sticky", top: 0, zIndex: 2, bgcolor: "background.paper" }),
  });

  const renderContent = (isFs) => (
    <Box>
      <Box sx={{ overflowX: "auto", overflowY: "hidden", width: "100%", height: isFs ? "60vh" : "100%" }}>
        <Box
          ref={chartRef}
          sx={{
            width: isFs ? "100%" : undefined,
            minWidth: isFs ? 0 : `${Math.max(chartData.length * 120, 480)}px`,
            height: isFs ? "60vh" : 300,
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timeRange" tick={{ fontSize: 12, fontWeight: 500 }} />
              <YAxis tick={{ fontSize: 12, fontWeight: 500 }} allowDecimals={false} ticks={ticks} />
              <Tooltip />
              <Legend verticalAlign="bottom" iconType="circle" />
              <Bar dataKey="routeCount" name={HEADERS.routeId} fill="#8884d8" barSize={30} />
              <Bar dataKey="stopCount" name={HEADERS.stopCount} fill="#82ca9d" barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Box>

      <TableContainer
        sx={{
          maxHeight: isFs ? 600 : 260,
          width: "100%",
          overflowY: "auto",
          overflowX: "auto",
          mt: 2,
        }}
      >
        <Table size="small" stickyHeader={!isFs} sx={{ tableLayout: "fixed", borderCollapse: "separate" }}>
          <TableHead>
            <TableRow>
              <TableCell sx={headerCellSx(isFs)}>
                <Typography variant="body2" fontWeight={700}>
                  {HEADERS.time}
                </Typography>
              </TableCell>
              <TableCell sx={headerCellSx(isFs)}>
                <Typography variant="body2" fontWeight={700}>
                  {HEADERS.groupName}
                </Typography>
              </TableCell>
              <TableCell sx={headerCellSx(isFs)}>
                <Typography variant="body2" fontWeight={700}>
                  {HEADERS.routeId}
                </Typography>
              </TableCell>
              <TableCell sx={headerCellSx(isFs)}>
                <Typography variant="body2" fontWeight={700}>
                  {HEADERS.stopInfo}
                </Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(filterChartWithMinutes ? filtered : sorted).map((tg, tgi) => {
              const minutes = toMinutes(tg?.cutoff_time ?? 0);
              const timeLabel = `${minutes}${VISUALIZATION.common.time.minutesSuffix}`;
              const routesData = Array.isArray(tg?.routes_data) ? tg.routes_data : [];

              const rows = [];

              if (tgi > 0) {
                rows.push(
                  <TableRow key={`sep-${tgi}`}>
                    <TableCell colSpan={4} sx={{ py: 0.5, px: 0 }}>
                      <Box sx={{ height: 1, bgcolor: "divider" }} />
                    </TableCell>
                  </TableRow>,
                );
              }

              const totalRoutes = routesData.reduce((sum, g) => sum + (Array.isArray(g?.routes) ? g.routes.length : 0), 0);
              let timePrinted = false;

              routesData.forEach((grp, gi) => {
                const routes = Array.isArray(grp?.routes) ? grp.routes : [];
                const groupLabel = grp?.route_group_name ?? grp?.route_group ?? "";
                const groupSpan = Math.max(routes.length, 1);

                routes.forEach((route, ri) => {
                  const names = getStopNames(route);
                  const isEmpty = names.length === 0;
                  const stopText = isEmpty ? stopTextOrFallback(route) : "";
                  const topSep = ri === 0 ? (theme) => `1px solid ${theme.palette.divider}` : "none";

                  rows.push(
                    <TableRow key={`${tgi}-${gi}-${ri}`}>
                      {!timePrinted && (
                        <TableCell
                          rowSpan={Math.max(totalRoutes, 1)}
                          sx={{ py: 0.5, px: 1, verticalAlign: "top", borderBottom: "none" }}
                        >
                          <Typography variant="body2">{timeLabel}</Typography>
                        </TableCell>
                      )}

                      {ri === 0 ? (
                        <TableCell
                          rowSpan={groupSpan}
                          sx={{
                            py: 0.75,
                            px: 1,
                            verticalAlign: "top",
                            borderTop: topSep,
                            borderBottom: "none",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          <Typography variant="body2">
                            {isFs ? (groupLabel || VISUALIZATION.common.dateParts.noData) : trimText(groupLabel || VISUALIZATION.common.dateParts.noData, 32)}
                          </Typography>
                        </TableCell>
                      ) : null}

                      <TableCell
                        sx={{
                          py: 0.75,
                          px: 1,
                          verticalAlign: "top",
                          borderTop: topSep,
                          borderBottom: ri === routes.length - 1 ? "none" : "",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        <Typography variant="body2">
                          {isFs ? (route?.route_id ?? "") : trimText(route?.route_id ?? "", 16)}
                        </Typography>
                      </TableCell>

                      <TableCell
                        sx={{
                          py: 0.5,
                          px: 1,
                          verticalAlign: "top",
                          borderTop: topSep,
                          borderBottom: ri === routes.length - 1 ? "none" : "",
                        }}
                      >
                        {isEmpty ? (
                          <Typography variant="body2" color="text.secondary">
                            {stopText}
                          </Typography>
                        ) : (
                          <Box component="ul" sx={{ m: 0, pl: 2, listStyle: "disc" }}>
                            {names.map((name, idx) => (
                              <Typography
                                key={`${name}-${idx}`}
                                component="li"
                                variant="body2"
                                sx={{ mb: 0.25, whiteSpace: "normal", wordBreak: "break-word" }}
                              >
                                {name}
                              </Typography>
                            ))}
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>,
                  );

                  if (!timePrinted) timePrinted = true;
                });

                if (routes.length === 0) {
                  rows.push(
                    <TableRow key={`${tgi}-${gi}-empty`}>
                      {!timePrinted && (
                        <TableCell rowSpan={1} sx={{ py: 0.5, px: 1, verticalAlign: "top", borderBottom: "none" }}>
                          <Typography variant="body2">{timeLabel}</Typography>
                        </TableCell>
                      )}
                      <TableCell sx={{ py: 0.75, px: 1 }}>
                        <Typography variant="body2">
                          {isFs ? (groupLabel || VISUALIZATION.common.dateParts.noData) : trimText(groupLabel || VISUALIZATION.common.dateParts.noData, 32)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 0.75, px: 1 }}>
                        <Typography variant="body2">{VISUALIZATION.common.dateParts.noData}</Typography>
                      </TableCell>
                      <TableCell sx={{ py: 0.75, px: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          {VISUALIZATION.common.dateParts.noData}
                        </Typography>
                      </TableCell>
                    </TableRow>,
                  );
                  if (!timePrinted) timePrinted = true;
                }
              });

              if (!rows.length) {
                rows.push(
                  <TableRow key={`${tgi}-empty`}>
                    <TableCell sx={{ py: 0.75, px: 1 }}>
                      <Typography variant="body2">{timeLabel}</Typography>
                    </TableCell>
                    <TableCell colSpan={3} sx={{ py: 0.75, px: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        {VISUALIZATION.common.emptyState.noData}
                      </Typography>
                    </TableCell>
                  </TableRow>,
                );
              }

              return rows;
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  return (
    <>
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: open ? 1 : 0 }}>
          <Typography variant="h6" fontWeight="bold">
            {TITLE}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconButton size="small" title={VISUALIZATION.common.actions.expand} onClick={() => setOpenFs(true)}>
              <span className="material-symbols-outlined outlined">fullscreen</span>
            </IconButton>
            <IconButton size="small" onClick={() => setOpen((v) => !v)}>
              {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        </Box>

        <Collapse in={open}>{renderContent(false)}</Collapse>
      </Paper>

      <Dialog fullScreen open={openFs} onClose={() => setOpenFs(false)} sx={{ zIndex: UI.Z_INDEX.visualization.analysisDialog }}>
        <AppBar position="sticky" color="inherit" elevation={1}>
          <Toolbar>
            <IconButton edge="start" onClick={() => setOpenFs(false)}>
              <CloseIcon />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6">
              {TITLE}
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <IconButton size="small" title={VISUALIZATION.common.map.actions.downloadPng} onClick={handleDownloadImage}>
                <span className="material-symbols-outlined outlined">file_png</span>
              </IconButton>
              <IconButton size="small" title={VISUALIZATION.common.actions.downloadCsv} onClick={handleExportExcel}>
                <span className="material-symbols-outlined outlined" style={{ fontSize: 45 }}>
                  csv
                </span>
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>

        <Box sx={{ p: 3, width: "100%", display: "flex", flexDirection: "column" }}>
          {renderContent(true)}
        </Box>
      </Dialog>
    </>
  );
}

