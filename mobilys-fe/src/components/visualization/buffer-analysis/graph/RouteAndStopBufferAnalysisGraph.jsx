import React, { useState, useMemo, useRef } from "react";
import {
  Paper, Box, Typography, IconButton, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, AppBar, Toolbar, Collapse,
} from "@mui/material";
import {
  Close as CloseIcon,
} from "@mui/icons-material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { downloadElementAsPng } from "../../export/html2canvasExport";
import * as XLSX from "xlsx";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import { trimText } from "../../../../utils/text";
import { VISUALIZATION } from "@/strings";

const TITLE = VISUALIZATION.bufferAnalysis.components.graphs.routeAndStop.title;

export default function RouteAndStopBufferAnalysisGraph({
  data = [],
}) {
  const [openFs, setOpenFs] = useState(false);
  const [open, setOpen] = useState(true);
  const chartRef = useRef(null);

  // to minutes (server may send seconds >=600)
  const toMinutes = (raw) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    return n >= 600 ? Math.round(n / 60) : Math.round(n);
  };

  // sort once by time (asc) and drop accidental duplicate minutes
  const sortedBuckets = useMemo(() => {
    const arr = (Array.isArray(data) ? data : []).slice()
      .filter(Boolean)
      .sort((a, b) => toMinutes(a?.cutoff_time) - toMinutes(b?.cutoff_time));

    // de-dupe by minute (keep first per minute)
    const seen = new Set();
    return arr.filter((b) => {
      const m = toMinutes(b?.cutoff_time);
      if (seen.has(m)) return false;
      seen.add(m);
      return true;
    });
  }, [data]);

  // Build chart data (per time bucket)
  const chartData = useMemo(() => {
    return sortedBuckets.map((tg) => {
      const endMin = toMinutes(tg?.cutoff_time);
      const timeRange = `${endMin}${VISUALIZATION.bufferAnalysis.components.map.time.minutesSuffix}`;

      const routeCount = (tg?.routes_data || []).reduce(
        (sum, grp) => sum + (grp?.routes?.length || 0),
        0
      );
      const stopCount = (tg?.routes_data || []).reduce(
        (sumG, grp) =>
          sumG + (grp?.routes || []).reduce((s, r) => s + (r?.stops?.length || 0), 0),
        0
      );

      return { timeRange, routeCount, stopCount };
    });
  }, [sortedBuckets]);

  const yTicks = useMemo(() => {
    const all = chartData.flatMap((d) => [d.routeCount, d.stopCount]);
    const maxVal = Math.max(...all, 0);
    const maxTicks = 10;
    const step = maxVal > 0 ? Math.ceil(maxVal / (maxTicks - 1)) : 1;
    let t = Array.from(
      { length: Math.min(maxTicks, Math.floor(maxVal / step) + 1) },
      (_, i) => i * step
    );
    if (t[t.length - 1] < maxVal) t.push(maxVal);
    return t;
  }, [chartData]);

  const handleDownloadImage = async () => {
    const el = chartRef.current;
    if (!el) return;
    await downloadElementAsPng({
      element: el,
      filename: VISUALIZATION.bufferAnalysis.components.graphs.routeAndStop.export.pngFilename,
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      expandToScroll: true,
    });
  };


  const handleExportExcel = () => {
    const rows = [
      [
        VISUALIZATION.bufferAnalysis.components.graphs.routeAndStop.export.headers.time,
        VISUALIZATION.bufferAnalysis.components.graphs.routeAndStop.export.headers.groupName,
        VISUALIZATION.bufferAnalysis.components.graphs.routeAndStop.export.headers.routeId,
        VISUALIZATION.bufferAnalysis.components.graphs.routeAndStop.export.headers.stopInfo,
      ],
    ];
    const merges = [];

    const minutesList = (Array.isArray(data) ? data : [])
      .slice()
      .sort((a, b) => toMinutes(a?.cutoff_time) - toMinutes(b?.cutoff_time));

    minutesList.forEach((bucket) => {
      const minuteLabel = `${toMinutes(bucket?.cutoff_time)}${VISUALIZATION.bufferAnalysis.components.map.time.minutesSuffix}`;
      const groups = Array.isArray(bucket?.routes_data) ? bucket.routes_data : [];

      if (groups.length === 0) {
        rows.push([minuteLabel, "", "", ""]);
        return;
      }

      const minuteStart = rows.length;

      groups.forEach((grp) => {
        const groupName =
          grp?.route_group ??
          grp?.route_group_name ??
          grp?.group_name ??
          "";

        const routes = Array.isArray(grp?.routes) ? grp.routes : [];

        if (routes.length === 0) {
          rows.push([minuteLabel, groupName, "", ""]);
          return;
        }

        routes.forEach((route) => {
          const routeId = route?.route_id ?? route?.route_code ?? "";
          const stopsArr = Array.isArray(route?.stops) ? route.stops : [];

          const routeStart = rows.length;

          if (stopsArr.length === 0) {
            rows.push([minuteLabel, groupName, routeId, ""]);
          } else {
            stopsArr.forEach((s, idx) => {
              const stopInfo =
                typeof s === "string"
                  ? s
                  : [s?.stop_name, s?.stop_id].filter(Boolean).join(" ");
              rows.push([minuteLabel, groupName, routeId, stopInfo]);
            });
          }

          const routeEnd = rows.length - 1;
          if (routeEnd > routeStart) {
            merges.push({ s: { r: routeStart, c: 1 }, e: { r: routeEnd, c: 1 } }); // B
            merges.push({ s: { r: routeStart, c: 2 }, e: { r: routeEnd, c: 2 } }); // C
          }
        });
      });

      const minuteEnd = rows.length - 1;
      if (minuteEnd > minuteStart) {
        merges.push({ s: { r: minuteStart, c: 0 }, e: { r: minuteEnd, c: 0 } }); // A
      }
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!merges"] = merges;
    ws["!cols"] = [{ wch: 6 }, { wch: 18 }, { wch: 20 }, { wch: 80 }];

    XLSX.utils.book_append_sheet(
      wb,
      ws,
      VISUALIZATION.bufferAnalysis.components.graphs.routeAndStop.export.sheetName
    );
    XLSX.writeFile(
      wb,
      VISUALIZATION.bufferAnalysis.components.graphs.routeAndStop.export.excelFilename
    );
  };




  const renderContent = (isFs = false) => (
    <Box>
      {/* Chart */}
      <Box sx={{ overflowX: "auto", overflowY: "hidden", width: "100%", height: isFs ? "60vh" : "100%" }}>
        <Box ref={chartRef} sx={{ minWidth: `${Math.max(chartData.length * 120, 480)}px`, height: isFs ? "60vh" : 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timeRange" tick={{ fontSize: 12, fontWeight: 500 }} />
              <YAxis tick={{ fontSize: 12, fontWeight: 500 }} allowDecimals={false} ticks={yTicks} />
              <Tooltip formatter={(v, name) => [v, name]} />
              <Legend verticalAlign="bottom" iconType="circle" />
              <Bar
                dataKey="routeCount"
                name={VISUALIZATION.bufferAnalysis.components.graphs.routeAndStop.chart.routeCount}
                fill="#8884d8"
                barSize={30}
              />
              <Bar
                dataKey="stopCount"
                name={VISUALIZATION.bufferAnalysis.components.graphs.routeAndStop.chart.stopCount}
                fill="#82ca9d"
                barSize={30}
              />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Box>

      {/* Table */}
      <TableContainer
        sx={{ maxHeight: isFs ? 600 : 200, width: "100%", mx: isFs ? "auto" : 0, overflowY: "auto", overflowX: "hidden", mt: 2 }}
      >
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {[
                VISUALIZATION.bufferAnalysis.components.graphs.routeAndStop.export.headers.time,
                VISUALIZATION.bufferAnalysis.components.graphs.routeAndStop.export.headers.groupName,
                VISUALIZATION.bufferAnalysis.components.graphs.routeAndStop.export.headers.routeId,
                VISUALIZATION.bufferAnalysis.components.graphs.routeAndStop.export.headers.stopInfo,
              ].map((h) => (
                <TableCell key={h} sx={{ py: 0.5, px: 1 }}>
                  <Typography variant="body2" fontWeight="bold">{h}</Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedBuckets.map((tg) => {
              const total = (tg?.routes_data || []).reduce((sum, g) => sum + (g?.routes?.length || 0), 0);
              let placed = 0;
              const timeLabel = `${toMinutes(tg?.cutoff_time)}${VISUALIZATION.bufferAnalysis.components.map.time.minutesSuffix}`;

              return (tg?.routes_data || []).flatMap((grp) =>
                (grp?.routes || []).map((route, i) => {
                  const showTime = placed === 0;
                  const showGroup = i === 0;
                  const hideBorder = i !== (grp?.routes?.length || 0) - 1;
                  placed++;
                  return (
                    <TableRow key={`${tg.cutoff_time}-${grp?.route_group ?? grp?.route_group_name}-${route?.route_id}-${i}`}>
                      {showTime && (
                        <TableCell rowSpan={total} sx={{ verticalAlign: "top", py: 0.5, px: 1 }}>
                          <Typography variant="body2">{timeLabel}</Typography>
                        </TableCell>
                      )}
                      {showGroup && (
                        <TableCell rowSpan={grp?.routes?.length || 1} sx={{ verticalAlign: "top", py: 0.5, px: 1 }}>
                          <Typography variant="body2">{grp?.route_group ?? grp?.route_group_name ?? ""}</Typography>
                        </TableCell>
                      )}
                      <TableCell sx={{ py: 0.5, px: 1, borderBottom: hideBorder ? "none" : "" }}>
                        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                          <Typography component="span" variant="body2">{trimText(route?.route_id ?? "", 12)}</Typography>
                        </Box>
                      </TableCell>

                      <TableCell
                        sx={{
                          verticalAlign: "top",
                          whiteSpace: isFs ? "normal" : "nowrap",
                          wordBreak: isFs ? "break-word" : "normal",
                          py: 0.5,
                          px: 1,
                          borderBottom: hideBorder ? "none" : "",
                        }}
                      >
                        <Box component="ul" sx={{ m: 0, pl: 2 }}>
                          {(route?.stops || []).map((s, idx) => (
                            <li key={s.stop_id ?? `${s.stop_name}-${idx}`}>
                              <Typography variant="body2">{s.stop_name}</Typography>
                            </li>
                          ))}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  return (
    <>
      <Paper elevation={2} sx={{ p: 2, position: "relative", borderRadius: 2, mb: 2, boxShadow: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: open ? 2 : 0 }}>
          <Typography variant="h6" fontWeight="bold">{TITLE}</Typography>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <IconButton
              size="small"
              title={VISUALIZATION.bufferAnalysis.components.graphs.routeAndStop.actions.expand}
              onClick={() => setOpenFs(true)}
              sx={{ mr: 1 }}
            >
            <span class="material-symbols-outlined outlined">
            fullscreen
            </span>
            </IconButton>
            <IconButton size="small" onClick={() => setOpen((v) => !v)}>
              {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        </Box>

        <Collapse in={open}>{renderContent(false)}</Collapse>
      </Paper>

      <Dialog fullScreen open={openFs} onClose={() => setOpenFs(false)} sx={{ zIndex: 5000 }}>
        <AppBar position="sticky" color="inherit" elevation={1}>
          <Toolbar>
            <IconButton edge="start" onClick={() => setOpenFs(false)}><CloseIcon /></IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" fontWeight="bold">{TITLE}</Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <IconButton size="small" title="Download PNG" onClick={handleDownloadImage}>
                <span class="material-symbols-outlined outlined" style ={{ fontSize: 45 }}>
                  file_png
                </span>
              </IconButton>
              <IconButton size="small" title="Export Excel" onClick={handleExportExcel}>
                <span class="material-symbols-outlined outlined" style ={{ fontSize: 45 }}>
                  csv
                </span>
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>
        <Box sx={{ p: 3 }}>{renderContent(true)}</Box>
      </Dialog>
    </>
  );
}
