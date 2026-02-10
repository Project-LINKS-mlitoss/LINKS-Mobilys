// src/components/visualization/buffer_analysis/graph/StopBufferGraph.jsx
import React, { useState, useMemo, useRef } from "react";
import {
  Paper,
  Box,
  Typography,
  IconButton,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Dialog,
  AppBar,
  Toolbar,
  Collapse,
} from "@mui/material";
import {
  Close as CloseIcon,
} from "@mui/icons-material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import * as XLSX from "xlsx";
import { groupingMethodMap } from "../../../../constant/gtfs";
import { buildFilename } from "../../buildFilename"; 
import { VISUALIZATION } from "@/strings";

const toMinutes = (raw) => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return n >= 600 ? Math.round(n / 60) : Math.round(n);
};

const fmtInt = (n) =>
  Number.isFinite(n) ? Math.round(n).toLocaleString('ja-JP') : '';

/* ---- tolerant helpers ---- */
const getChildList = (parent) => {
  if (Array.isArray(parent?.childs)) return parent.childs;
  if (Array.isArray(parent?.children)) return parent.children;
  if (Array.isArray(parent?.stops)) return parent.stops;
  return [];
};
const getChildName = (c) =>
  c?.stop_name ??
  c?.name ??
  (typeof c?.child_data === "string" ? c.child_data : "") ??
  "";
const extractIdFromText = (s) => {
  const str = String(s ?? "").trim();
  if (!str) return "";
  let m =
    str.match(/[（(]([^（）()]+)[）)]\s*$/) ||
    str.match(/\(([^()]+)\)\s*$/);
  if (m) return m[1].trim();
  m = str.match(/ID[:：]\s*([^\s)）]+)\s*$/i);
  if (m) return m[1].trim();
  return "";
};
const getChildId = (c) => {
  const byField =
    c?.stop_id ??
    c?.child_stop_id ??
    c?.stop_code ??
    c?.id ??
    c?.stopId ??
    "";
  if (byField !== "" && byField !== undefined && byField !== null) {
    return String(byField);
  }
  return (
    extractIdFromText(c?.stop_name) ||
    extractIdFromText(c?.name) ||
    extractIdFromText(c?.child_data)
  );
};
const getParentLabel = (p) =>
  (p?.parent_data ?? "").toString().trim() ||
  [p?.parent_stop_name, p?.parent_stop_id].filter(Boolean).join(" ") ||
  p?.stops_group ||
  "";

