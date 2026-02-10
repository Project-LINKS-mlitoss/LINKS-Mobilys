import { useMemo, useEffect, useState } from "react";
import {
  Box,
  FormControl,
  FormLabel,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Select,
  MenuItem,
  IconButton,
  Collapse,
  Dialog,
  DialogContent,
  AppBar,
  Toolbar,
} from "@mui/material";
import { blue, red, orange } from "@mui/material/colors";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CloseIcon from "@mui/icons-material/Close";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { ja } from "date-fns/locale";
import { saveAs } from "file-saver";
import { buildFilename } from "../buildFilename";
import { VISUALIZATION } from "@/strings";
import { UI } from "../../../constant/ui";
import { formatOdDateOption } from "./utils/formatOdDateOption";

const formatNumber = (n) => new Intl.NumberFormat("ja-JP").format(n);

const TABLE_MAX_HEIGHT_PX = 520;
const CHART_TOP_N = 30;
const CHART_ROW_HEIGHT_PX = 34;
const CHART_PADDING_PX = 48;
const CHART_MIN_HEIGHT_PX = 240;
const CHART_MAX_HEIGHT_PX = 1000;
const CSV_ICON_FONT_SIZE_PX = 45;

const Bullet = ({ mode }) => (
  <Box
    component="span"
    sx={{
      display: "inline-block",
      width: 10,
      height: 10,
      borderRadius: "50%",
      bgcolor: mode === "origin" ? blue[600] : mode === "dest" ? red[600] : orange[600],
      mr: 1,
      position: "relative",
      top: 1,
    }}
  />
);

