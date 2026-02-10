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
import * as XLSX from "xlsx";

import { groupingMethodMap } from "../../../../constant/gtfs";
import { VISUALIZATION } from "@/strings";
import { UI } from "@/constant/ui";
import { trimText } from "../../../../utils/text";
import { buildFilename } from "../../buildFilename";

const TITLE = VISUALIZATION.roadNetworkAnalysisOsm.components.graphs.stops.title;
const HEADERS = VISUALIZATION.roadNetworkAnalysisOsm.components.graphs.stops.csvHeaders;

const toMinutes = (seconds) => {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n / 60);
};

const fmtInt = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString("ja-JP") : "");

export default function StopRoadNetworkGraph({
  data = [],
  groupingMethod = groupingMethodMap.GROUPING_BY_NAME,
  maxMinutes = null,
  scenarioName = VISUALIZATION.common.scenarioFallbackName,
  screenName = VISUALIZATION.roadNetworkAnalysisOsm.screenName,
}) {
  const [openFs, setOpenFs] = useState(false);
  const [open, setOpen] = useState(true);
  const cardRef = useRef(null);

  const filteredBuckets = useMemo(() => {
    const arr = Array.isArray(data) ? data : [];
    const sorted = [...arr].sort((a, b) => (a?.cutoff_time ?? 0) - (b?.cutoff_time ?? 0));
    if (maxMinutes == null) return sorted;
    const limitSec = maxMinutes * 60;
    return sorted.filter((tg) => (tg?.cutoff_time ?? 0) <= limitSec);
  }, [data, maxMinutes]);

  const tableBlocks = useMemo(() => {
    return filteredBuckets.map((tg) => {
      const minute = toMinutes(tg?.cutoff_time ?? 0);
      const rows = (tg?.stop_groups ?? []).map((sg) => ({
        groupLabel: sg?.stops_group ?? "",
        items: (sg?.stops ?? []).map((s) => ({
          id: s?.stop_id ?? "",
          name: s?.stop_name ?? "",
        })),
      }));
      return { minute, rows };
    });
  }, [filteredBuckets]);

  const totalStops = useMemo(() => {
    const ids = new Set();
    for (const tg of filteredBuckets) {
      for (const g of tg?.stop_groups || []) {
        for (const s of g?.stops || []) {
          if (s?.stop_id != null) ids.add(String(s.stop_id));
        }
      }
    }
    return ids.size;
  }, [filteredBuckets]);

  const handleExportExcel = () => {
    const groupHeader =
      groupingMethod === groupingMethodMap.GROUPING_BY_NAME ? HEADERS.stopName : HEADERS.stopId;

    const rows = [[HEADERS.time, groupHeader, HEADERS.poleName, HEADERS.poleId]];

    tableBlocks.forEach((block) => {
      const timeLabel = `${block.minute}${VISUALIZATION.common.time.minutesSuffix}`;

      block.rows.forEach((r) => {
        const list = Array.isArray(r.items) ? r.items : [];

        if (!list.length) {
          rows.push([timeLabel, r.groupLabel, VISUALIZATION.common.dateParts.noData, ""]);
          return;
        }

        rows.push([timeLabel, r.groupLabel, list[0].name, list[0].id]);
        for (let i = 1; i < list.length; i++) {
          rows.push(["", "", list[i].name, list[i].id]);
        }
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

  const headerCellSx = (isFs) => ({
    py: 0.5,
    px: 1,
    ...(isFs ? {} : { position: "sticky", top: 0, zIndex: 2, bgcolor: "background.paper" }),
  });

  const renderTable = (isFs) => {
    const rowsOut = [];

    tableBlocks.forEach((block, bi) => {
      const minuteLabel = `${block.minute}${VISUALIZATION.common.time.minutesSuffix}`;

      const totalItemsForMinute = block.rows.reduce(
        (s, r) => s + Math.max(Array.isArray(r.items) ? r.items.length : 0, 1),
        0,
      );

      let printedTime = false;

      // Divider between minutes (except first)
      if (bi > 0) {
        rowsOut.push(
          <TableRow key={`sep-${bi}`}>
            <TableCell colSpan={4} sx={{ py: 0.5, px: 0 }}>
              <Box sx={{ height: 1, bgcolor: "divider" }} />
            </TableCell>
          </TableRow>,
        );
      }

      block.rows.forEach((r, ri) => {
        const items = Array.isArray(r.items) ? r.items : [];
        const count = Math.max(items.length, 1);

        for (let i = 0; i < count; i++) {
          const it = items[i] ?? { name: VISUALIZATION.common.dateParts.noData, id: "" };

          rowsOut.push(
            <TableRow key={`${bi}-${ri}-${i}`}>
              {!printedTime && (
                <TableCell
                  rowSpan={totalItemsForMinute}
                  sx={{ py: 0.5, px: 1, verticalAlign: "top", borderBottom: "none" }}
                >
                  <Typography variant="body2">{minuteLabel}</Typography>
                </TableCell>
              )}

              {i === 0 ? (
                <TableCell
                  rowSpan={count}
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
                  <Typography variant="body2">
                    {isFs ? r.groupLabel || VISUALIZATION.common.dateParts.noData : trimText(r.groupLabel || VISUALIZATION.common.dateParts.noData, 32)}
                  </Typography>
                </TableCell>
              ) : null}

              <TableCell
                sx={{
                  py: 0.5,
                  px: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
                }}
              >
                <Typography variant="body2">{it.name || VISUALIZATION.common.dateParts.noData}</Typography>
              </TableCell>

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
                <Typography variant="body2">{it.id || VISUALIZATION.common.dateParts.noData}</Typography>
              </TableCell>
            </TableRow>,
          );

          if (!printedTime) printedTime = true;
        }
      });
    });

    return (
      <TableContainer
        sx={{
          ...(isFs
            ? { maxHeight: "unset", overflow: "visible" }
            : { maxHeight: 220, overflowY: "auto", overflowX: "hidden" }),
          width: "100%",
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
                  {groupingMethod === groupingMethodMap.GROUPING_BY_NAME ? HEADERS.stopName : HEADERS.stopId}
                </Typography>
              </TableCell>
              <TableCell sx={headerCellSx(isFs)}>
                <Typography variant="body2" fontWeight={700}>
                  {HEADERS.poleName}
                </Typography>
              </TableCell>
              <TableCell sx={headerCellSx(isFs)}>
                <Typography variant="body2" fontWeight={700}>
                  {HEADERS.poleId}
                </Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>{rowsOut.length ? rowsOut : null}</TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <>
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mb: 2 }} ref={cardRef}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: open ? 1 : 0 }}>
          <Typography variant="h6" fontWeight={700}>
            {TITLE}
          </Typography>

          <Box>
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

        <Box sx={{ textAlign: "center", mb: 1 }}>
          <Typography variant="h4" fontWeight={800} lineHeight={1}>
            {fmtInt(totalStops)}
          </Typography>
        </Box>

        <Collapse in={open}>{renderTable(false)}</Collapse>
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
                title={VISUALIZATION.common.actions.downloadCsv}
                onClick={handleExportExcel}
              >
                <span className="material-symbols-outlined outlined" style={{ fontSize: 45 }}>
                  csv
                </span>
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>

        <Box
          sx={{
            p: 3,
            height: { xs: "calc(100dvh - 56px)", sm: "calc(100dvh - 64px)" },
            overflow: "auto",
          }}
        >
          <Box sx={{ textAlign: "center", mb: 1 }}>
            <Typography variant="h4" fontWeight="bold" lineHeight={1}>
              {fmtInt(totalStops)}
            </Typography>
          </Box>

          {renderTable(true)}
        </Box>
      </Dialog>
    </>
  );
}