/* ---------- component ---------- */
export default function StopBufferGraph({
  data,
  activeMinutes = null,
  scenarioName = VISUALIZATION.common.scenarioFallbackName,
  screenName = VISUALIZATION.titles.bufferAnalysis,
}) {
  const [openFs, setOpenFs] = useState(false);
  const [open, setOpen] = useState(true);
  const wrapperRef = useRef(null);

  /* normalize buckets */
  const buckets = useMemo(() => {
    if (Array.isArray(data)) {
      return data
        .filter(Boolean)
        .slice()
        .sort((a, b) => toMinutes(a?.cutoff_time) - toMinutes(b?.cutoff_time));
    }
    return [
      {
        cutoff_time: typeof activeMinutes === "number" ? activeMinutes * 60 : 0,
        grouping_method: data?.grouping_method,
        stops: data?.stops || [],
      },
    ];
  }, [data, activeMinutes]);

  /* minutes list */
  const minutesList = useMemo(
    () =>
      Array.from(new Set(buckets.map((b) => toMinutes(b.cutoff_time))))
        .filter((m) => m > 0)
        .sort((a, b) => a - b),
    [buckets]
  );

  const latest = buckets[buckets.length - 1] || {};
  const total = (latest.stops || []).length;
  const latestGrouping = latest.grouping_method;

  /* CSV export */
  const handleExportExcel = () => {
    const rows = [
      [
        VISUALIZATION.bufferAnalysis.components.graphs.stops.export.headers.time,
        VISUALIZATION.bufferAnalysis.components.graphs.stops.export.headers.parentStop,
        VISUALIZATION.bufferAnalysis.components.graphs.stops.export.headers.stopName,
        VISUALIZATION.bufferAnalysis.components.graphs.stops.export.headers.stopId,
      ],
    ];
    const sorted = (Array.isArray(buckets) ? buckets : [])
      .slice()
      .sort((a, b) => toMinutes(a?.cutoff_time) - toMinutes(b?.cutoff_time));

    sorted.forEach((bucket) => {
      const minuteLabel = `${toMinutes(bucket?.cutoff_time)}${VISUALIZATION.bufferAnalysis.components.map.time.minutesSuffix}`;
      const list = Array.isArray(bucket?.stops) ? bucket.stops : [];

      if (list.length === 0) {
        rows.push([minuteLabel, "", "", ""]);
        return;
      }

      list.forEach((parent) => {
        const parentLabel = getParentLabel(parent);
        const kids = getChildList(parent);

        if (kids.length === 0) {
          rows.push([minuteLabel, parentLabel, "", ""]);
        } else {
          kids.forEach((k, idx) => {
            const id = getChildId(k);
            const name = getChildName(k);
            const hyouchuu = name && id ? `${name} (${id})` : (name || id || "");
            rows.push([idx === 0 ? minuteLabel : "", idx === 0 ? parentLabel : "", hyouchuu, id]);
          });
        }
      });
    });

    const escapeCSV = (val) => {
      const s = String(val ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = rows.map((r) => r.map(escapeCSV).join(",")).join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildFilename(
      scenarioName,
      screenName,
      "graph",
      VISUALIZATION.bufferAnalysis.components.graphs.stops.export.graphName,
      "csv"
    );

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* header cell*/
  const headerCellSx = (isFs) => ({
    py: 0.5,
    px: 1,
    ...(isFs ? {} : { position: "sticky", top: 0, zIndex: 2, bgcolor: "background.paper" }),
  });

  /* ---- table: one row per stop pole + rowSpan for time/stop ---- */
  const renderTable = (isFs = false) => {
    const tableBlocks = buckets.map((b) => {
      const minute = toMinutes(b?.cutoff_time);
      const rows = (b?.stops || []).map((parent) => ({
        type: getParentLabel(parent) || "—",
        items: getChildList(parent).map((c) => ({
          name: getChildName(c) || "—",
          id: getChildId(c) || "",
        })),
      }));
      return { minute, rows };
    });

    return (
      <TableContainer
        sx={
          isFs
            ? { maxHeight: "unset", overflow: "visible", width: "100%" }
            : { maxHeight: 220, overflowY: "auto", overflowX: "hidden", width: "100%" }
        }
      >
        <Table
          size="small"
          stickyHeader={!isFs}
          sx={{ tableLayout: "fixed", borderCollapse: "separate", borderSpacing: 0 }}
        >

          <colgroup>
            <col style={{ width: "25%" }} />
            <col style={{ width: "25%" }} />
            <col style={{ width: "25%" }} />
            <col style={{ width: "25%" }} />
          </colgroup>

          <TableHead>
            <TableRow>
              <TableCell sx={headerCellSx(isFs)}>
                <Typography variant="body2" fontWeight="bold">
                  {VISUALIZATION.bufferAnalysis.components.graphs.stops.export.headers.time}
                </Typography>
              </TableCell>
              <TableCell sx={headerCellSx(isFs)}>
                <Typography variant="body2" fontWeight="bold">
                  {latestGrouping === groupingMethodMap.GROUPING_BY_NAME
                    ? VISUALIZATION.bufferAnalysis.components.graphs.stops.table.parentStopName
                    : VISUALIZATION.bufferAnalysis.components.graphs.stops.table.parentStopId}
                </Typography>
              </TableCell>
              <TableCell sx={headerCellSx(isFs)}>
                <Typography variant="body2" fontWeight="bold">
                  {VISUALIZATION.bufferAnalysis.components.graphs.stops.export.headers.stopName}
                </Typography>
              </TableCell>
              <TableCell sx={headerCellSx(isFs)}>
                <Typography variant="body2" fontWeight="bold">
                  {VISUALIZATION.bufferAnalysis.components.graphs.stops.export.headers.stopId}
                </Typography>
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {tableBlocks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography variant="body2" color="text.secondary">
                    {VISUALIZATION.bufferAnalysis.components.graphs.stops.emptyState}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              tableBlocks.flatMap((block, blockIdx) => {
                // total item rows for this minute 
                const minuteRowSpan = block.rows.reduce(
                  (acc, r) => acc + Math.max(r.items.length, 1),
                  0
                );

                // divider between minutes
                const minuteDivider =
                  blockIdx > 0 ? (
                    <TableRow key={`sep-${block.minute}`}>
                      <TableCell colSpan={4} sx={{ py: 0.5, px: 0 }}>
                        <Box sx={{ height: 1, bgcolor: "divider" }} />
                      </TableCell>
                    </TableRow>
                  ) : null;

                let printedTime = false;
                const out = [];

                block.rows.forEach((r, groupIdx) => {
                  const itemCount = Math.max(r.items.length, 1);

                  for (let i = 0; i < itemCount; i++) {
                    const it = r.items[i] || { name: "—", id: "" };
                    const isFirstInGroup = i === 0;

                    out.push(
                      <TableRow key={`${block.minute}-${groupIdx}-${i}`}>
                        {/* Time */}
                        {!printedTime && (
                          <TableCell
                            rowSpan={minuteRowSpan}
                            sx={{
                              py: 0.5,
                              px: 1,
                              verticalAlign: "top",
                              borderBottom: "none",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            <Typography variant="body2">
                              {block.minute}
                              {VISUALIZATION.bufferAnalysis.components.map.time.minutesSuffix}
                            </Typography>
                          </TableCell>
                        )}

                        {/* Stop group */}
                        {isFirstInGroup && (
                          <TableCell
                            rowSpan={itemCount}
                            sx={{
                              py: 0.5,
                              px: 1,
                              verticalAlign: "top",
                              whiteSpace: isFs ? "normal" : "nowrap",
                              wordBreak: "break-word",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              borderBottom: "none",
                            }}
                          >
                            <Typography variant="body2">{r.type}</Typography>
                          </TableCell>
                        )}

                        {/* Stop name */}
                        <TableCell
                          sx={{
                            py: 0.5,
                            px: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
                          }}
                        >
                          <Typography variant="body2">{it.name}</Typography>
                        </TableCell>

                        {/* Stop ID */}
                        <TableCell
                          sx={{
                            py: 0.5,
                            px: 1,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
                          }}
                        >
                          <Typography variant="body2">{it.id}</Typography>
                        </TableCell>
                      </TableRow>
                    );

                    if (!printedTime) printedTime = true;
                  }
                });

                return minuteDivider ? [minuteDivider, ...out] : out;
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <>
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mb: 2, boxShadow: 2 }} ref={wrapperRef}>
        {/* header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: open ? 1 : 0,
          }}
        >
          <Box>
            <Typography variant="h6" fontWeight="bold">
              {VISUALIZATION.bufferAnalysis.components.graphs.stops.title}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <IconButton
              size="small"
              onClick={() => setOpenFs(true)}
              title={VISUALIZATION.bufferAnalysis.components.graphs.stops.actions.expand}
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

        {/* total */}
        <Box sx={{ textAlign: "center", py: 3 }}>
          <Typography variant="h4" fontWeight="bold">{total}</Typography>
        </Box>

        <Collapse in={open}>{renderTable(false)}</Collapse>
      </Paper>

      {/* fullscreen */}
      <Dialog fullScreen open={openFs} onClose={() => setOpenFs(false)}>
        <AppBar
          sx={{ position: "sticky", top: 0, bgcolor: "inherit", color: "inherit", zIndex: (t) => t.zIndex.appBar }}
        >
          <Toolbar>
            <IconButton edge="start" onClick={() => setOpenFs(false)}>
              <CloseIcon />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" fontWeight="bold">
              {VISUALIZATION.bufferAnalysis.components.graphs.stops.title}
            </Typography>
            <IconButton size="small" title="Export CSV" onClick={handleExportExcel}>
                <span class="material-symbols-outlined outlined" style ={{ fontSize: 45 }}>
                  csv
                </span>
            </IconButton>
          </Toolbar>
        </AppBar>

        <Box sx={{ p: 3, height: { xs: "calc(100dvh - 56px)", sm: "calc(100dvh - 64px)" }, overflow: "auto" }}>
          <Box sx={{ textAlign: "center", mb: 1 }}>
            <Typography variant="h4" fontWeight="bold" lineHeight={1}>
              {total}
            </Typography>
          </Box>
          {renderTable(true)}
        </Box>
      </Dialog>
    </>
  );
}
