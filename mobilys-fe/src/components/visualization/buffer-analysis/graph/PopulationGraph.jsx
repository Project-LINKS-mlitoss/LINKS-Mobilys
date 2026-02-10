// src/components/visualization/buffer_analysis/graph/PopulationGraph.jsx
import React, { useMemo, useRef, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Box, Typography, IconButton, Paper, Dialog, AppBar, Toolbar, TableContainer,
  Table, TableHead, TableRow, TableCell, TableBody, Collapse,
} from "@mui/material";
import {
  Close as CloseIcon,
} from "@mui/icons-material";
import * as XLSX from "xlsx";
import { downloadElementAsPng } from "../../export/html2canvasExport";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { buildFilename } from "../../buildFilename";
import { VISUALIZATION } from "@/strings";

/* ---------------- helpers---------------- */

// prefer common containers; fall back to item itself
const pickPopulationContainer = (e) =>
  e?.population ??
  e?.population_within_buffer ??
  e?.populationWithinBuffer ??
  e?.population_on_buffer_area ??
  e ?? {};

// Handles numbers like "12,345", fullwidth digits, etc.
const cleanNum = (v) => {
  if (v == null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const fw = "０１２３４５６７８９，．";
    const ascii = "0123456789,.";
    const toAscii = (s) =>
      s.replace(/[０-９，．]/g, (ch) => {
        const i = fw.indexOf(ch);
        return i >= 0 ? ascii[i] : ch;
      });
    const s = toAscii(v).replace(/[^0-9.+\-eE]/g, "");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

// flatten nested objects and collect numeric leaves with their path keys
const flattenNumbers = (obj, prefix = "", out = []) => {
  if (!obj || typeof obj !== "object") return out;
  for (const [k, val] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (val && typeof val === "object") {
      flattenNumbers(val, key, out);
    } else if (typeof val === "number" || typeof val === "string") {
      const num = cleanNum(val);
      if (Number.isFinite(num) && num !== 0) out.push([key, num]);
    }
  }
  return out;
};

// matchers for age buckets (with fullwidth and JP variants)
const re014 = /(0[\-~–]?14|\uFF10[\-\uFF5E\u301C]?\uFF11\uFF14|0_14|0to14|0–14|\uFF10\uFF5E\uFF11\uFF14|\uFF10\u2212\uFF11\uFF14|\uFF10-\uFF11\uFF14|under\s*15|0-?14|0\u301C14|0\uFF5E14|\uFF10\u301C\uFF11\uFF14|child|children)/i;
const re1564 = /(15[\-~–]?64|\uFF11\uFF15[\-\uFF5E\u301C]?\uFF16\uFF14|15_64|15to64|15–64|\uFF11\uFF15\uFF5E\uFF16\uFF14|\uFF11\uFF15\u2212\uFF16\uFF14|\uFF11\uFF15-\uFF16\uFF14|working|worker|\u751F\u7523|15-?64|15\u301C64|15\uFF5E64|\uFF11\uFF15\u301C\uFF16\uFF14)/i;
const re65 = /(65\+|65[\-~–]?up|\uFF16\uFF15\+|\uFF16\uFF15[\-\uFF5E\u301C]?\u4EE5\u4E0A|65_up|65plus|65\u4EE5\u4E0A|elder|old|\u9AD8\u9F62|\u8001\u5E74|age_65_up|65-?\+?)/i;

const extractAgeBuckets = (container) => {
  const direct0 = cleanNum(container?.age_0_14 ?? container?.["0_14"] ?? container?.age0_14);
  const direct1 = cleanNum(container?.age_15_64 ?? container?.["15_64"] ?? container?.age15_64);
  const direct2 = cleanNum(container?.age_65_up ?? container?.["65_up"] ?? container?.age65_up);

  if (direct0 || direct1 || direct2) {
    return { age_0_14: direct0, age_15_64: direct1, age_65_up: direct2 };
  }

  const pairs = flattenNumbers(container);
  let a0 = 0, a1 = 0, a2 = 0;
  for (const [k, num] of pairs) {
    if (re014.test(k)) a0 += num;
    else if (re1564.test(k)) a1 += num;
    else if (re65.test(k)) a2 += num;
  }
  return { age_0_14: a0, age_15_64: a1, age_65_up: a2 };
};

// normalize cutoff_time (accept seconds or minutes; fallback with minute hint)
const toSeconds = (raw, fallbackMin) => {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return (fallbackMin ?? 0) * 60;
  return n >= 600 ? n : Math.round(n) * 60;
};

/* ---------------- tooltip ---------------- */
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length && payload[0].payload) {
    const p = payload[0].payload;
    const total = (p.age_0_14 ?? 0) + (p.age_15_64 ?? 0) + (p.age_65_up ?? 0);
    return (
      <div style={{ background: "#fff", border: "1px solid #ccc", padding: 8 }}>
        <p><strong>{label}</strong></p>
        <p style={{ color: "#000" }}>
          {VISUALIZATION.bufferAnalysis.components.graphs.population.tooltip.total}:{" "}
          {total.toLocaleString()}
          {VISUALIZATION.bufferAnalysis.components.graphs.population.tooltip.peopleSuffix}
        </p>
        {payload.map((item, i) => (
          <p key={i} style={{ color: item.fill }}>
            {item.name}: {Number(item.value ?? 0).toLocaleString()}
            {VISUALIZATION.bufferAnalysis.components.graphs.population.tooltip.peopleSuffix}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

/* ---------------- main  ---------------- */
export default function PopulationGraph({
  data = [],
  visibleCount,
  scenarioName = VISUALIZATION.common.scenarioFallbackName,
  screenName = VISUALIZATION.titles.bufferAnalysis,
}) {
  const [openFs, setOpenFs] = useState(false);
  const [open, setOpen] = useState(true);
  const chartRef = useRef(null);
  const chartFsRef = useRef(null);

  // sort & normalize (assume 10,20,... fallback minutes)
  const TIME_INTERVALS = useMemo(
    () => Array.from({ length: Math.max(1, data?.length || 9) }, (_, i) => (i + 1) * 10),
    [data?.length]
  );

  const sorted = useMemo(() => {
    const arr = Array.isArray(data) ? [...data] : [];
    return arr
      .map((d, i) => ({
        cutoff_time: toSeconds(d?.cutoff_time, TIME_INTERVALS[i] ?? 10),
        container: pickPopulationContainer(d),
      }))
      .sort((a, b) => (a.cutoff_time ?? 0) - (b.cutoff_time ?? 0));
  }, [data, TIME_INTERVALS]);

  // apply visibleCount (1..N buckets) if provided
  const sliced = useMemo(() => {
    if (typeof visibleCount !== "number") return sorted;
    const n = Math.max(1, Math.min(sorted.length, Math.round(visibleCount)));
    return sorted.slice(0, n);
  }, [sorted, visibleCount]);

  // build rows 
  const rows = useMemo(() => {
    return sliced.map((e) => {
      const ages = extractAgeBuckets(e.container);
      const cutoffLabel =
        e.cutoff_time != null
          ? `${Math.round(e.cutoff_time / 60)}${VISUALIZATION.bufferAnalysis.components.map.time.minutesSuffix}`
          : "";
      const total = (ages.age_0_14 || 0) + (ages.age_15_64 || 0) + (ages.age_65_up || 0);
      return { cutoffLabel, ...ages, total };
    });
  }, [sliced]);

  const chartData = rows.map(r => ({
    cutoff: r.cutoffLabel,
    age_0_14: r.age_0_14,
    age_15_64: r.age_15_64,
    age_65_up: r.age_65_up,
  }));

  const minChartWidth = Math.max(720, (chartData?.length || 0) * 90);

  /* ---- PNG (chart only) ---- */
  const handleDownloadImage = async () => {
    const el = openFs ? chartFsRef.current : chartRef.current;
    if (!el) return;
    await downloadElementAsPng({
      element: el,
      filename: buildFilename(
      scenarioName,
      screenName,
      "graph",
      VISUALIZATION.bufferAnalysis.components.graphs.population.export.graphName,
      "png"
    ),
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      expandToScroll: true,
    });
  };

  const handleExportExcel = () => {
    // Build data rows
    const wsData = [
      [
        VISUALIZATION.bufferAnalysis.components.graphs.population.export.headers.time,
        VISUALIZATION.bufferAnalysis.components.graphs.population.export.headers.total,
        VISUALIZATION.bufferAnalysis.components.graphs.population.export.headers.age0To14,
        VISUALIZATION.bufferAnalysis.components.graphs.population.export.headers.age15To64,
        VISUALIZATION.bufferAnalysis.components.graphs.population.export.headers.age65Up,
      ],
    ];
    rows.forEach((r) => {
      wsData.push([r.cutoffLabel, r.total, r.age_0_14, r.age_15_64, r.age_65_up]);
    });

    // Convert to CSV
    const escapeCSV = (val) => {
      const s = String(val ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = wsData.map((row) => row.map(escapeCSV).join(",")).join("\n");

    // Download as CSV (with BOM for JP in Excel)
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildFilename(
      scenarioName,
      screenName,
      "graph",
      VISUALIZATION.bufferAnalysis.components.graphs.population.export.graphName,
      "csv"
    );
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const headerCellSx = {
    py: 1, px: 1.5, position: "sticky", top: 0, zIndex: 1,
    bgcolor: "background.paper", fontWeight: 700,
  };
  const bodyCellSx = { py: 1.25, px: 1.5, borderBottom: (t) => `1px solid ${t.palette.divider}` };

  const renderChart = (ref) => (
    <Box ref={ref} sx={{ width: "100%", height: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 16, right: 16, left: 8, bottom: 10 }}>
          <XAxis
            dataKey="cutoff"
            interval={0}
            angle={-30}
            textAnchor="end"
            height={56}
            tick={{ fontSize: 12 }}
            tickFormatter={(label) =>
              label === `0${VISUALIZATION.bufferAnalysis.components.map.time.minutesSuffix}`
                ? ""
                : label
            }
          />
          <YAxis
            tick={{fontSize:12}}
            allowDecimals={false}
            tickFormatter={(v) =>
              `${Number(v).toLocaleString("ja-JP")}${VISUALIZATION.bufferAnalysis.components.graphs.population.tooltip.peopleSuffix}`
            }
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend verticalAlign="bottom" height={28} iconType="circle" />
          <Bar
            dataKey="age_0_14"
            stackId="a"
            fill="#64b5f6"
            name={VISUALIZATION.bufferAnalysis.components.graphs.population.export.headers.age0To14}
          />
          <Bar
            dataKey="age_15_64"
            stackId="a"
            fill="#81c784"
            name={VISUALIZATION.bufferAnalysis.components.graphs.population.export.headers.age15To64}
          />
          <Bar
            dataKey="age_65_up"
            stackId="a"
            fill="#ffb74d"
            name={VISUALIZATION.bufferAnalysis.components.graphs.population.export.headers.age65Up}
          />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );

  const renderTable = (isFs = false) => (
    <TableContainer
      sx={{ mt: 2, maxHeight: isFs ? 420 : 260, overflow: "auto", scrollbarGutter: "stable both-edges" }}
    >
      <Table stickyHeader size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
        <colgroup>
          <col style={{ width: 110 }} />
          <col style={{ width: 160 }} />
          <col style={{ width: 160 }} />
          <col style={{ width: 160 }} />
          <col style={{ width: 160 }} /> 
        </colgroup>
        <TableHead>
          <TableRow>
            <TableCell sx={headerCellSx}>
              {VISUALIZATION.bufferAnalysis.components.graphs.population.export.headers.time}
            </TableCell>
            <TableCell sx={headerCellSx}>
              {VISUALIZATION.bufferAnalysis.components.graphs.population.export.headers.total}
            </TableCell>
            <TableCell sx={headerCellSx}>
              {VISUALIZATION.bufferAnalysis.components.graphs.population.export.headers.age0To14}
            </TableCell>
            <TableCell sx={headerCellSx}>
              {VISUALIZATION.bufferAnalysis.components.graphs.population.export.headers.age15To64}
            </TableCell>
            <TableCell sx={headerCellSx}>
              {VISUALIZATION.bufferAnalysis.components.graphs.population.export.headers.age65Up}
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} sx={{ py: 3, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  {VISUALIZATION.bufferAnalysis.components.graphs.population.emptyState}
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.cutoffLabel}>
                <TableCell sx={bodyCellSx}>{r.cutoffLabel}</TableCell>
                <TableCell sx={bodyCellSx}>
                  {r.total.toLocaleString()}
                  {VISUALIZATION.bufferAnalysis.components.graphs.population.tooltip.peopleSuffix}
                </TableCell>
                <TableCell sx={bodyCellSx}>
                  {r.age_0_14.toLocaleString()}
                  {VISUALIZATION.bufferAnalysis.components.graphs.population.tooltip.peopleSuffix}
                </TableCell>
                <TableCell sx={bodyCellSx}>
                  {r.age_15_64.toLocaleString()}
                  {VISUALIZATION.bufferAnalysis.components.graphs.population.tooltip.peopleSuffix}
                </TableCell>
                <TableCell sx={bodyCellSx}>
                  {r.age_65_up.toLocaleString()}
                  {VISUALIZATION.bufferAnalysis.components.graphs.population.tooltip.peopleSuffix}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <>
      <Paper elevation={2} sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: open ? 2 : 0 }}>
          <Typography fontWeight={700} variant="h6">
            {VISUALIZATION.bufferAnalysis.components.graphs.population.title}
          </Typography>
          <Box>
            <IconButton
              size="small"
              title={VISUALIZATION.bufferAnalysis.components.graphs.population.actions.expand}
              onClick={() => setOpenFs(true)}
              sx={{ mr: 1 }}
            >
            <span class="material-symbols-outlined outlined">
            fullscreen
            </span>
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setOpen(v => !v)}
              title={open ? VISUALIZATION.common.dialog.close : VISUALIZATION.common.dialog.open}
            >
              {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        </Box>

        <Collapse in={open}>
          <Box sx={{ height: 300, bgcolor: "#fff", overflowX: "auto" }}>
            <Box sx={{ minWidth: minChartWidth, height: "100%" }}>
              {renderChart(chartRef)}
            </Box>
          </Box>
          {renderTable(false)}
        </Collapse>
      </Paper>

      <Dialog fullScreen open={openFs} onClose={() => setOpenFs(false)} sx={{ zIndex: (t) => t.zIndex.modal + 3000 }}>
        <AppBar
          sx={{
            position: "sticky",
            top: 0,
            bgcolor: "background.paper",
            color: "inherit",
            zIndex: (t) => t.zIndex.appBar,
          }}
          elevation={1}
        >
          <Toolbar>
            <IconButton edge="start" onClick={() => setOpenFs(false)}><CloseIcon /></IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" fontWeight={700}>
              {VISUALIZATION.bufferAnalysis.components.graphs.population.title}
            </Typography>
            <IconButton
              size="small"
              title={VISUALIZATION.bufferAnalysis.components.graphs.population.actions.downloadPngGraphOnly}
              onClick={handleDownloadImage}
            >
              <span class="material-symbols-outlined outlined" style ={{ fontSize: 45 }}>
                file_png
              </span>
            </IconButton>
            <IconButton
              size="small"
              title={VISUALIZATION.bufferAnalysis.components.graphs.population.actions.exportExcel}
              onClick={handleExportExcel}
            >
                <span class="material-symbols-outlined outlined" style ={{ fontSize: 45 }}>
                  csv
                </span>
            </IconButton>
          </Toolbar>
        </AppBar>

        <Box
          sx={{
            p: 2,
            backgroundColor: "#fff",
            height: { xs: "calc(100dvh - 56px)", sm: "calc(100dvh - 64px)" },
            overflow: "auto",
          }}
        >
          <Box sx={{ height: 420, mb: 2 }}>
            {renderChart(chartFsRef)}
          </Box>
          {renderTable(true)}
        </Box>
      </Dialog>
    </>
  );
}