function UsageDistributionPanel({
  title = VISUALIZATION.odAnalysis.components.usageDistribution.titleBase,
  rows,            // [{ name, board, alight, total }]
  mode,            // "origin" | "dest" | "sum"
  onRowClick,      // (row) => void
  scenarioName = VISUALIZATION.common.scenarioFallbackName,
  screenName = VISUALIZATION.titles.odAnalysis,
}) {
  // section states (card)
  const [open, setOpen] = useState(true);
  const [openDetail, setOpenDetail] = useState(true);

  // fullscreen states
  const [openFs, setOpenFs] = useState(false);
  const [fsOpenDetail, setFsOpenDetail] = useState(true);

  const rightValue = (r) => (mode === "origin" ? r.board : mode === "dest" ? r.alight : r.total);
  const rightLabel =
    mode === "origin"
      ? VISUALIZATION.odAnalysis.components.common.labels.boardingCount
      : mode === "dest"
        ? VISUALIZATION.odAnalysis.components.common.labels.alightingCount
        : VISUALIZATION.odAnalysis.components.common.labels.totalUsersOriginDest;

  const nzRows = useMemo(() => rows.filter((r) => rightValue(r) > 0), [rows, mode]);
  const grandTotal = useMemo(() => rows.reduce((a, r) => a + (r.total || 0), 0), [rows]);

  // Chart data: take the top N for readability.
  const chartData = useMemo(
    () =>
      nzRows
        .slice() // clone
        .sort((a, b) => rightValue(b) - rightValue(a))
        .slice(0, CHART_TOP_N)
        .map((r) => ({ stop: r.name, value: rightValue(r) })),
    [nzRows, mode]
  );

  const chartHeight = Math.min(
    Math.max(chartData.length * CHART_ROW_HEIGHT_PX + CHART_PADDING_PX, CHART_MIN_HEIGHT_PX),
    CHART_MAX_HEIGHT_PX
  );

  const handleCsvDownload = () => {
    const header = ["stop_name", "geton", "getoff", "total"];
    const escapeCell = (val) => {
      const s = val == null ? "" : String(val);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv =
      [header.join(",")]
        .concat(rows.map((r) => [r.name, r.board, r.alight, r.total].map(escapeCell).join(",")))
        .join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const filename = buildFilename(scenarioName, screenName, "graph", title, "csv");
    saveAs(blob, filename);
  };

  return (
    <Paper sx={{ p: 2, mb: 2, position: "relative" }}>
      {/* Header (card) */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: open ? 2 : 0 }}>
        <Typography variant="h6" fontWeight={700}>
          {title}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <IconButton size="small" onClick={() => setOpenFs(true)} title={VISUALIZATION.common.actions.expand}>
            <span className="material-symbols-outlined outlined">fullscreen</span>
          </IconButton>
          <IconButton size="small" onClick={() => setOpen((v) => !v)} aria-label="toggle">
            {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      {/* Detail (card) */}
      <Collapse in={open}>
        <Collapse in={openDetail}>
          <TableContainer sx={{ maxHeight: TABLE_MAX_HEIGHT_PX, mb: 2 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, width: "40%" }}>
                    {VISUALIZATION.odAnalysis.components.common.labels.stopName}
                  </TableCell>
                  {mode === "sum" && (
                    <TableCell sx={{ fontWeight: 700 }} align="right">
                      {VISUALIZATION.odAnalysis.components.common.labels.boardingCount}
                    </TableCell>
                  )}
                  {mode === "sum" && (
                    <TableCell sx={{ fontWeight: 700 }} align="right">
                      {VISUALIZATION.odAnalysis.components.common.labels.alightingCount}
                    </TableCell>
                  )}
                  <TableCell sx={{ fontWeight: 700 }} align="right">
                    {mode === "origin"
                      ? VISUALIZATION.odAnalysis.components.common.labels.boardingCount
                      : mode === "dest"
                        ? VISUALIZATION.odAnalysis.components.common.labels.alightingCount
                        : rightLabel}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.name} hover>
                    <TableCell>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          cursor: "pointer",
                          "&:hover": { textDecoration: "underline", color: "primary.main" },
                        }}
                        onClick={() => onRowClick?.(r)}
                      >
                        <Bullet mode={mode} />
                        <Typography>{r.name}</Typography>
                      </Box>
                    </TableCell>
                    {mode === "sum" && <TableCell align="right">{formatNumber(r.board)}</TableCell>}
                    {mode === "sum" && <TableCell align="right">{formatNumber(r.alight)}</TableCell>}
                    <TableCell align="right">{formatNumber(rightValue(r))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Collapse>
      </Collapse>

      {/* FULLSCREEN */}
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
              {title}
            </Typography>
            <IconButton size="small" title={VISUALIZATION.common.actions.downloadCsv} onClick={handleCsvDownload}>
              <span className="material-symbols-outlined outlined" style={{ fontSize: CSV_ICON_FONT_SIZE_PX }}>
                csv
              </span>
            </IconButton>
          </Toolbar>
        </AppBar>

        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ width: "100%", minWidth: 680, height: "calc(100vh - 160px)", overflowY: "auto" }}>
            {/* Detail (fullscreen) */}
            <Collapse in={fsOpenDetail}>
              <TableContainer sx={{ maxHeight: "none", overflowY: "auto", overflowX: "hidden", mb: 3 }}>
                <Table stickyHeader size="small" sx={{ tableLayout: "auto", width: "100%" }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ pr: 1, pl: 1, py: 0.5 }}>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {VISUALIZATION.odAnalysis.components.common.labels.stopName}
                        </Typography>
                      </TableCell>
                      {mode === "sum" && (
                        <TableCell sx={{ px: 1, py: 0.5 }}>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {VISUALIZATION.odAnalysis.components.common.labels.boardingCount}
                          </Typography>
                        </TableCell>
                      )}
                      {mode === "sum" && (
                        <TableCell sx={{ px: 1, py: 0.5 }}>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {VISUALIZATION.odAnalysis.components.common.labels.alightingCount}
                          </Typography>
                        </TableCell>
                      )}
                      <TableCell sx={{ px: 1, py: 0.5 }}>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {mode === "origin"
                            ? VISUALIZATION.odAnalysis.components.common.labels.boardingCount
                            : mode === "dest"
                              ? VISUALIZATION.odAnalysis.components.common.labels.alightingCount
                              : rightLabel}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={`fs-${r.name}`} hover>
                        <TableCell sx={{ py: 0.5, px: 1 }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                              cursor: "pointer",
                              "&:hover": { textDecoration: "underline", color: "primary.main" },
                            }}
                            onClick={() => onRowClick?.(r)}
                          >
                            <Bullet mode={mode} />
                            <Typography variant="body2">{r.name}</Typography>
                          </Box>
                        </TableCell>
                        {mode === "sum" && (
                          <TableCell sx={{ py: 0.5, px: 1 }}>
                            <Typography variant="body2">{formatNumber(r.board)}</Typography>
                          </TableCell>
                        )}
                        {mode === "sum" && (
                          <TableCell sx={{ py: 0.5, px: 1 }}>
                            <Typography variant="body2">{formatNumber(r.alight)}</Typography>
                          </TableCell>
                        )}
                        <TableCell sx={{ py: 0.5, px: 1 }}>
                          <Typography variant="body2">{formatNumber(rightValue(r))}</Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Collapse>
          </Box>
        </DialogContent>
      </Dialog>
    </Paper>
  );
}

