// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import {
  Box,
  Paper,
  Typography,
  FormControl,
  FormLabel,
  Select,
  MenuItem,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Collapse,
  IconButton,
  Dialog,
  DialogContent,
  AppBar,
  Toolbar,
} from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CloseIcon from "@mui/icons-material/Close";
import { saveAs } from "file-saver";
import { buildFilename } from "../buildFilename";
import { VISUALIZATION } from "@/strings";
import { UI } from "../../../constant/ui";
import { formatOdDateOption } from "./utils/formatOdDateOption";

const VALUE_COL_PX = 96; // Value column width (keep consistent across tables).
const formatNumber = (n) => new Intl.NumberFormat("ja-JP").format(Number(n || 0));

function groupByStopName(features = []) {
  const map = new Map();
  for (const f of features) {
    const p = f?.properties || {};
    const name = String(p.stop_name ?? "—").trim();
    const total = Number(p.total) || 0;
    if (!map.has(name)) map.set(name, { name, total });
    else map.get(name).total += total;
  }
  return Array.from(map.values()).sort((a, b) => (b.total || 0) - (a.total || 0));
}

export default function ODLastFirstStop({
  oDLastFirstStopSelectedPoint,
  oDLastFirstStopSelectedMode,
  dateOptions = [],
  oDLastFirstStopSelectedDate,
  setODLastFirstStopSelectedDate,
  scenarioName = VISUALIZATION.common.scenarioFallbackName,
  screenName = VISUALIZATION.titles.odAnalysis,
}) {
  const [openFs, setOpenFs] = React.useState(false);
  const [openPaper, setOpenPaper] = React.useState(true);

  const allDateValue = VISUALIZATION.common.filters.allAlt; // must match Select option values
  const allDateLabel = VISUALIZATION.common.filters.all;
  const safeSelectedDate = React.useMemo(() => {
    const options = Array.isArray(dateOptions) ? dateOptions : [];
    const normalized = options.includes(allDateValue)
      ? allDateValue
      : (options[0] ?? allDateValue);

    return options.includes(oDLastFirstStopSelectedDate) ? oDLastFirstStopSelectedDate : normalized;
  }, [allDateValue, dateOptions, oDLastFirstStopSelectedDate]);

  React.useEffect(() => {
    const options = Array.isArray(dateOptions) ? dateOptions : [];
    const normalized = options.includes(allDateValue)
      ? allDateValue
      : (options[0] ?? allDateValue);

    if (!oDLastFirstStopSelectedDate || !options.includes(oDLastFirstStopSelectedDate)) {
      setODLastFirstStopSelectedDate?.(normalized);
    }
  }, [
    allDateValue,
    dateOptions,
    oDLastFirstStopSelectedDate,
    setODLastFirstStopSelectedDate,
  ]);

  const mode = oDLastFirstStopSelectedMode ?? "first_stop";
  const parentProps = oDLastFirstStopSelectedPoint?.properties ?? {};
  const parentStopName = String(parentProps.stop_name ?? "");
  const parentTotal = Number(parentProps.total ?? 0);
  const childRows = React.useMemo(() => {
    const raw = Array.isArray(parentProps.child_features) ? parentProps.child_features : [];
    return groupByStopName(raw);
  }, [parentProps.child_features]);

  const hasData = !!parentStopName || childRows.length > 0;
  const parentTitle =
    mode === "first_stop"
      ? VISUALIZATION.odAnalysis.components.common.labels.firstStop
      : VISUALIZATION.odAnalysis.components.common.labels.lastStop;
  const parentCol =
    mode === "first_stop"
      ? VISUALIZATION.odAnalysis.components.common.labels.boardingCount
      : VISUALIZATION.odAnalysis.components.common.labels.alightingCount;
  const childTitle =
    mode === "first_stop"
      ? VISUALIZATION.odAnalysis.components.common.labels.lastStop
      : VISUALIZATION.odAnalysis.components.common.labels.firstStop;
  const childCol =
    mode === "first_stop"
      ? VISUALIZATION.odAnalysis.components.common.labels.alightingCount
      : VISUALIZATION.odAnalysis.components.common.labels.boardingCount;
  const panelTitle = `${VISUALIZATION.odAnalysis.components.lastFirstStop.fileTitlePrefix}（${parentTitle}）_${VISUALIZATION.odAnalysis.components.lastFirstStop.fileTitleBody}`;


  const handleCsvDownload = () => {
    const esc = (v) => {
      const s = v == null ? "" : String(v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = [
      ["section", "stop_name", "value"],
      [parentTitle, parentStopName || "—", Number(parentTotal) || 0],
      ...childRows.map((r) => [childTitle, r.name, Number(r.total) || 0]),
    ];
    const csv = rows.map((r) => r.map(esc).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const filename = buildFilename(scenarioName, screenName, "graph", panelTitle, "csv");
    saveAs(blob, filename);
  };

  const tableSx = { tableLayout: "fixed", width: "100%" };
  const nameCellSx = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
  const valueCellSx = { textAlign: "left", whiteSpace: "nowrap" };
  const gutterSx = { overflowY: "auto", scrollbarGutter: "stable both-edges" };

  const ColGroup = () => (
    <colgroup>
      <col style={{ width: `calc(100% - ${VALUE_COL_PX}px)` }} />
      <col style={{ width: VALUE_COL_PX }} />
    </colgroup>
  );

  return (
    <Box>
      <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
        <Box sx={{ minWidth: 260 }}>
          <FormControl fullWidth>
            <FormLabel sx={{ mb: 1 }}>{VISUALIZATION.common.labels.date}</FormLabel>
            <Select
              value={safeSelectedDate}
              onChange={(e) => setODLastFirstStopSelectedDate?.(e.target.value)}
            >
              {dateOptions.length > 0 ? (
                dateOptions.map((d) => (
                  <MenuItem key={d} value={d}>
                    {d === allDateValue ? allDateLabel : formatOdDateOption(d)}
                  </MenuItem>
                ))
              ) : (
                <MenuItem value={safeSelectedDate}>{formatOdDateOption(safeSelectedDate)}</MenuItem>
              )}
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {hasData ? (
        <Paper sx={{ p: 2, mb: 2, position: "relative" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: openPaper ? 2 : 0 }}>
            <Typography variant="h6" fontWeight={700}>
              {parentTitle}・{childTitle} {VISUALIZATION.odAnalysis.components.lastFirstStop.listTitleSuffix}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <IconButton
                size="small"
                title={hasData ? VISUALIZATION.common.actions.expand : VISUALIZATION.common.emptyState.noData}
                disabled={!hasData}
                onClick={() => hasData && setOpenFs(true)}
              >
                <span className="material-symbols-outlined outlined">fullscreen</span>
              </IconButton>
              <IconButton size="small" onClick={() => setOpenPaper((v) => !v)}>
                {openPaper ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
          </Box>

          <Collapse in={openPaper}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 1, mb: 1 }}>
                {parentTitle}
              </Typography>
              <Paper variant="outlined" sx={{ mb: 2 }}>
                <TableContainer sx={gutterSx}>
                  <Table stickyHeader size="small" sx={tableSx}>
                    <ColGroup />
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>
                          {VISUALIZATION.odAnalysis.components.common.labels.stopName}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, textAlign: "left" }}>{parentCol}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow hover>
                        <TableCell sx={nameCellSx}>{parentStopName || "—"}</TableCell>
                        <TableCell sx={valueCellSx}>{formatNumber(parentTotal)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>

              <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 2, mb: 1 }}>
                {childTitle}
              </Typography>
              <Paper variant="outlined">
                <TableContainer sx={{ ...gutterSx, maxHeight: 520 }}>
                  <Table stickyHeader size="small" sx={tableSx}>
                    <ColGroup />
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>
                          {VISUALIZATION.odAnalysis.components.common.labels.stopName}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, textAlign: "left" }}>{childCol}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {childRows.map((r) => (
                        <TableRow key={r.name} hover>
                          <TableCell sx={nameCellSx}>{r.name}</TableCell>
                          <TableCell sx={valueCellSx}>{formatNumber(r.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Box>
          </Collapse>
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ p: 2, mb: 2, textAlign: "center" }}>
          {VISUALIZATION.odAnalysis.components.common.instructions.selectStopOnMap}
        </Paper>
      )}

      {/* --- FULLSCREEN --- */}
      <Dialog
        fullScreen
        open={openFs}
        onClose={() => setOpenFs(false)}
        sx={{ zIndex: UI.Z_INDEX.visualization.analysisDialog }}
      >
        <AppBar position="sticky" color="inherit" elevation={1}>
          <Toolbar>
            <IconButton edge="start" onClick={() => setOpenFs(false)} aria-label="close">
              <CloseIcon />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" fontWeight={700}>
              {parentTitle}・{childTitle} {VISUALIZATION.odAnalysis.components.lastFirstStop.listTitleSuffix}
            </Typography>
            <IconButton size="small" title={VISUALIZATION.common.actions.downloadCsv} onClick={handleCsvDownload}>
              <span className="material-symbols-outlined outlined" style={{ fontSize: 45 }}>
                csv
              </span>
            </IconButton>
          </Toolbar>
        </AppBar>

        <DialogContent sx={{ p: 3 }}>
          {!hasData ? (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, textAlign: "center" }}>
              {VISUALIZATION.common.emptyState.noData}
            </Paper>
          ) : (
            <Box sx={{ width: "100%", minWidth: 680, height: "calc(100vh - 160px)", overflowY: "auto" }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 1, mb: 1 }}>
                {parentTitle}
              </Typography>
              <Paper variant="outlined" sx={{ mb: 3 }}>
                <TableContainer sx={gutterSx}>
                  <Table stickyHeader size="small" sx={tableSx}>
                    <ColGroup />
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>
                          {VISUALIZATION.odAnalysis.components.common.labels.stopName}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, textAlign: "left" }}>{parentCol}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow hover>
                        <TableCell sx={nameCellSx}>{parentStopName || "-"}</TableCell>
                        <TableCell sx={valueCellSx}>{formatNumber(parentTotal)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>

              <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 2, mb: 1 }}>
                {childTitle}
              </Typography>
              <Paper variant="outlined">
                <TableContainer sx={gutterSx}>
                  <Table stickyHeader size="small" sx={tableSx}>
                    <ColGroup />
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>
                          {VISUALIZATION.odAnalysis.components.common.labels.stopName}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, textAlign: "left" }}>{childCol}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {childRows.map((r) => (
                        <TableRow key={`fs-${r.name}`} hover>
                          <TableCell sx={nameCellSx}>{r.name}</TableCell>
                          <TableCell sx={valueCellSx}>{formatNumber(r.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
