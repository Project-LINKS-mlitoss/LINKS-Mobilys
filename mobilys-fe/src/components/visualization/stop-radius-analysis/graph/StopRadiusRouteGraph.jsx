// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React, { useMemo, useRef, useState } from "react";
import {
  Paper,
  Box,
  Typography,
  IconButton,
  Dialog,
  AppBar,
  Toolbar,
  Autocomplete,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { downloadElementAsPng } from "../../export/html2canvasExport";
import * as XLSX from "xlsx";
import { VISUALIZATION } from "@/strings";
import { UI } from "../../../../constant/ui";

function buildStackedRouteDataset(routeGraph) {
  const allGroups = new Set();
  routeGraph?.forEach((sg) =>
    sg.routes?.forEach((rg) => allGroups.add(rg.route_group_id))
  );
  const headers = Array.from(allGroups);

  const rows = (routeGraph || []).map((sg) => {
    const row = { stop_group: sg.id };
    headers.forEach((h) => {
      const hit = sg.routes?.find((r) => r.route_group_id === h);
      row[h] = hit?.child?.length || 0;
    });
    row.__total = headers.reduce((acc, h) => acc + (Number(row[h]) || 0), 0);
    return row;
  });

  return { headers, rows };
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((a, p) => a + (p.value || 0), 0);
  return (
    <Box sx={{ p: 1, bgcolor: "#fff", border: "1px solid #eee", borderRadius: 1 }}>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
        {label}
      </Typography>
      {payload
        .filter((p) => p.value > 0)
        .map((p) => (
          <Box key={p.dataKey} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ width: 10, height: 10, bgcolor: p.color, borderRadius: 0.5 }} />
            <Typography variant="body2">
              {p.dataKey}: {p.value}
            </Typography>
          </Box>
        ))}
      <Box sx={{ mt: 0.5, borderTop: "1px solid #eee", pt: 0.5 }}>
        <Typography variant="body2" fontWeight={700}>
          {VISUALIZATION.common.labels.total}: {total}
        </Typography>
      </Box>
    </Box>
  );
}

