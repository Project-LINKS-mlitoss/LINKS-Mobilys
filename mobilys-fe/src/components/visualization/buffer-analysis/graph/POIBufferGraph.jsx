import React, { useMemo, useRef, useState } from "react";
import {
  Paper, Box, Typography, IconButton, Dialog, AppBar, Toolbar, Collapse, Grid,
  TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
} from "@mui/material";
import {
  Close as CloseIcon,
} from "@mui/icons-material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { downloadElementAsPng } from "../../export/html2canvasExport";
import * as XLSX from "xlsx";
import {
  ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { buildFilename } from "../../buildFilename";
import { VISUALIZATION } from "@/strings";

const TITLE = VISUALIZATION.bufferAnalysis.components.graphs.poi.title;

// Treat values >= 600 as seconds (server buckets), otherwise minutes.
const toMinutes = (raw) => {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n >= 600 ? Math.round(n / 60) : Math.round(n);
};

export default function POIBufferGraph({
  // either A) time buckets:  or B) single-cutoff groups
  data = [],
  activeMinutes = null, // from map slider (0–T)
  scenarioName = VISUALIZATION.common.scenarioFallbackName,
  screenName = VISUALIZATION.titles.bufferAnalysis,
}) {
  const [openFs, setOpenFs] = useState(false);
  const [open, setOpen] = useState(true);

  const barRef = useRef(null);

  // Normalize input to time buckets
  const buckets = useMemo(() => {
    const arr = Array.isArray(data) ? data : [];
    if (arr.length === 0) return [];

    // Case A: already time buckets
    if ("cutoff_time" in (arr[0] || {}) || "poi_by_type" in (arr[0] || {})) {
      return arr.map((b) => ({
        cutoff_time: b?.cutoff_time ?? 0,
        poi_by_type: Array.isArray(b?.poi_by_type) ? b.poi_by_type : [],
      }));
    }

    // Case B: single-cutoff groups — synthesize one bucket using the slider minutes
    return [
      {
        cutoff_time: typeof activeMinutes === "number" ? activeMinutes : 0,
        poi_by_type: arr,
      },
    ];
  }, [data, activeMinutes]);

  // Time axis (minutes) & cutoff from slider
  const timeMinutes = useMemo(
    () =>
      Array.from(new Set(buckets.map((b) => toMinutes(b.cutoff_time)))).sort(
        (a, b) => a - b
      ),
    [buckets]
  );

  const cutoff = useMemo(
    () =>
      typeof activeMinutes === "number" ? activeMinutes : timeMinutes.at(-1) ?? 0,
    [activeMinutes, timeMinutes]
  );

  // Only include buckets up to the current cutoff
  const filteredBuckets = useMemo(
    () => buckets.filter((b) => toMinutes(b.cutoff_time) <= cutoff),
    [buckets, cutoff]
  );

  // Stable list of POI types across included buckets
  const poiTypes = useMemo(() => {
    const types = filteredBuckets.flatMap((tg) =>
      (tg.poi_by_type || []).map((p) => p.poi_type)
    );
    return Array.from(new Set(types));
  }, [filteredBuckets]);

  // Assign each type a distinct color
  const colorMap = useMemo(() => {
    const n = Math.max(poiTypes.length, 1);
    const m = {};
    poiTypes.forEach((t, i) => {
      const hue = Math.round((i * 360) / n);
      m[t] = `hsl(${hue}, 70%, 55%)`;
    });
    return m;
  }, [poiTypes]);

  // ---- NEW: flat-row table data (no bullets), like douro ----
  const tableRowsByMinute = useMemo(() => {
    const res = [];
    for (const tg of filteredBuckets) {
      const minute = toMinutes(tg?.cutoff_time);

      // type -> [{ name, address }]
      const typeToItems = new Map();
      (tg?.poi_by_type || []).forEach((p) => {
        const type = (p?.poi_type ?? "").trim();
        if (!type) return;
        if (!typeToItems.has(type)) typeToItems.set(type, []);
        (p?.details || []).forEach((d) => {
          const name = (d?.poi_name ?? "").toString().trim();
          const addrRaw = d?.address ?? d?.poi_address ?? "";
          const addr = typeof addrRaw === "string" ? addrRaw.trim() : (addrRaw ?? "");
          if (name) typeToItems.get(type).push({ name, address: addr });
        });
      });

      const rows = [];
      for (const type of poiTypes) {
        const raw = typeToItems.get(type) || [];
        const seen = new Set();
        const names = [];
        const addresses = []; // <-- correct plural (fixes previous crash)

        for (const { name, address: addr } of raw) {
          const key = `${name}||${addr || ""}`;
          if (seen.has(key)) continue;
          seen.add(key);
          names.push(name);
          addresses.push(addr && String(addr).trim() ? addr : "—");
        }

        // sort names; keep addresses aligned
        const order = names
          .map((n, i) => [n, i])
          .sort((a, b) => a[0].localeCompare(b[0], "ja"))
          .map(([, i]) => i);
        const sortedNames = order.map((i) => names[i]);
        const sortedAddresses = order.map((i) => addresses[i]);

        if (sortedNames.length) {
          rows.push({ type, names: sortedNames, addresses: sortedAddresses });
        }
      }

      if (rows.length) res.push({ minute, rows });
    }
    return res;
  }, [filteredBuckets, poiTypes]);

  // CUMULATIVE bars: for each cutoff T, count ALL POIs in that bucket (0–T)
  const barData = useMemo(() => {
    return filteredBuckets.map((bucket) => {
      const row = {
        timeRange: `${toMinutes(bucket.cutoff_time)}${VISUALIZATION.bufferAnalysis.components.map.time.minutesSuffix}`,
      };
      // initialize each type to 0
      poiTypes.forEach((t) => (row[t] = 0));
      // count details by type within THIS bucket (which already represents 0–T)
      (bucket.poi_by_type || []).forEach((p) => {
        const type = p?.poi_type;
        const cnt = p?.details?.length || 0;
        if (type in row) row[type] += cnt;
      });
      return row;
    });
  }, [filteredBuckets, poiTypes]);

  const yTicks = useMemo(() => {
    // stacked total per minute
    const totals = barData.map((r) =>
      poiTypes.reduce((sum, t) => sum + (r[t] || 0), 0)
    );
    const maxVal = Math.max(0, ...totals);
    const step = maxVal > 0 ? Math.ceil(maxVal / 9) : 1;
    const arr = Array.from(
      { length: Math.floor(maxVal / step) + 1 },
      (_, i) => i * step
    );
    return arr[arr.length - 1] < maxVal ? [...arr, maxVal] : arr;
  }, [barData, poiTypes]);

  // ---- download chart PNG ----
  const handleDownloadImage = async (ref) => {
    await downloadElementAsPng({
      element: ref.current,
      filename: buildFilename(
      scenarioName,
      screenName,
      "graph",
      VISUALIZATION.bufferAnalysis.components.graphs.poi.export.graphName,
      "png"
    ),
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      expandToScroll: true,
    });
  };

  const handleExportExcel = () => {
    const rows = [
      [
        VISUALIZATION.bufferAnalysis.components.graphs.poi.export.headers.time,
        VISUALIZATION.bufferAnalysis.components.graphs.poi.export.headers.poiType,
        VISUALIZATION.bufferAnalysis.components.graphs.poi.export.headers.poiName,
        VISUALIZATION.bufferAnalysis.components.graphs.poi.export.headers.address,
      ],
    ];

    const minutesList = filteredBuckets
      .map((b) => toMinutes(b.cutoff_time))
      .sort((a, b) => a - b);

    minutesList.forEach((m) => {
      const bucket = filteredBuckets.find((b) => toMinutes(b?.cutoff_time) === m);
      if (!bucket) return;

      const typeToItems = new Map(); // type -> Set of "name||address"
      (bucket?.poi_by_type || []).forEach((p) => {
        const type = (p?.poi_type ?? "").trim();
        if (!type) return;
        if (!typeToItems.has(type)) typeToItems.set(type, new Set());
        const set = typeToItems.get(type);
        (p?.details || []).forEach((d) => {
          const nm = (d?.poi_name ?? "").trim();
          const addr = (d?.address ?? "").trim();
          if (nm) set.add(`${nm}||${addr}`);
        });
      });

      if (typeToItems.size === 0) {
        rows.push([`${m}${VISUALIZATION.bufferAnalysis.components.map.time.minutesSuffix}`, "", "", ""]);
        return;
      }

      const types = Array.from(typeToItems.keys()).sort((a, b) =>
        a.localeCompare(b, "ja")
      );

      types.forEach((t) => {
        const entries = Array.from(typeToItems.get(t)).map((key) => {
          const [name, address] = key.split("||");
          return { name, address };
        });

        if (entries.length === 0) {
          rows.push([`${m}${VISUALIZATION.bufferAnalysis.components.map.time.minutesSuffix}`, t, "", ""]);
        } else {
          entries.forEach(({ name, address }) => {
            rows.push([`${m}${VISUALIZATION.bufferAnalysis.components.map.time.minutesSuffix}`, t, name, address || ""]);
          });
        }
      });
    });

    // --- Convert to CSV ---
    const escapeCSV = (val) => {
      const s = String(val ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const csvContent = rows.map((r) => r.map(escapeCSV).join(",")).join("\n");

    // UTF-8 BOM for Excel Japanese support
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = buildFilename(
      scenarioName,
      screenName,
      "graph",
      VISUALIZATION.bufferAnalysis.components.graphs.poi.export.graphName,
      "csv"
    );

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const headerCellSx = {
    py: 0.5,
    px: 1,
    position: "sticky",
    top: 0,
    zIndex: 2,
    bgcolor: "background.paper",
  };

  const renderCharts = (isFs = false) => (
    <Box
      sx={{
        display: "flex",
        gap: 2,
        flexDirection: "column",
        alignItems: "stretch",
      }}
    >
      {/* Bar (cumulative 0–T) */}
      <Box
        sx={{
          width: "100%",
          height: isFs ? "50vh" : 260,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Grid
          container
          alignItems="center"
          justifyContent="space-between"
          sx={{ width: "100%", px: 1, mb: 1 }}
        >
          <Grid item>{/* left space reserved intentionally */}</Grid>
          <Grid item>{/* right space reserved intentionally */}</Grid>
        </Grid>

        <Box ref={barRef} sx={{ flexGrow: 1 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timeRange" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} ticks={yTicks} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend verticalAlign="bottom" iconType="circle" />
              {poiTypes.map((t) => (
                <Bar
                  key={t}
                  dataKey={t}
                  name={t}
                  barSize={30}
                  stackId="a"
                  isAnimationActive={false}
                  fill={colorMap[t]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Box>

      {/* Table (below chart) */}
      <TableContainer
        sx={{
          maxHeight: isFs ? "40vh" : 220,
          width: "100%",
          overflowY: "auto",
          overflowX: "auto",
        }}
      >
        <Table stickyHeader size="small" sx={{ minWidth: isFs ? 0 : 1100 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={headerCellSx} width={80}>
                <Typography variant="body2" fontWeight="bold">
                  {VISUALIZATION.bufferAnalysis.components.graphs.poi.export.headers.time}
                </Typography>
              </TableCell>
              <TableCell sx={headerCellSx} width={160}>
                <Typography variant="body2" fontWeight="bold">
                  {VISUALIZATION.bufferAnalysis.components.graphs.poi.export.headers.poiType}
                </Typography>
              </TableCell>
              <TableCell sx={headerCellSx}>
                <Typography variant="body2" fontWeight="bold">
                  {VISUALIZATION.bufferAnalysis.components.graphs.poi.export.headers.poiName}
                </Typography>
              </TableCell>
              <TableCell sx={headerCellSx}>
                <Typography variant="body2" fontWeight="bold">
                  {VISUALIZATION.bufferAnalysis.components.graphs.poi.export.headers.address}
                </Typography>
              </TableCell>
            </TableRow>
          </TableHead>

          {/* ---- NEW: flat rows (no bullets), like douro ---- */}
          <TableBody>
            {tableRowsByMinute.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography variant="body2" color="text.secondary">
                    {VISUALIZATION.bufferAnalysis.components.graphs.poi.emptyState}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              tableRowsByMinute.flatMap((block, blockIdx) => {
                // total table item rows for this minute (rowSpan for time)
                const totalItemsForMinute =
                  block.rows.reduce((acc, r) => acc + (r.names?.length || 0), 0) || 1;

                let timeCellRendered = false;
                const minuteRows = [];

                // divider between minute groups
                if (blockIdx > 0) {
                  minuteRows.push(
                    <TableRow key={`sep-${block.minute}`}>
                      <TableCell colSpan={4} sx={{ py: 0.5, px: 0 }}>
                        <Box sx={{ height: 1, bgcolor: "divider" }} />
                      </TableCell>
                    </TableRow>
                  );
                }

                block.rows.forEach((r) => {
                  const count = Math.max(r.names?.length || 0, 1);

                  for (let i = 0; i < count; i++) {
                    const name = r.names?.[i] ?? "—";
                    const addr = r.addresses?.[i] && String(r.addresses[i]).trim()
                      ? r.addresses[i]
                      : "—";

                    minuteRows.push(
                      <TableRow key={`${block.minute}-${r.type}-${i}`}>
                        {!timeCellRendered && (
                          <TableCell
                            rowSpan={totalItemsForMinute}
                            sx={{ py: 0.5, px: 1, verticalAlign: "top", borderBottom: "none" }}
                          >
                            <Typography variant="body2">
                              {block.minute}
                              {VISUALIZATION.bufferAnalysis.components.map.time.minutesSuffix}
                            </Typography>
                          </TableCell>
                        )}

                        {/* POI type (once per group) */}
                        {i === 0 ? (
                          <TableCell
                            rowSpan={count}
                            sx={{
                              py: 0.5,
                              px: 1,
                              verticalAlign: "top",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <Typography variant="body2">{r.type || "—"}</Typography>
                          </TableCell>
                        ) : null}

                        {/* POI name */}
                        <TableCell sx={{ py: 0.5, px: 1 }}>
                          <Typography variant="body2">{name}</Typography>
                        </TableCell>

                        {/* Address */}
                        <TableCell sx={{ py: 0.5, px: 1 }}>
                          <Typography variant="body2">{addr}</Typography>
                        </TableCell>
                      </TableRow>
                    );

                    if (!timeCellRendered) timeCellRendered = true;
                  }
                });

                return minuteRows;
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  return (
    <>
      <Paper elevation={2} sx={{ p: 2, borderRadius: 2, mb: 2 }}>
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
              title={VISUALIZATION.bufferAnalysis.components.graphs.poi.actions.expand}
              onClick={() => setOpenFs(true)}
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

        <Collapse in={open}>{renderCharts(false)}</Collapse>
      </Paper>

      <Dialog fullScreen open={openFs} onClose={() => setOpenFs(false)}>
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
                title="Download PNG"
                onClick={() => handleDownloadImage(barRef)}
              >
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
        <Box sx={{ p: 3 }}>{renderCharts(true)}</Box>
      </Dialog>
    </>
  );
}
