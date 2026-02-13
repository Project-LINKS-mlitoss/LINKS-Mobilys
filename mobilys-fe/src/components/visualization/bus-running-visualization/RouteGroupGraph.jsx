// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import {
  Paper, Typography, Box, Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer, IconButton, Collapse, Dialog, DialogContent, AppBar, Toolbar
} from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CloseIcon from "@mui/icons-material/Close";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList
} from "recharts";
import { saveAs } from "file-saver";
import { downloadElementAsPng } from "../export/html2canvasExport";
import { fmtInt } from "./StopGraph";

import { buildFilename } from "../buildFilename";
import { VISUALIZATION } from "@/strings";

const EXPAND_COL_W = 40;
const CELL = { py: 0.5, px: 1 };
const CHILD_CELL = { fontSize: 14 };
const CHILD_INDENT = 6;

function groupTotal(childs) {
  if (!childs) return 0;
  return childs.reduce((acc, cur) => acc + (cur.frequency || 0), 0);
}

export default function RouteGroupGraph({
  data = [],
  scenarioName = VISUALIZATION.common.scenarioFallbackName,
  screenName = VISUALIZATION.titles.busRunningVisualization,
}) {
  const strings = VISUALIZATION.busRunningVisualization.components.graphExports.routeGroup;
  // card-level toggles
  const [open, setOpen] = React.useState(false);
  const [openDetail, setOpenDetail] = React.useState(false);
  const [openChart, setOpenChart] = React.useState(false);

  // per-row toggle (card)
  const [openGroup, setOpenGroup] = React.useState({});
  const toggleGroup = (name) => setOpenGroup((p) => ({ ...p, [name]: !p[name] }));

  // ---- FULLSCREEN STATES (per section) ----
  const [openFsDetail, setOpenFsDetail] = React.useState(false); // fullscreen for table
  const [openFsChart, setOpenFsChart] = React.useState(false);   // fullscreen for chart

  // FS table section internal toggles
  const [fsOpenDetail, setFsOpenDetail] = React.useState(true);
  const [openGroupFS, setOpenGroupFS] = React.useState({});
  const toggleGroupFS = (name) => setOpenGroupFS((p) => ({ ...p, [name]: !p[name] }));

  const fsTableRef = React.useRef(null);
  const fsChartRef = React.useRef(null);

  const processed = React.useMemo(
    () => (data || []).map((d) => ({ ...d, total: groupTotal(d.childs || []) })),
    [data]
  );

  const processedNZ = React.useMemo(() => {
    return processed
      .map((d) => {
        const nzChilds = (d.childs || []).filter((c) => (c.frequency || 0) > 0);
        return { ...d, childs: nzChilds, total: groupTotal(nzChilds) };
      })
      .filter((d) => d.total > 0);
  }, [processed]);

  const totalAll = React.useMemo(
    () => processedNZ.reduce((acc, d) => acc + d.total, 0),
    [processedNZ]
  );

  const chartData = React.useMemo(
    () => processedNZ.map((d) => ({ group: d.group_name, value: d.total })),
    [processedNZ]
  );

  const TICK_FONT_INLINE = 11;
  const TICK_FONT_FS = 12;
  const Y_WIDTH_INLINE = 140;
  const Y_WIDTH_FS = 180;
  const MIN_CHART_HEIGHT_FS = 420;
  const MAX_CHART_HEIGHT_FS = 1200;

  const margin = { top: 12, bottom: 12 };
  const ROW_HEIGHT = 28;

  const chartHeight = React.useMemo(
    () => chartData.length * ROW_HEIGHT + margin.top + margin.bottom,
    [chartData.length]
  );
  const chartHeightFS = React.useMemo(
    () => Math.min(Math.max(chartHeight, MIN_CHART_HEIGHT_FS), MAX_CHART_HEIGHT_FS),
    [chartHeight]
  );

  const handleCsvDownload = () => {
    const rows = [];
    rows.push([
      VISUALIZATION.busRunningVisualization.components.filterPanel.routeLabel,
      "route_id",
      VISUALIZATION.busRunningVisualization.components.graphPanel.axis.frequency,
    ]);
    processedNZ.forEach((d) => {
      if ((d.childs || []).length === 0) rows.push([d.group_name, "", d.total]);
      else (d.childs || []).forEach((c) => rows.push([d.group_name, c.name, c.frequency]));
    });
    const esc = (v) => {
      const s = v == null ? "" : String(v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = rows.map((r) => r.map(esc).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    saveAs(blob, buildFilename(scenarioName, screenName, "graph", strings.title, "csv"));
  };

  const handlePngDownload = async () => {
    const node = fsChartRef.current;
    if (!node) return;
    await downloadElementAsPng({
      element: node,
      filename: buildFilename(scenarioName, screenName, "graph", strings.chartTitle, "png"),
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      expandToScroll: true,
    });
  };

  return (
    <Paper sx={{ p: 2, mb: 2, position: "relative" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: open ? 2 : 0 }}>
        <Typography variant="h6" fontWeight={700}>{strings.title}</Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <IconButton size="small" onClick={() => setOpen((v) => !v)}>
            {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      <Collapse in={open}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: openDetail ? 1 : 2 }}>
          <Typography variant="subtitle1" fontWeight={700}>{strings.title}</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconButton size="small" onClick={() => setOpenFsDetail(true)}>
              <span className="material-symbols-outlined outlined">
              fullscreen
              </span>
            </IconButton>
            <IconButton size="small" onClick={() => setOpenDetail((v) => !v)}>
              {openDetail ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        </Box>
        <Collapse in={openDetail}>
          <TableContainer sx={{ maxHeight: "none", overflowY: "auto", overflowX: "hidden", mb: 2 }}>
            <Table stickyHeader size="small" sx={{ tableLayout: "auto", width: "100%" }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...CELL, width: EXPAND_COL_W }} />
                  <TableCell sx={CELL}>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {VISUALIZATION.busRunningVisualization.components.filterPanel.routeLabel}
                    </Typography>
                  </TableCell>
                  <TableCell sx={CELL} align="right">
                    <Typography variant="subtitle2" fontWeight="bold">
                      {VISUALIZATION.busRunningVisualization.components.graphPanel.axis.frequency}
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {processedNZ.map((d) => {
                  const isOpen = !!openGroup[d.group_name];
                  return (
                    <React.Fragment key={d.group_name}>
                      <TableRow hover>
                        <TableCell sx={{ ...CELL, width: EXPAND_COL_W }}>
                          <IconButton size="small" onClick={() => toggleGroup(d.group_name)}>
                            {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </TableCell>
                        <TableCell sx={{ ...CELL, fontWeight: 700 }}>{d.group_name}</TableCell>
                        <TableCell sx={{ ...CELL, fontWeight: 700 }} align="right">{fmtInt(d.total)}</TableCell>
                      </TableRow>

                      <TableRow>
                        <TableCell colSpan={3} sx={{ p: 0 }}>
                          <Collapse in={isOpen} timeout="auto" unmountOnExit>
                            <Table size="small" sx={{ width: "100%" }}>
                              <TableBody>
                                {(d.childs || []).map((c) => (
                                  <TableRow key={c.name} hover>
                                    <TableCell sx={{ pl: CHILD_INDENT, ...CHILD_CELL }} colSpan={2}>{c.name}</TableCell>
                                    <TableCell sx={CHILD_CELL} align="right">{fmtInt(c.frequency)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Collapse>

        {/* Chart Section */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: openChart ? 1 : 2 }}>
          <Typography variant="subtitle1" fontWeight={700}>{strings.chartTitle}</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconButton size="small" onClick={() => setOpenFsChart(true)}>
              <span className="material-symbols-outlined outlined">
              fullscreen
              </span>
            </IconButton>
            <IconButton size="small" onClick={() => setOpenChart((v) => !v)}>
              {openChart ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        </Box>
        <Collapse in={openChart}>
          <Box sx={{ width: "100%" }}>
            <ResponsiveContainer width="100%" height={Math.max(220, chartHeight)}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 12, right: 24, left: 16, bottom: 12 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: TICK_FONT_INLINE }} />
                <YAxis
                  type="category"
                  dataKey="group"
                  width={Y_WIDTH_INLINE}
                  tick={{ fontSize: TICK_FONT_INLINE }}
                  interval={0}
                />
                <Tooltip
                  formatter={(v) => [
                    v,
                    VISUALIZATION.busRunningVisualization.components.graphPanel.axis.frequency,
                  ]}
                />
                <Bar dataKey="value" fill="#7886d6">
                  <LabelList dataKey="value" position="right" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Collapse>
      </Collapse>

      {/* ===== FULLSCREEN: DETAIL (table) ===== */}
      <Dialog fullScreen open={openFsDetail} onClose={() => setOpenFsDetail(false)}>
        <AppBar position="sticky" color="inherit" elevation={1}>
          <Toolbar>
            <IconButton edge="start" onClick={() => setOpenFsDetail(false)}><CloseIcon /></IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" fontWeight={700}>
              {strings.title}
            </Typography>
            <IconButton size="small" title={strings.downloadCsv} onClick={handleCsvDownload}>
              <span
                className="material-symbols-outlined outlined"
                style={{ fontSize: 45 }}
              >
                csv
              </span></IconButton>
          </Toolbar>
        </AppBar>

        <DialogContent sx={{ p: 3 }}>
          <Box ref={fsTableRef} sx={{ width: "100%", minWidth: 600, height: "calc(100vh - 160px)", overflowY: "auto" }}>
            <Box sx={{ textAlign: "center", py: 3 }}>
              <Typography variant="h4" fontWeight="bold">{fmtInt(totalAll)}</Typography>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: fsOpenDetail ? 1 : 2 }}>
              <Typography variant="h6" fontWeight={700}></Typography>
              <IconButton size="small" onClick={() => setFsOpenDetail((v) => !v)}>
                {fsOpenDetail ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
            <Collapse in={fsOpenDetail}>
              <TableContainer sx={{ maxHeight: "none", overflowY: "auto", overflowX: "hidden", mb: 3 }}>
                <Table stickyHeader size="small" sx={{ tableLayout: "auto", width: "100%" }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ ...CELL, width: EXPAND_COL_W }} />
                      <TableCell sx={CELL}>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {VISUALIZATION.busRunningVisualization.components.filterPanel.routeLabel}
                        </Typography>
                      </TableCell>
                      <TableCell sx={CELL} align="right">
                        <Typography variant="subtitle2" fontWeight="bold">
                          {VISUALIZATION.busRunningVisualization.components.graphPanel.axis.frequency}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {processedNZ.map((d) => {
                      const isOpen = !!openGroupFS[d.group_name];
                      return (
                        <React.Fragment key={d.group_name}>
                          <TableRow hover>
                            <TableCell sx={{ ...CELL, width: EXPAND_COL_W }}>
                              <IconButton size="small" onClick={() => toggleGroupFS(d.group_name)}>
                                {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                              </IconButton>
                            </TableCell>
                            <TableCell sx={{ ...CELL, fontWeight: 700 }}>{d.group_name}</TableCell>
                            <TableCell sx={{ ...CELL, fontWeight: 700 }} align="right">{fmtInt(d.total)}</TableCell>
                          </TableRow>

                          <TableRow>
                            <TableCell colSpan={3} sx={{ p: 0 }}>
                              <Collapse in={isOpen} timeout="auto" unmountOnExit>
                                <Table size="small" sx={{ width: "100%" }}>
                                  <TableBody>
                                    {(d.childs || []).map((c) => (
                                      <TableRow key={c.name} hover>
                                        <TableCell sx={{ pl: CHILD_INDENT, ...CHILD_CELL }} colSpan={2}>{c.name}</TableCell>
                                        <TableCell sx={CHILD_CELL} align="right">{fmtInt(c.frequency)}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Collapse>
          </Box>
        </DialogContent>
      </Dialog>

      {/* ===== FULLSCREEN: CHART ===== */}
      <Dialog fullScreen open={openFsChart} onClose={() => setOpenFsChart(false)}>
        <AppBar position="sticky" color="inherit" elevation={1}>
          <Toolbar>
            <IconButton edge="start" onClick={() => setOpenFsChart(false)}><CloseIcon /></IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" fontWeight={700}>
              {strings.chartTitle}
            </Typography>
            {/* Download PNG for graph */}
            <IconButton size="small" title={strings.downloadPng} onClick={handlePngDownload}>
              <span
                className="material-symbols-outlined outlined"
                style={{ fontSize: 45 }}
              >
                file_png
              </span></IconButton>
          </Toolbar>
        </AppBar>

        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ width: "100%" }}>
            {/* wrap chart with a ref for html2canvas */}
            <Box ref={fsChartRef} sx={{ width: "100%" }}>
              <ResponsiveContainer width="100%" height={chartHeightFS}>
                <BarChart data={chartData} layout="vertical"  margin={{ top: 24, right: 24, left: 20, bottom: 20 }} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: TICK_FONT_FS }}
                    label={{
                      value: VISUALIZATION.busRunningVisualization.components.graphPanel.axis.frequency,
                      position: "insideBottom",
                      offset: -8,
                      fontSize: TICK_FONT_FS,
                    }}
                  />
                  <YAxis
                    type="category"
                    dataKey="group"
                    width={Y_WIDTH_FS}
                    tick={{ fontSize: TICK_FONT_FS }}
                    interval={0}
                  />
                  <Tooltip
                    formatter={(val) => [
                      val,
                      VISUALIZATION.busRunningVisualization.components.graphPanel.axis.frequency,
                    ]}
                  />
                  <Bar dataKey="value" fill="#7886d6">
                    <LabelList dataKey="value" position="right" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    </Paper>
  );
}