export default function StopRadiusRouteGraph({ data }) {
  const [openFs, setOpenFs] = useState(false);
  const [open, setOpen] = useState(true);
  const captureRef = useRef(null);

  const { headers, rows } = useMemo(() => buildStackedRouteDataset(data || []), [data]);

  const COLORS = useMemo(
    () => headers.map((_, i) => `hsl(${(i * 57) % 360} 70% 50%)`),
    [headers]
  );

  const stopOptions = useMemo(() => rows.map((r) => r.stop_group), [rows]);
  const [selectedStops, setSelectedStops] = useState([]);
  const filteredRows = useMemo(() => {
    if (!selectedStops.length) return rows;
    const set = new Set(selectedStops);
    return rows.filter((r) => set.has(r.stop_group));
  }, [rows, selectedStops]);

  const title = <>{VISUALIZATION.stopRadiusAnalysis.components.routeGraph.title}</>;

  const handleDownloadImage = async (filename = "route_group_counts.png") => {
    const container = captureRef.current;
    if (!container) return;
    const scroller = container.querySelector(".chart-scroll");
    const inner = container.querySelector(".chart-inner");
    const legend = container.querySelector(".legend-wrap");

    const contentWidth = Math.max(
      inner?.scrollWidth || 0,
      legend?.scrollWidth || 0,
      container.scrollWidth
    );

    const prev = {
      containerWidth: container.style.width,
      scrollerOverflow: scroller?.style.overflowX,
      scrollerWidth: scroller?.style.width,
    };

    container.style.width = `${contentWidth}px`;
    if (scroller) {
      scroller.style.overflowX = "visible";
      scroller.style.width = `${contentWidth}px`;
    }

    try {
      await downloadElementAsPng({
        element: container,
        filename,
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        expandToScroll: false,
      });
    } finally {
      container.style.width = prev.containerWidth || "";
      if (scroller) {
        scroller.style.overflowX = prev.scrollerOverflow || "";
        scroller.style.width = prev.scrollerWidth || "";
      }
    }
  };
  const handleExportExcel = () => {
    const rowsSrc = filteredRows;
    const headerRow = [
      VISUALIZATION.stopRadiusAnalysis.labels.stop,
      ...headers,
      VISUALIZATION.common.labels.total,
    ];
    const aoa = [
      headerRow,
      ...rowsSrc.map((r) => [r.stop_group, ...headers.map((h) => r[h]), r.__total]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "route_groups.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const chartHeight = 320;
  const perStopWidth = 90;
  const chartWidth = Math.max(filteredRows.length * perStopWidth, 800);

  const ChartBox = ({ isFs }) => (
    <Box
      className="chart-scroll"
      sx={{
        width: "100%",
        height: isFs ? "60vh" : chartHeight,
        overflowX: "auto",
        overflowY: "hidden",
        pr: 1,
      }}
    >
      <Box
        className="chart-inner"
        sx={{ width: isFs ? Math.max(filteredRows.length * 110, 1200) : chartWidth }}
      >
        <BarChart
          width={isFs ? Math.max(filteredRows.length * 110, 1200) : chartWidth}
          height={isFs ? 600 : chartHeight}
          data={filteredRows}
          margin={{ top: 8, right: 16, left: 8, bottom: 80 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="stop_group"
            interval={0}
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 12 }}
          />
          <YAxis allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} />
          {headers.map((h, i) => (
            <Bar key={h} dataKey={h} stackId="routes" fill={COLORS[i]} />
          ))}
        </BarChart>
      </Box>
    </Box>
  );

  const MergedTableFs = () => {
    const visibleStops = (data || []).filter(
      (sg) => !selectedStops.length || selectedStops.includes(sg.id)
    );

    return (
      <TableContainer
        sx={{
          maxHeight: "42vh",
          overflowY: "auto",
          overflowX: "hidden",
          mt: 2,
        }}
      >
        <Table stickyHeader size="small" sx={{ tableLayout: "auto", width: "100%" }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ py: 0.5, px: 1 }}>
                <Typography variant="subtitle2" fontWeight="bold">
                  {VISUALIZATION.stopRadiusAnalysis.labels.stop}
                </Typography>
              </TableCell>
              <TableCell sx={{ py: 0.5, px: 1, width: 220 }}>
                <Typography variant="subtitle2" fontWeight="bold">
                  {VISUALIZATION.stopRadiusAnalysis.labels.routeGroup}
                </Typography>
              </TableCell>
              <TableCell sx={{ py: 0.5, px: 1 }}>
                <Typography variant="subtitle2" fontWeight="bold">
                  {VISUALIZATION.stopRadiusAnalysis.labels.routeName}
                </Typography>
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {visibleStops.map((sg) => {
              const groups = Array.isArray(sg.routes) ? sg.routes : [];
              const rowSpan = Math.max(groups.length, 1);

              if (groups.length === 0) {
                return (
                  <TableRow key={`${sg.id}-empty`}>
                    <TableCell rowSpan={1} sx={{ verticalAlign: "top", py: 0.5, px: 1 }}>
                      <Typography variant="body2" fontWeight={700}>
                        {sg.id}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ verticalAlign: "top", py: 0.5, px: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        {VISUALIZATION.stopRadiusAnalysis.components.routeGraph.emptyRouteGroup}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ verticalAlign: "top", py: 0.5, px: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {VISUALIZATION.stopRadiusAnalysis.components.routeGraph.emptyRoute}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              }

              return groups.map((rg, idx) => {
                const children = Array.isArray(rg.child) ? rg.child : [];
                return (
                  <TableRow key={`${sg.id}-${rg.route_group_id}-${idx}`}>
                    {idx === 0 && (
                      <TableCell
                        rowSpan={rowSpan}
                        sx={{ verticalAlign: "top", py: 0.5, px: 1, minWidth: 160 }}
                      >
                        <Typography variant="body2" fontWeight={700}>
                          {sg.id}
                        </Typography>
                      </TableCell>
                    )}

                    <TableCell sx={{ verticalAlign: "top", py: 0.5, px: 1 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {rg.route_group_id}
                      </Typography>
                    </TableCell>

                    <TableCell sx={{ verticalAlign: "top", py: 0.5, px: 1 }}>
                      {children.length ? (
                        <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                          {children.map((c) => {
                            const label = c?.route_short_name || c?.route_id || "-";
                            return (
                              <li key={c?.route_id}>
                                <Typography variant="body2" component="span">
                                  {label}
                                </Typography>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          {VISUALIZATION.stopRadiusAnalysis.components.routeGraph.emptyRoute}
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              });
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const StopFilter = (
    <Autocomplete
      multiple
      size="small"
      options={stopOptions}
      value={selectedStops}
      onChange={(_, v) => setSelectedStops(v)}
      renderInput={(params) => (
        <TextField
          {...params}
          label={VISUALIZATION.stopRadiusAnalysis.components.routeGraph.stopSearchLabel}
          placeholder={VISUALIZATION.stopRadiusAnalysis.components.routeGraph.stopSearchPlaceholder}
        />
      )}
      sx={{ mb: 1.5, maxWidth: 480 }}
    />
  );

  const content = (isFs = false) => (
    <Box>
      {/* {StopFilter} */}
      {isFs ? (
        <>
          <Box ref={captureRef}>
            <ChartBox isFs />
          </Box>
          <MergedTableFs />
        </>
      ) : (
        <>
          <ChartBox isFs={false} />
        </>
      )}
    </Box>
  );

  return (
    <>
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2, boxShadow: 2 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: open ? 1 : 0,
          }}
        >
          <Typography variant="h6" fontWeight={700}>
            {title}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <IconButton
              size="small"
              onClick={() => setOpenFs(true)}
              title={VISUALIZATION.common.actions.expand}
              sx={{ mr: 1 }}
            >
              <span className="material-symbols-outlined outlined">fullscreen</span>
            </IconButton>
            <IconButton size="small" onClick={() => setOpen((v) => !v)}>
              {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        </Box>

        <Collapse in={open}>{content(false)}</Collapse>
      </Paper>

      <Dialog
        fullScreen
        open={openFs}
        onClose={() => setOpenFs(false)}
        sx={{ zIndex: UI.Z_INDEX.visualization.analysisDialog }}
      >
        <AppBar sx={{ position: "relative", bgcolor: "inherit", color: "inherit" }}>
          <Toolbar>
            <IconButton edge="start" onClick={() => setOpenFs(false)}>
              <CloseIcon />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6">
              {VISUALIZATION.stopRadiusAnalysis.components.routeGraph.title}
            </Typography>
            <IconButton onClick={() => handleDownloadImage(`route_groups_${Date.now()}.png`)}>
              <span className="material-symbols-outlined outlined">file_png</span>
            </IconButton>
            <IconButton onClick={handleExportExcel} title="Export Excel">
                <span className="material-symbols-outlined outlined" style={{ fontSize: 45 }}>
                  csv
                </span>
            </IconButton>
          </Toolbar>
        </AppBar>
        <Box sx={{ p: 3 }}>{content(true)}</Box>
      </Dialog>
    </>
  );
}
