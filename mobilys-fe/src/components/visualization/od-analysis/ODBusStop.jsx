import React, { useMemo, useState } from "react";
import {
  Box,
  FormControl,
  FormLabel,
  MenuItem,
  Paper,
  Select,
  Typography,
  IconButton,
  Dialog,
  DialogContent,
  AppBar,
  Toolbar,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import ja from "date-fns/locale/ja";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CloseIcon from "@mui/icons-material/Close";
import { saveAs } from "file-saver";
import { buildFilename } from "../buildFilename";
import { VISUALIZATION } from "@/strings";
import { UI } from "../../../constant/ui";
import { formatOdDateOption } from "./utils/formatOdDateOption";

const number = (n) => (n == null ? "—" : new Intl.NumberFormat("ja-JP").format(Number(n)));
const ALL = "__ALL__";

function ODBusStopTablePanel({
  title = VISUALIZATION.odAnalysis.components.busStop.title,
  rows = [],
  selectedPoint,
  onSelect,
  csvFilename,
}) {
  const tableHeaders = VISUALIZATION?.odAnalysis?.components?.busStop?.table?.headers;
  const [open, setOpen] = useState(true);
  const [openFs, setOpenFs] = useState(false);
  const [fsOpenDetail] = useState(true);

  const handleCsvDownload = () => {
    const header = ["from_stop", "to_stop", "volume"];
    const esc = (v) => {
      const s = v == null ? "" : String(v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [header.join(",")]
      .concat(rows.map((r) => [r.from, r.to, r.volume].map(esc).join(",")))
      .join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    saveAs(blob, csvFilename || "busstop-od-table.csv");
  };

  if (!rows || rows.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2, textAlign: "center" }}>
        {VISUALIZATION.common.emptyState.noData}
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2, mb: 2, position: "relative" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: open ? 2 : 0 }}>
        <Typography variant="h6" fontWeight={700}>{title}</Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <IconButton size="small" onClick={() => setOpenFs(true)} title={VISUALIZATION.common.actions.expand}>
            <span className="material-symbols-outlined outlined">
              fullscreen
            </span>
          </IconButton>
          <IconButton size="small" onClick={() => setOpen((v) => !v)} aria-label="toggle">
            {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      <Collapse in={open}>
        <TableContainer sx={{ maxHeight: 520 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, width: "40%" }}>
                  {tableHeaders?.getonStop ?? ""}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, width: "40%" }}>
                  {tableHeaders?.getoffStop ?? ""}
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">
                  {tableHeaders?.volume ?? ""}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((e, idx) => {
                const isFromSel = selectedPoint && selectedPoint.stopName === e.from && selectedPoint.type === "from";
                const isToSel = selectedPoint && selectedPoint.stopName === e.to && selectedPoint.type === "to";
                return (
                  <TableRow key={idx} hover sx={{ cursor: "pointer" }}>
                    <TableCell
                      onClick={() => onSelect?.(e.from, "from")}
                      sx={{
                        bgcolor: isFromSel ? "primary.main" : undefined,
                        color: isFromSel ? "primary.contrastText" : undefined,
                        fontWeight: isFromSel ? 700 : undefined,
                      }}
                    >
                      {e.from}
                    </TableCell>
                    <TableCell
                      onClick={() => onSelect?.(e.to, "to")}
                      sx={{
                        bgcolor: isToSel ? "primary.main" : undefined,
                        color: isToSel ? "primary.contrastText" : undefined,
                        fontWeight: isToSel ? 700 : undefined,
                      }}
                    >
                      {e.to}
                    </TableCell>
                    <TableCell align="right">{number(e.volume)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Collapse>

      <Dialog
        fullScreen
        open={openFs}
        onClose={() => setOpenFs(false)}
        sx={{ zIndex: UI.Z_INDEX.visualization.analysisDialog }}
      >
        <AppBar position="sticky" color="inherit" elevation={1}>
          <Toolbar>
            <IconButton edge="start" onClick={() => setOpenFs(false)}><CloseIcon /></IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" fontWeight={700}>{title}</Typography>
            <IconButton size="small" title={VISUALIZATION.common.actions.downloadCsv} onClick={handleCsvDownload}>
              <span className="material-symbols-outlined outlined" style={{ fontSize: 45 }}>
                csv
              </span>
            </IconButton>
          </Toolbar>
        </AppBar>
        <DialogContent sx={{ p: 3 }}>
          <TableContainer>
            <Table stickyHeader size="small" sx={{ tableLayout: "auto", width: "100%" }}>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {tableHeaders?.getonStop ?? ""}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {tableHeaders?.getoffStop ?? ""}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="subtitle2" fontWeight="bold">
                      {tableHeaders?.volume ?? ""}
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((e, idx) => (
                  <TableRow key={`fs-${idx}`} hover>
                    <TableCell><Typography variant="body2">{e.from}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{e.to}</Typography></TableCell>
                    <TableCell align="right"><Typography variant="body2">{number(e.volume)}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
      </Dialog>
    </Paper>
  );
}

export default function ODBusStop({
  oDBusStopData = [],
  dateOptions = [],
  oDBusStopSelectedDate,
  setODBusStopSelectedDate,
  oDBusStopSelectedPoint,
  setODBusStopSelectedPoint,
  oDBusStopLayer,
  setODBusStopLayer,
  scenarioName = VISUALIZATION.common.scenarioFallbackName,
  screenName = VISUALIZATION.titles.odAnalysis,
}) {
  const allDateValue = VISUALIZATION.common.filters.allAlt; // must match Select option values
  const allDateLabel = VISUALIZATION.common.filters.all;

  const safeSelectedDate = React.useMemo(() => {
    const options = Array.isArray(dateOptions) ? dateOptions : [];
    const normalized = options.includes(allDateValue)
      ? allDateValue
      : (options[0] ?? allDateValue);
    return options.includes(oDBusStopSelectedDate) ? oDBusStopSelectedDate : normalized;
  }, [allDateValue, dateOptions, oDBusStopSelectedDate]);

  React.useEffect(() => {
    const options = Array.isArray(dateOptions) ? dateOptions : [];
    const normalized = options.includes(allDateValue) ? allDateValue : (options[0] ?? allDateValue);

    if (!oDBusStopSelectedDate || !options.includes(oDBusStopSelectedDate)) {
      setODBusStopSelectedDate?.(normalized);
    }
  }, [allDateValue, dateOptions, oDBusStopSelectedDate, setODBusStopSelectedDate]);

  // === Dropdown Top-N ===
  // value: 10 | 20 | 30 | 40 | ALL
  const [topMode, setTopMode] = useState(20);

  React.useEffect(() => {
    if (!setODBusStopLayer) return;
    const val = topMode === ALL ? 50 : Number(topMode);
    const next = {
      top10: val >= 10,
      top20: val >= 20,
      top30: val >= 30,
      top40: val >= 40,
      others: val === 50, // Enabled only when "all" is selected.
    };
    setODBusStopLayer(next);
  }, [topMode, setODBusStopLayer]);

  // Table data
  const tableData = useMemo(() => {
    if (!Array.isArray(oDBusStopData)) return [];
    const ranked = oDBusStopData
      .map((d) => ({
        from: d?.stopid_geton?.stop_keyword ?? "",
        to: d?.stopid_getoff?.stop_keyword ?? "",
        volume: Number(d?.count ?? 0),
      }))
      .sort((a, b) => (b.volume || 0) - (a.volume || 0));

    if (topMode === ALL) return ranked; // all
    const n = Math.max(10, Math.min(40, Number(topMode)));
    return ranked.slice(0, n);
  }, [oDBusStopData, topMode]);

  const handleStopSelect = (stopName, type) => {
    setODBusStopSelectedPoint?.({ stopName, type });
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ja}>
      <Box>
        {/* Filters */}
        <Paper variant="outlined" sx={{ p: 2.5, mb: 2, maxWidth: 720 }}>
          {/* Date */}
          <Box sx={{ mb: 2 }}>
            <FormControl fullWidth>
              <FormLabel sx={{ mb: 1 }}>{VISUALIZATION.common.labels.date}</FormLabel>
              <Select
                value={safeSelectedDate}
                onChange={(e) => setODBusStopSelectedDate?.(e.target.value)}
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

          <Box sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <FormLabel sx={{ mb: 1 }}>
                {VISUALIZATION.odAnalysis.components.busStop.labels.topCountByVolume}
              </FormLabel>
              <Select
                value={topMode}
                onChange={(e) => setTopMode(e.target.value)}
              >
                <MenuItem value={10}>10</MenuItem>
                <MenuItem value={20}>20</MenuItem>
                <MenuItem value={30}>30</MenuItem>
                <MenuItem value={40}>40</MenuItem>
                <MenuItem value={ALL}>{VISUALIZATION.common.filters.all}</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Paper>

        <ODBusStopTablePanel
          title={VISUALIZATION.odAnalysis.components.busStop.title}
          rows={tableData}
          selectedPoint={oDBusStopSelectedPoint}
          onSelect={handleStopSelect}
          csvFilename={buildFilename(
            scenarioName,
            screenName,
            "graph",
            VISUALIZATION.odAnalysis.components.busStop.filenameTitle,
            "csv"
          )}
        />
      </Box>
    </LocalizationProvider>
  );
}