export default function OdUsageDistribution({
  oDUsageDistributionData,
  oDUsageDistributionDateOptions,
  mode,
  setMode,
  selectedDate,
  setSelectedDate,
  setSelectedPoint,
  scenarioName = VISUALIZATION.common.scenarioFallbackName,
  screenName = VISUALIZATION.titles.odAnalysis,
}) {
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const options = Array.isArray(oDUsageDistributionDateOptions)
      ? oDUsageDistributionDateOptions
      : [];

    const allDateValue = VISUALIZATION.common.filters.allAlt;
    const normalized = options.includes(allDateValue)
      ? allDateValue
      : (options[0] ?? allDateValue);

    if (!selectedDate || !options.includes(selectedDate)) {
      setSelectedDate(normalized);
    }
  }, [oDUsageDistributionDateOptions, selectedDate, setSelectedDate]);

  const allDateValue = VISUALIZATION.common.filters.allAlt; // must match Select option values
  const allDateLabel = VISUALIZATION.common.filters.all;
  const safeSelectedDate = useMemo(() => {
    const options = Array.isArray(oDUsageDistributionDateOptions)
      ? oDUsageDistributionDateOptions
      : [];

    const normalized = options.includes(allDateValue)
      ? allDateValue
      : (options[0] ?? allDateValue);

    return options.includes(selectedDate) ? selectedDate : normalized;
  }, [allDateValue, oDUsageDistributionDateOptions, selectedDate]);

  // map + sort according to mode
  const rows = useMemo(() => {
    if (oDUsageDistributionData?.features?.length) {
      const arr = oDUsageDistributionData.features.map((f) => {
        const p = f.properties || {};
        return {
          name: p.stop_name ?? "-",
          board: Number(p.total_geton ?? 0),
          alight: Number(p.total_getoff ?? 0),
          total: Number(p.total_geton_getoff ?? 0),
        };
      });
      const sorter =
        mode === "origin"
          ? (a, b) => b.board - a.board
          : mode === "dest"
            ? (a, b) => b.alight - a.alight
            : (a, b) => b.total - a.total;
      return arr.sort(sorter);
    }
    return [];
  }, [oDUsageDistributionData, mode]);

  const filteredRows = useMemo(() => {
    if (!searchTerm) return rows;
    const q = searchTerm.toLowerCase();
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, searchTerm]);

  const onRowClick = (row) => setSelectedPoint?.(row);

  const panelTitle =
    mode === "origin"
      ? VISUALIZATION.odAnalysis.components.usageDistribution.titles.origin
      : mode === "dest"
        ? VISUALIZATION.odAnalysis.components.usageDistribution.titles.dest
        : VISUALIZATION.odAnalysis.components.usageDistribution.titles.sum;


  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} locale={ja}>
      {/* Filter: date */}
      <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
        <Box sx={{ minWidth: 260 }}>
          <FormControl fullWidth>
            <FormLabel sx={{ mb: 1 }}>{VISUALIZATION.common.labels.date}</FormLabel>
            <Select value={safeSelectedDate} onChange={(e) => setSelectedDate(e.target.value)}>
              {oDUsageDistributionDateOptions.length > 0 ? (
                oDUsageDistributionDateOptions.map((d) => (
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


      {filteredRows.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            borderRadius: 2,
            mb: 2,
            textAlign: "center",
          }}
        >
          {VISUALIZATION.common.emptyState.noData}
        </Paper>
      ) : (

        <UsageDistributionPanel
          title={panelTitle}
          rows={filteredRows}
          mode={mode}
          onRowClick={onRowClick}
          scenarioName={scenarioName}
          screenName={screenName}
        />)
      }
    </LocalizationProvider>
  );
}
