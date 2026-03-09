// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React, { useMemo, useRef, useState } from "react";
import {
  Paper, Box, Typography, IconButton, Dialog, AppBar, Toolbar,
  Collapse, Grid, TableContainer, Table, TableHead, TableRow, TableCell, TableBody
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { downloadElementAsPng } from "../../export/html2canvasExport";
import * as XLSX from "xlsx";
import { Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import { VISUALIZATION } from "@/strings";
import { buildFilename } from "../../buildFilename";
import { UI } from "../../../../constant/ui";

const TITLE = VISUALIZATION.stopRadiusAnalysis.components.poiGraph.title;
const Y_TICK_DIVISIONS = 9;

function LegendHorizontal({ items = [], colors = [] }) {
  if (!items.length) return null;
  return (
    <Box
      className="legend-wrap"
      sx={{
        mt: 1,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignContent: "center",
        gap: 0.75,
        rowGap: 0.5,
        pb: 0.5,
        maxWidth: "100%",
      }}
    >
      {items.map((name, i) => (
        <Box key={name} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 0.25 }}>
          <Box sx={{ width: 10, height: 10, bgcolor: colors[i], borderRadius: 50 }} />
          <Typography sx={{ color: colors[i], fontSize: "0.825rem" }} variant="body2">
            {name}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export default function StopRadiusPOIGraph({
  data = [],
  radius,
  scenarioName = VISUALIZATION.common.scenarioFallbackName,
  screenName = VISUALIZATION.titles.stopRadiusAnalysis,
}) {
  const [openFs, setOpenFs] = useState(false);
  const [open, setOpen] = useState(true);

  const barRef = useRef(null);
  const scrollRef = useRef(null);
  const fsScrollRef = useRef(null);

  const stops = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const unionMode = useMemo(
    () => stops.length === 1 && (stops[0]?.id === "ALL" || stops[0]?.id == null),
    [stops]
  );

  const unionAgg = useMemo(() => {
    if (!unionMode) return [];
    const pois = stops[0]?.pois || [];
    const agg = pois.map((cat) => ({
      type: cat?.type ?? VISUALIZATION.stopRadiusAnalysis.components.poiGraph.unknownType,
      count: Array.isArray(cat?.data) ? cat.data.length : 0,
      items: Array.isArray(cat?.data) ? cat.data : [],
    }));
    agg.sort((a, b) => (b.count - a.count) || a.type.localeCompare(b.type, "ja"));
    return agg;
  }, [unionMode, stops]);

  const poiTypes = useMemo(() => unionAgg.map((a) => a.type), [unionAgg]);
  const colorMap = useMemo(() => {
    const n = Math.max(poiTypes.length, 1);
    const m = {};
    poiTypes.forEach((t, i) => {
      const hue = Math.round((i * 360) / n);
      m[t] = `hsl(${hue}, 70%, 55%)`;
    });
    return m;
  }, [poiTypes]);

  const barData = useMemo(
    () => unionAgg.map((a) => ({ type: a.type, count: a.count })),
    [unionAgg]
  );

  const yTicks = useMemo(() => {
    const maxVal = Math.max(0, ...barData.map((r) => r.count || 0));
    const step = maxVal > 0 ? Math.ceil(maxVal / Y_TICK_DIVISIONS) : 1;
    const arr = Array.from({ length: Math.floor(maxVal / step) + 1 }, (_, i) => i * step);
    return arr[arr.length - 1] < maxVal ? [...arr, maxVal] : arr;
  }, [barData]);

  const tableUnion = useMemo(() => {
    if (!unionMode) return [];
    return unionAgg.map((a) => {
      const seen = new Set();
      const items = [];
      (a.items || []).forEach(({ poi_name, address }) => {
        const key = `${poi_name}||${address || ""}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({ name: poi_name || "", address: address || "" });
        }
      });
      items.sort((x, y) => x.name.localeCompare(y.name, "ja"));
      return { type: a.type, items };
    });
  }, [unionMode, unionAgg]);

  // Export
  const handleDownloadImage = async (ref) => {
    await downloadElementAsPng({
      element: ref.current,
      filename: buildFilename(scenarioName, screenName, "graph", TITLE, "png"),
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      expandToScroll: true,
    });
  };

  const handleExportCSV = () => {
    if (!unionMode) return;
    const rows = [[
      VISUALIZATION.stopRadiusAnalysis.components.poiGraph.csvHeaders.radiusMeters,
      VISUALIZATION.stopRadiusAnalysis.components.poiGraph.csvHeaders.poiType,
      VISUALIZATION.stopRadiusAnalysis.components.poiGraph.csvHeaders.poiName,
      VISUALIZATION.stopRadiusAnalysis.components.poiGraph.csvHeaders.poiAddress,
    ]];
    if (tableUnion.length === 0) {
      rows.push([String(radius ?? ""), "", "", ""]);
    } else {
      tableUnion.forEach((r, idx) => {
        if (r.items.length === 0) {
          rows.push([idx === 0 ? String(radius ?? "") : "", r.type, "", ""]);
        } else {
          r.items.forEach(({ name, address }, i) =>
            rows.push([idx === 0 && i === 0 ? String(radius ?? "") : "", r.type, name, address || ""])
          );
        }
      });
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; 
    a.download = buildFilename(scenarioName, screenName, "graph", TITLE, "csv");
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const chartHeight = 260;
  const chartWidth = Math.max((barData.length || 1) * 60, 450);

  const ChartScrollable = ({ isFs }) => {
    const contentWidth = isFs
      ? Math.max((typeof window !== "undefined" ? window.innerWidth : 0) - 64, 600)
      : chartWidth;

    return (
      <Box sx={{ width: "100%", display: "flex", flexDirection: "column" }}>
        <Grid container alignItems="center" justifyContent="space-between" sx={{ width: "100%", px: 1, mb: 1 }} />
        <Box
          className="chart-scroll"
          ref={isFs ? fsScrollRef : scrollRef}
          sx={{
            width: "100%",
            height: isFs ? "50vh" : chartHeight,
            overflowX: isFs ? "hidden" : "auto",
            overflowY: "hidden",
            pr: 1,
          }}
        >
          <Box className="chart-inner" ref={barRef} sx={{ width: contentWidth }}>
            <BarChart
              width={contentWidth}
              height={isFs ? 420 : chartHeight}
              data={barData}
              margin={{ top: 16, right: 24, left: 0, bottom: 44 }}
              barCategoryGap="12%"
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="type"
                tick={{ fontSize: 12 }}
                interval={0}
                angle={-20}
                height={40}
                tickMargin={6}
              />
              <YAxis allowDecimals={false} ticks={yTicks} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar
                dataKey="count"
                name={VISUALIZATION.stopRadiusAnalysis.components.poiGraph.countLabel}
                barSize={26}
                isAnimationActive={false}
              >
                {barData.map((d) => (
                  <Cell key={d.type} fill={colorMap[d.type] || "#64b5f6"} />
                ))}
              </Bar>
            </BarChart>
          </Box>
        </Box>
        <LegendHorizontal items={poiTypes} colors={poiTypes.map((t) => colorMap[t])} />
      </Box>
    );
  };

  const renderCharts = (isFs = false) => (
    <Box sx={{ display: "flex", gap: 2, flexDirection: "column", alignItems: "stretch" }}>
      <ChartScrollable isFs={isFs} />
      {unionMode ? (
        <TableContainer
          sx={{
            maxHeight: isFs ? "30vh" : 220,
            width: "100%",
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ position: "sticky", top: 0, bgcolor: "background.paper" }} width={120}>
                  <Typography variant="body2" fontWeight="bold">
                    {VISUALIZATION.stopRadiusAnalysis.components.map.layers.radius}
                  </Typography>
                </TableCell>
                <TableCell sx={{ position: "sticky", top: 0, bgcolor: "background.paper" }} width={160}>
                  <Typography variant="body2" fontWeight="bold">
                    {VISUALIZATION.stopRadiusAnalysis.labels.poiType}
                  </Typography>
                </TableCell>
                <TableCell sx={{ position: "sticky", top: 0, bgcolor: "background.paper" }}>
                  <Typography variant="body2" fontWeight="bold">
                    {VISUALIZATION.stopRadiusAnalysis.labels.poiName}
                  </Typography>
                </TableCell>
                <TableCell sx={{ position: "sticky", top: 0, bgcolor: "background.paper" }}>
                  <Typography variant="body2" fontWeight="bold">
                    {VISUALIZATION.stopRadiusAnalysis.labels.poiAddress}
                  </Typography>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tableUnion.length === 0 ? (
                <TableRow>
                  <TableCell><Typography variant="body2">{(radius ?? "")}</Typography></TableCell>
                  <TableCell colSpan={3}><Typography variant="body2">—</Typography></TableCell>
                </TableRow>
              ) : (
                tableUnion.map((row, idx) => (
                  <TableRow key={row.type}>
                    {idx === 0 && (
                      <TableCell rowSpan={tableUnion.length} sx={{ verticalAlign: "top" }}>
                        <Typography variant="body2">{(radius ?? "")}</Typography>
                      </TableCell>
                    )}
                    <TableCell sx={{ verticalAlign: "top" }}>
                      <Typography variant="body2">{row.type}</Typography>
                    </TableCell>

                    <TableCell sx={{ verticalAlign: "top" }}>
                      <Box component="ul" sx={{ m: 0, pl: 2, listStyle: "disc", lineHeight: 1.25 }}>
                        {row.items.map(({ name }, i) => (
                          <li key={`${row.type}-name-${i}`} style={{ marginBottom: 2 }}>
                            <Typography variant="body2">{name}</Typography>
                          </li>
                        ))}
                      </Box>
                    </TableCell>

                    <TableCell sx={{ verticalAlign: "top" }}>
                      <Box component="ul" sx={{ m: 0, pl: 2, listStyle: "disc", lineHeight: 1.25 }}>
                        {row.items.map(({ address }, i) => (
                          <li key={`${row.type}-addr-${i}`} style={{ marginBottom: 2 }}>
                            <Typography variant="body2" sx={{ color: address ? "text.primary" : "text.disabled" }}>
                              {address || "—"}
                            </Typography>
                          </li>
                        ))}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}
    </Box>
  );

  return (
    <>
      <Paper elevation={2} sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: open ? 1 : 0 }}>
          <Typography variant="h6" fontWeight="bold">{TITLE}</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconButton
              size="small"
              title={VISUALIZATION.common.actions.expand}
              onClick={() => setOpenFs(true)}
            >
              <span className="material-symbols-outlined outlined">fullscreen</span>
            </IconButton>
            <IconButton size="small" onClick={() => setOpen((v) => !v)}>
              {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        </Box>

        <Collapse
          in={open}
          onEntered={() => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                const el = scrollRef.current;
                if (!el) return;
                const center = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
                el.scrollLeft = center;
              });
            });
          }}
        >
          {renderCharts(false)}
        </Collapse>
      </Paper>

      <Dialog
        fullScreen
        open={openFs}
        onClose={() => setOpenFs(false)}
        sx={{ zIndex: UI.Z_INDEX.visualization.analysisDialog }}
      >
        <AppBar
          position="sticky"
          color="inherit"
          elevation={1}
          sx={{ zIndex: UI.Z_INDEX.visualization.analysisDialog + 1 }}
        >
          <Toolbar>
            <IconButton edge="start" onClick={() => setOpenFs(false)}>
              <CloseIcon />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6">{TITLE}</Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <IconButton
                size="small"
                title="Download PNG"
                onClick={() => handleDownloadImage(barRef)}
              >
                <span className="material-symbols-outlined outlined" style={{ fontSize: 45 }}>
                  file_png
                </span>
              </IconButton>
              <IconButton size="small" title="Export CSV" onClick={handleExportCSV}>
                <span className="material-symbols-outlined outlined" style={{ fontSize: 45 }}>
                  csv
                </span>
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>
        <Box sx={{ p: 3, position: "relative" }}>
          {renderCharts(true)}
        </Box>
      </Dialog>
    </>
  );
}
