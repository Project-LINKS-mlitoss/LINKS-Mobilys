// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  CircularProgress,
  TextField,
  Alert,
  Typography,
  List,
  ListItem,
} from "@mui/material";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { GTFS_DEFAULT_EXPORT_FILES } from "../../constant/gtfs";
import { GTFS } from "../../strings/domains/gtfs";

export default function GTFSExportModal({
  open,
  onClose,
  onConfirm,
  scenario,
  fileTypes,
}) {
  const ui = GTFS.exportModal;
  const common = GTFS.common;
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Respect an explicitly provided list (even if empty), otherwise fall back
  const filesToExport = Array.isArray(fileTypes) ? fileTypes : GTFS_DEFAULT_EXPORT_FILES;

  // reset state each time the dialog opens
  useEffect(() => {
    if (open) {
      setStatus("");
      setProgress(0);
      setBusy(false);
      setError(null);
    }
  }, [open]);

  const handleExport = async () => {
    if (!scenario?.id) {
      setError(ui.errors.missingScenarioInfo);
      return;
    }
    if (busy) return;

    setBusy(true);
    setError(null);
    setStatus(common.status.preparing);
    setProgress(0);

    try {
      await onConfirm({
        scenarioId: scenario.id,
        scenario,
        startDate,
        endDate,
        fileTypes: filesToExport,
        onProgress: (pct, msg) => {
          // guard against NaN/undefined progress
          const safePct =
            typeof pct === "number" && isFinite(pct)
              ? Math.max(0, Math.min(100, Math.round(pct)))
              : progress;
          if (typeof safePct === "number") setProgress(safePct);
          if (msg) setStatus(msg);
        },
      });
      setStatus(common.status.completed);
      setProgress((p) => (p < 100 ? 100 : p));
    } catch (e) {
      const message =
        (e && (e.message || e.toString?.())) || ui.errors.exportFailed;
      setError(message);
      // keep last known status/progress; user can retry
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      // prevent closing while exporting to avoid interrupting the download flow
      onClose={busy ? undefined : onClose}
      maxWidth="sm"
      fullWidth
    >
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <DialogTitle>{ui.title}</DialogTitle>
        <DialogContent dividers>
          <Box display="flex" gap={2} mb={2}>
            {/* keep your DatePickers commented out as before
            <DatePicker
              label="Start Date"
              value={startDate}
              onChange={setStartDate}
              renderInput={(p) => <TextField {...p} fullWidth />}
            />
            <DatePicker
              label="End Date"
              value={endDate}
              onChange={setEndDate}
              renderInput={(p) => <TextField {...p} fullWidth />}
            />
            */}
          </Box>

          <Box mb={2}>
            <Typography variant="subtitle1" gutterBottom>
              {ui.labels.targetFiles}
            </Typography>
            <List dense>
              {filesToExport.map((f) => (
                <ListItem key={f} sx={{ pl: 0 }}>
                  - {f}
                </ListItem>
              ))}
              {filesToExport.length === 0 && (
                <ListItem sx={{ pl: 0 }}>{ui.labels.noTargetFiles}</ListItem>
              )}
            </List>
          </Box>

          {busy && (
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <CircularProgress size={20} />
              <Typography>
                {status || common.status.processing} {progress ? `(${progress}%)` : ""}
              </Typography>
            </Box>
          )}

          {error && <Alert severity="error">{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            {common.actions.cancel}
          </Button>
          <Button
            variant="contained"
            onClick={handleExport}
            disabled={busy || !scenario}
          >
            {common.actions.export}
          </Button>
        </DialogActions>
      </LocalizationProvider>
    </Dialog>
  );
}
