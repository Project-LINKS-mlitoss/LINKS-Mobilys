import { useMemo, useRef, useState } from "react";
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
import { downloadElementAsPng } from "./export/html2canvasExport";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { buildFilename } from "./buildFilename";
import { VISUALIZATION } from "@/strings";

const MINUTES_IN_HOUR = 60;
const MIN_CHART_WIDTH_PX = 720;
const CHART_WIDTH_PER_BUCKET_PX = 90;
const INLINE_CHART_HEIGHT_PX = 300;
const FS_CHART_HEIGHT_PX = 420;
const INLINE_TABLE_MAX_HEIGHT_PX = 260;
const FS_TABLE_MAX_HEIGHT_PX = 420;
const EXPORT_CANVAS_SCALE = 2;
const EXPORT_PRECAPTURE_WAIT_MS = 30;

const formatNumberJa = (n) => Number(n || 0).toLocaleString("ja-JP");

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length && payload[0].payload) {
    const p = payload[0].payload;
    const total = (p.age_0_14 ?? 0) + (p.age_15_64 ?? 0) + (p.age_65_up ?? 0);
    return (
      <div style={{ background: "#fff", border: "1px solid #ccc", padding: 8 }}>
        <p><strong>{label}</strong></p>
        <p style={{ color: "#000" }}>
          {VISUALIZATION.bufferAnalysis.components.graphs.population.tooltip.total}: {formatNumberJa(total)}
          {VISUALIZATION.bufferAnalysis.components.graphs.population.tooltip.peopleSuffix}
        </p>
        {payload.map((item, i) => (
          <p key={i} style={{ color: item.fill }}>
            {item.name}: {formatNumberJa(item.value)}
            {VISUALIZATION.bufferAnalysis.components.graphs.population.tooltip.peopleSuffix}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function PopulationIsochroneGraph({
  data = [],
  maxMinutes = null,
  scenarioName = VISUALIZATION.common.scenarioFallbackName,
  screenName = VISUALIZATION.titles.bufferAnalysis,
}) {
  const [openFs, setOpenFs] = useState(false);
  const [open, setOpen] = useState(true);
  const chartRef = useRef(null);
  const chartFsRef = useRef(null);

  const sorted = useMemo(() => {
    const arr = Array.isArray(data) ? [...data] : [];
    return arr.sort((a, b) => (a?.cutoff_time ?? 0) - (b?.cutoff_time ?? 0));
  }, [data]);

  const filtered = useMemo(() => {
    if (maxMinutes == null) return sorted;
    const limitSec = maxMinutes * MINUTES_IN_HOUR;
    return sorted.filter((d) => (d?.cutoff_time ?? 0) <= limitSec);
  }, [sorted, maxMinutes]);

  const rows = useMemo(() => {
    return filtered.map((e) => {
      const age_0_14 = Number(e.age_0_14 ?? 0);
      const age_15_64 = Number(e.age_15_64 ?? 0);
      const age_65_up = Number(e.age_65_up ?? 0);
      const total = age_0_14 + age_15_64 + age_65_up;
      return {
        cutoffLabel:
          e.cutoff_time != null
            ? `${Math.round(e.cutoff_time / MINUTES_IN_HOUR)}${VISUALIZATION.bufferAnalysis.components.map.time.minutesSuffix}`
            : "",
        age_0_14,
        age_15_64,
        age_65_up,
        total,
      };
    });
  }, [filtered]);

  const chartData = rows.map((r) => ({
    cutoff: r.cutoffLabel,
    age_0_14: r.age_0_14,
    age_15_64: r.age_15_64,
    age_65_up: r.age_65_up,
  }));

  const minChartWidth = Math.max(
    MIN_CHART_WIDTH_PX,
    (chartData?.length || 0) * CHART_WIDTH_PER_BUCKET_PX
  );
  const graphTitle = VISUALIZATION.bufferAnalysis.components.graphs.population.title;
  const zeroMinutesLabel = `0${VISUALIZATION.bufferAnalysis.components.map.time.minutesSuffix}`;

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
      scale: EXPORT_CANVAS_SCALE,
      useCORS: true,
      expandToScroll: true,
    });
  };

  /* ---- CSV export---- */
  const handleExportExcel = () => {
    const h = VISUALIZATION.bufferAnalysis.components.graphs.population.export.headers;
    const csvRows = [[h.time, h.age0To14, h.age15To64, h.age65Up, h.total]];
    (rows ?? []).forEach(r => {
      csvRows.push([r.cutoffLabel, r.age_0_14, r.age_15_64, r.age_65_up, r.total]);
    });

    const escapeCell = (v) => {
      const s = v == null ? "" : String(v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = csvRows.map(row => row.map(escapeCell).join(",")).join("\r\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = buildFilename(
      scenarioName,
      screenName,
      "graph",
      VISUALIZATION.bufferAnalysis.components.graphs.population.export.graphName,
      "csv"
    );
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
  };

  const headerCellSx = {
    py: 1,
    px: 1.5,
    position: "sticky",
    top: 0,
    zIndex: 1,
    bgcolor: "background.paper",
    fontWeight: 700,
  };
  const bodyCellSx = { py: 1.25, px: 1.5, borderBottom: (t) => `1px solid ${t.palette.divider}` };
  const showTimeCol = maxMinutes != null;

  const renderChart = (ref) => (
    <Box ref={ref} sx={{ width: "100%", height: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 24, left: 0, bottom: 10 }}>
          <XAxis
            dataKey="cutoff"
            interval={0}
            angle={-30}
            textAnchor="end"
            height={56}
            tick={{ fontSize: 12 }}
            tickFormatter={(label) => (label === zeroMinutesLabel ? "" : label)}
          />
          <YAxis
            width={80}
            allowDecimals={false}
            tick={{ fontSize: 12 }}
            tickMargin={12}
            padding={{ top: 12 }}
            tickFormatter={(v) =>
              `${formatNumberJa(v)}${VISUALIZATION.bufferAnalysis.components.graphs.population.tooltip.peopleSuffix}`
            }
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend verticalAlign="bottom" height={28} iconType="circle" />
          <Bar
            dataKey="age_0_14"
            stackId="a"
            fill="#64b5f6"
            name={VISUALIZATION.bufferAnalysis.components.map.ageGroups.age0To14}
          />
          <Bar
            dataKey="age_15_64"
            stackId="a"
            fill="#81c784"
            name={VISUALIZATION.bufferAnalysis.components.map.ageGroups.age15To64}
          />
          <Bar
            dataKey="age_65_up"
            stackId="a"
            fill="#ffb74d"
            name={VISUALIZATION.bufferAnalysis.components.map.ageGroups.age65Up}
          />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );

  const renderTable = (isFs = false) => (
    <TableContainer
      sx={{
        mt: 2,
        maxHeight: isFs ? FS_TABLE_MAX_HEIGHT_PX : INLINE_TABLE_MAX_HEIGHT_PX,
        overflow: "auto",
        scrollbarGutter: "stable both-edges",
      }}
    >
      <Table stickyHeader size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
        <colgroup>
          {showTimeCol && <col style={{ width: 110 }} />}
          <col style={{ width: 160 }} />
          <col style={{ width: 160 }} />
          <col style={{ width: 160 }} />
          <col style={{ width: 160 }} />
        </colgroup>

        <TableHead>
          <TableRow>
            {showTimeCol && (
              <TableCell sx={headerCellSx}>{VISUALIZATION.bufferAnalysis.components.graphs.population.export.headers.time}</TableCell>
            )}
            <TableCell sx={headerCellSx}>{VISUALIZATION.bufferAnalysis.components.graphs.population.export.headers.total}</TableCell>
            <TableCell sx={headerCellSx}>{VISUALIZATION.bufferAnalysis.components.graphs.population.export.headers.age0To14}</TableCell>
            <TableCell sx={headerCellSx}>{VISUALIZATION.bufferAnalysis.components.graphs.population.export.headers.age15To64}</TableCell>
            <TableCell sx={headerCellSx}>{VISUALIZATION.bufferAnalysis.components.graphs.population.export.headers.age65Up}</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showTimeCol ? 5 : 4} sx={{ py: 3, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">{VISUALIZATION.bufferAnalysis.components.graphs.population.emptyState}</Typography>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.cutoffLabel}>
                {showTimeCol && <TableCell sx={bodyCellSx}>{r.cutoffLabel}</TableCell>}
                <TableCell sx={{ ...bodyCellSx }}>
                  {formatNumberJa(r.total)}{VISUALIZATION.bufferAnalysis.components.graphs.population.tooltip.peopleSuffix}
                </TableCell>
                <TableCell sx={bodyCellSx}>{formatNumberJa(r.age_0_14)}{VISUALIZATION.bufferAnalysis.components.graphs.population.tooltip.peopleSuffix}</TableCell>
                <TableCell sx={bodyCellSx}>{formatNumberJa(r.age_15_64)}{VISUALIZATION.bufferAnalysis.components.graphs.population.tooltip.peopleSuffix}</TableCell>
                <TableCell sx={bodyCellSx}>{formatNumberJa(r.age_65_up)}{VISUALIZATION.bufferAnalysis.components.graphs.population.tooltip.peopleSuffix}</TableCell>
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
          <Typography fontWeight={700} variant="h6">{graphTitle}</Typography>
          <Box>
            <IconButton
              size="small"
              title={VISUALIZATION.bufferAnalysis.components.graphs.population.actions.expand}
              onClick={() => setOpenFs(true)}
              sx={{ mr: 1 }}
            >
              <span className="material-symbols-outlined outlined">
                fullscreen
              </span>
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setOpen((v) => !v)}
              title={open ? VISUALIZATION.common.dialog.close : VISUALIZATION.common.dialog.open}
            >
              {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        </Box>

        <Collapse in={open}>
          <Box sx={{ height: INLINE_CHART_HEIGHT_PX, bgcolor: "#fff", overflowX: "auto" }}>
            <Box sx={{ minWidth: minChartWidth, height: "100%" }}>
              {renderChart(chartRef)}
            </Box>
          </Box>
          {renderTable(false)}
        </Collapse>
      </Paper>

      <Dialog fullScreen open={openFs} onClose={() => setOpenFs(false)} sx={{ zIndex: (t) => t.zIndex.modal + 3000 }}>
        <AppBar
          position="sticky"
          color="inherit"
          elevation={1}
          sx={{ top: 0, bgcolor: "background.paper", zIndex: (t) => t.zIndex.appBar }}
        >
          <Toolbar>
            <IconButton edge="start" onClick={() => setOpenFs(false)} aria-label={VISUALIZATION.common.dialog.close}>
              <CloseIcon />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" fontWeight={700}>
              {graphTitle}
            </Typography>
            <IconButton
              size="small"
              title={VISUALIZATION.bufferAnalysis.components.graphs.population.actions.downloadPngGraphOnly}
              onClick={handleDownloadImage}
            >
              <span className="material-symbols-outlined outlined" style={{ fontSize: 45 }}>
                file_png
              </span>
            </IconButton>
            <IconButton
              size="small"
              title={VISUALIZATION.bufferAnalysis.components.graphs.population.actions.exportExcel}
              onClick={handleExportExcel}
            >
              <span className="material-symbols-outlined outlined" style={{ fontSize: 45 }}>
                csv
              </span>
            </IconButton>
          </Toolbar>
        </AppBar>

        <Box sx={{ p: 2, backgroundColor: "#fff" }}>
          <Box sx={{ height: FS_CHART_HEIGHT_PX, mb: 2 }}>
            {renderChart(chartFsRef)}
          </Box>
          {renderTable(true)}
        </Box>
      </Dialog>
    </>
  );
}
