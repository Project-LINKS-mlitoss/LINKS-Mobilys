import dayjs from "dayjs";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import { RIDERSHIP } from "../../strings";
import { useOdData } from "./hooks/useOdData";

const formatBytes = (bytes) => {
  if (bytes === null || bytes === undefined) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
};

const formatSuccessRate = (successRows, totalRows) => {
  const ok = Number(successRows ?? 0);
  const total = Number(totalRows ?? 0);
  if (!Number.isFinite(total) || total <= 0) return "-";
  const pct = Math.round((ok / total) * 100);
  return `${pct}%`;
};

export default function ODData({ embedded = false }) {
  const ui = RIDERSHIP.odData;
  const {
    scenarioOptions,
    scenarioId,
    setScenarioId,
    scenarioLoading,
    scenarioError,
    uploadsLoading,
    uploadsError,
    filteredUploads,
    uploadsPagination,
    uploadsPage,
    setUploadsPage,
    searchText,
    setSearchText,
    exportingId,
    confirmTarget,
    openConfirm,
    closeConfirm,
    confirmAndDownload,
  } = useOdData();

  const page = uploadsPagination?.page ?? uploadsPage ?? 1;
  const totalPages = uploadsPagination?.total_pages ?? 1;

  return (
    <>
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          height: embedded ? "100%" : "auto",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems={{ xs: "stretch", md: "center" }}
          justifyContent="space-between"
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {ui.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {ui.description}
            </Typography>
          </Box>

          <FormControl sx={{ minWidth: 280 }} disabled={scenarioLoading}>
            <InputLabel id="od-data-scenario-select">{ui.scenarioSelect.label}</InputLabel>
            <Select
              labelId="od-data-scenario-select"
              value={scenarioId}
              label={ui.scenarioSelect.label}
              onChange={(e) => setScenarioId(e.target.value)}
            >
              {scenarioOptions.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        {scenarioError && <Alert severity="error">{scenarioError}</Alert>}
        {uploadsError && <Alert severity="error">{uploadsError}</Alert>}

        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
          <TextField
            label={ui.search.label}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={ui.search.placeholder}
            fullWidth
          />
        </Stack>

        <Paper variant="outlined" sx={{ flex: 1, minHeight: 0 }}>
          <TableContainer sx={{ height: "100%", overflow: "auto" }}>
            <Table stickyHeader size="small" sx={{ minWidth: 980 }}>
              <TableHead>
                <TableRow>
                  <TableCell>{ui.table.headers.recordName}</TableCell>
                  <TableCell>{ui.table.headers.fileName}</TableCell>
                  <TableCell align="right">{ui.table.headers.successRate}</TableCell>
                  <TableCell align="right">{ui.table.headers.successTotal}</TableCell>
                  <TableCell align="right">{ui.table.headers.errorCount}</TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                    {ui.table.headers.uploadedAt}
                  </TableCell>
                  <TableCell align="right">{ui.table.headers.actions}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {uploadsLoading && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography variant="body2" color="text.secondary">
                        {ui.table.loading}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}

                {!uploadsLoading && filteredUploads.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography variant="body2" color="text.secondary">
                        {ui.table.empty}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}

                {filteredUploads.map((u) => {
                  const canExport = ["completed", "partial"].includes(u?.upload_status);
                  const isExporting = exportingId === u?.id;
                  return (
                    <TableRow key={u?.id} hover sx={{ cursor: "default" }}>
                      <TableCell sx={{ fontWeight: 700 }}>{u?.ridership_record_name || "-"}</TableCell>
                      <TableCell>
                        <Typography>{u?.file_name || "-"}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {formatBytes(u?.file_size)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{formatSuccessRate(u?.success_rows, u?.total_rows)}</TableCell>
                      <TableCell align="right">
                        {u?.success_rows ?? 0}/{u?.total_rows ?? 0}
                      </TableCell>
                      <TableCell align="right">{u?.error_count ?? 0}</TableCell>
                      <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                        {u?.uploaded_at ? dayjs(u.uploaded_at).format("YYYY-MM-DD HH:mm") : "-"}
                      </TableCell>
                      <TableCell align="right">
                        <Box
                          sx={{
                            display: "flex",
                            gap: 1,
                            flexWrap: "wrap",
                            justifyContent: "flex-end",
                            alignItems: "center",
                          }}
                        >
                          <Tooltip title={canExport ? ui.actions.downloadCsv : ui.actions.disabledTooltip}>
                            <span>
                              <Button
                                aria-label={ui.actions.downloadCsv}
                                variant="outlined"
                                color="primary"
                                disabled={!!exportingId || !u?.id || !canExport}
                                onClick={() => openConfirm(u)}
                                sx={{ height: 36 }}
                              >
                                {isExporting ? <CircularProgress size={18} /> : ui.actions.downloadCsv}
                              </Button>
                            </span>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {totalPages > 1 && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
            <Pagination page={page} count={totalPages} onChange={(_, p) => setUploadsPage(p)} />
          </Box>
        )}
      </Paper>

      <Dialog open={!!confirmTarget} onClose={closeConfirm} maxWidth="sm" fullWidth>
        <DialogTitle>{ui.dialog.title}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {ui.dialog.message}
          </Typography>
          {confirmTarget?.ridership_record_name && (
            <Typography sx={{ mt: 1.5, fontWeight: 700 }}>{confirmTarget.ridership_record_name}</Typography>
          )}
          {confirmTarget?.file_name && (
            <Typography variant="body2" color="text.secondary">
              {ui.dialog.fileLabel} {confirmTarget.file_name}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            {ui.dialog.hint}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeConfirm} disabled={!!exportingId}>
            {ui.dialog.cancel}
          </Button>
          <Button variant="contained" onClick={confirmAndDownload} disabled={!!exportingId}>
            {exportingId ? (
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={16} color="inherit" />
                <span>{ui.dialog.confirming}</span>
              </Box>
            ) : (
              ui.dialog.confirm
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

