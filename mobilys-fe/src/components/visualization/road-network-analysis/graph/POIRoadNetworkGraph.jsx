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
import { Close as CloseIcon } from "@mui/icons-material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
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

import { VISUALIZATION } from "@/strings";
import { UI } from "@/constant/ui";
import { buildFilename } from "../../buildFilename";

const TITLE = VISUALIZATION.roadNetworkAnalysisOsm.components.graphs.poi.title;
const HEADERS = VISUALIZATION.roadNetworkAnalysisOsm.components.graphs.poi.csvHeaders;

const toMinutes = (seconds) => {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n / 60);
};

export default function POIRoadNetworkGraph({
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

  const filteredBuckets = useMemo(() => {
    if (!filterChartWithMinutes || maxMinutes == null) return sorted;
    const limitSec = maxMinutes * 60;
    return sorted.filter((tg) => (tg?.cutoff_time ?? 0) <= limitSec);
  }, [sorted, maxMinutes, filterChartWithMinutes]);

  const poiTypes = useMemo(() => {
    const types = new Set();
    for (const tg of filteredBuckets) {
      for (const p of tg?.poi_by_type || []) {
        if (p?.poi_type) types.add(p.poi_type);
      }
    }
    return Array.from(types);
  }, [filteredBuckets]);

  const colorMap = useMemo(() => {
    const n = Math.max(poiTypes.length, 1);
    const map = {};
    poiTypes.forEach((t, i) => {
      const hue = Math.round((i * 360) / n);
      map[t] = `hsl(${hue}, 70%, 55%)`;
    });
    return map;
  }, [poiTypes]);

  const barData = useMemo(() => {
    return filteredBuckets.map((tg) => {
      const minutes = toMinutes(tg?.cutoff_time ?? 0);
      const row = {
        timeRange: `${minutes}${VISUALIZATION.common.time.minutesSuffix}`,
      };

      let total = 0;
      for (const type of poiTypes) {
        const entry = (tg?.poi_by_type || []).find((x) => x?.poi_type === type);
        const count = Array.isArray(entry?.details) ? entry.details.length : 0;
        row[type] = count;
        total += count;
      }

      row.total = total;
      return row;
    });
  }, [filteredBuckets, poiTypes]);

  const ticks = useMemo(() => {
    const totals = barData.map((d) => d.total ?? 0);
    const maxVal = totals.length ? Math.max(...totals) : 0;
    if (maxVal <= 0) return [0];
    const maxTicks = 10;
    const step = Math.max(1, Math.ceil(maxVal / (maxTicks - 1)));
    let arr = Array.from(
      { length: Math.min(maxTicks, Math.floor(maxVal / step) + 1) },
      (_, i) => i * step,
    );
    if (arr[arr.length - 1] < maxVal) arr.push(maxVal);
    return arr;
  }, [barData]);

  const tableBlocks = useMemo(() => {
    const res = [];
    for (const tg of filteredBuckets) {
      const minute = toMinutes(tg?.cutoff_time ?? 0);
      const typeToItems = new Map();

      for (const p of tg?.poi_by_type || []) {
        const type = (p?.poi_type ?? "").toString().trim();
        if (!type) continue;
        if (!typeToItems.has(type)) typeToItems.set(type, []);

        (p?.details || []).forEach((d) => {
          const name = (d?.poi_name ?? "").toString().trim();
          const addrRaw = d?.address ?? d?.poi_address ?? "";
          const address = typeof addrRaw === "string" ? addrRaw.trim() : String(addrRaw ?? "");
          if (name) typeToItems.get(type).push({ name, address });
        });
      }

      const rows = [];
      for (const type of poiTypes) {
        const raw = typeToItems.get(type) || [];
        if (!raw.length) continue;

        // De-dup by (name||address)
        const seen = new Set();
        const items = [];
        for (const { name, address } of raw) {
          const key = `${name}||${address || ""}`;
          if (seen.has(key)) continue;
          seen.add(key);
          items.push({
            name,
            address: address && address.trim() ? address : VISUALIZATION.common.dateParts.noData,
          });
        }

        // Sort by name for stable output
        items.sort((a, b) => a.name.localeCompare(b.name, "ja"));
        rows.push({ type, items });
      }

      if (rows.length) res.push({ minute, rows });
    }
    return res;
  }, [filteredBuckets, poiTypes]);

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
    const rows = [
      [HEADERS.time, HEADERS.poiType, HEADERS.poiName, HEADERS.address],
    ];

    tableBlocks.forEach((block) => {
      const timeLabel = `${block.minute}${VISUALIZATION.common.time.minutesSuffix}`;

      block.rows.forEach((r) => {
        r.items.forEach((it, idx) => {
          rows.push([
            idx === 0 ? timeLabel : "",
            idx === 0 ? r.type : "",
            it.name,
            it.address,
          ]);
        });
      });
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = rows[0].map((_, i) => ({
      wch: rows.reduce((m, r) => Math.max(m, (r[i]?.toString().length || 0)), 0) + 2,
    }));
    XLSX.utils.book_append_sheet(wb, ws, TITLE);
    XLSX.writeFile(wb, buildFilename(scenarioName, screenName, "graph", TITLE, "xlsx"));
  };

  const renderContent = (isFs) => {
    const hasData = barData.some((d) => (d.total ?? 0) > 0);

    if (!hasData) {
      return (
        <Typography variant="body2" color="text.secondary">
          {VISUALIZATION.common.emptyState.noData}
        </Typography>
      );
    }

    return (
      <Box>
        <Box
          sx={{
            overflowX: "auto",
            overflowY: "hidden",
            width: "100%",
            height: isFs ? "60vh" : "100%",
          }}
        >
          <Box
            ref={chartRef}
            sx={{
              width: isFs ? "100%" : undefined,
              minWidth: isFs ? 0 : `${Math.max(barData.length * 120, 480)}px`,
              height: isFs ? "60vh" : 300,
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timeRange" tick={{ fontSize: 12, fontWeight: 500 }} />
                <YAxis
                  tick={{ fontSize: 12, fontWeight: 500 }}
                  allowDecimals={false}
                  ticks={ticks}
                />
                <Tooltip />
                <Legend verticalAlign="bottom" iconType="circle" />
                {poiTypes.map((t) => (
                  <Bar key={t} dataKey={t} stackId="a" fill={colorMap[t]} barSize={30} />
                ))}
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
                <TableCell sx={{ py: 0.5, px: 1, position: "sticky", top: 0, zIndex: 2, bgcolor: "background.paper" }}>
                  <Typography variant="body2" fontWeight={700}>
                    {HEADERS.time}
                  </Typography>
                </TableCell>
                <TableCell sx={{ py: 0.5, px: 1, position: "sticky", top: 0, zIndex: 2, bgcolor: "background.paper" }}>
                  <Typography variant="body2" fontWeight={700}>
                    {HEADERS.poiType}
                  </Typography>
                </TableCell>
                <TableCell sx={{ py: 0.5, px: 1, position: "sticky", top: 0, zIndex: 2, bgcolor: "background.paper" }}>
                  <Typography variant="body2" fontWeight={700}>
                    {HEADERS.poiName}
                  </Typography>
                </TableCell>
                <TableCell sx={{ py: 0.5, px: 1, position: "sticky", top: 0, zIndex: 2, bgcolor: "background.paper" }}>
                  <Typography variant="body2" fontWeight={700}>
                    {HEADERS.address}
                  </Typography>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tableBlocks.flatMap((block, bi) => {
                const totalItemsForMinute = block.rows.reduce(
                  (s, r) => s + Math.max(r.items.length, 1),
                  0,
                );
                let timeCellRendered = false;

                return block.rows.flatMap((r, ri) => {
                  const count = Math.max(r.items.length, 1);

                  return Array.from({ length: count }, (_, i) => {
                    const item = r.items[i];
                    const showTimeCell = !timeCellRendered;
                    if (showTimeCell) timeCellRendered = true;

                    return (
                      <TableRow key={`${bi}-${ri}-${i}`}>
                        {showTimeCell && (
                          <TableCell
                            rowSpan={totalItemsForMinute}
                            sx={{ py: 0.5, px: 1, verticalAlign: "top", borderBottom: "none" }}
                          >
                            <Typography variant="body2">
                              {block.minute}
                              {VISUALIZATION.common.time.minutesSuffix}
                            </Typography>
                          </TableCell>
                        )}

                        {i === 0 ? (
                          <TableCell
                            rowSpan={count}
                            sx={{ py: 0.5, px: 1, verticalAlign: "top", whiteSpace: "nowrap" }}
                          >
                            <Typography variant="body2">{r.type}</Typography>
                          </TableCell>
                        ) : null}

                        <TableCell sx={{ py: 0.5, px: 1 }}>
                          <Typography variant="body2">
                            {item?.name ?? VISUALIZATION.common.dateParts.noData}
                          </Typography>
                        </TableCell>

                        <TableCell sx={{ py: 0.5, px: 1 }}>
                          <Typography variant="body2">
                            {item?.address ?? VISUALIZATION.common.dateParts.noData}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  });
                });
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  return (
    <>
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mb: 2 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: open ? 1 : 0,
          }}
        >
          <Typography variant="h6" fontWeight="bold">
            {TITLE}
          </Typography>

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

        <Collapse in={open}>{renderContent(false)}</Collapse>
      </Paper>

      <Dialog
        fullScreen
        open={openFs}
        onClose={() => setOpenFs(false)}
        sx={{ zIndex: UI.Z_INDEX.visualization.analysisDialog }}
      >
        <AppBar position="sticky" color="inherit" elevation={1}>
          <Toolbar>
            <IconButton edge="start" onClick={() => setOpenFs(false)}>
              <CloseIcon />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6">
              {TITLE}
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <IconButton
                size="small"
                title={VISUALIZATION.common.map.actions.downloadPng}
                onClick={handleDownloadImage}
              >
                <span className="material-symbols-outlined outlined" style={{ fontSize: 45 }}>
                  file_png
                </span>
              </IconButton>
              <IconButton
                size="small"
                title={VISUALIZATION.roadNetworkAnalysisOsm.components.graphs.poi.exportExcelTitle}
                onClick={handleExportExcel}
              >
                <span className="material-symbols-outlined outlined" style={{ fontSize: 45 }}>
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
