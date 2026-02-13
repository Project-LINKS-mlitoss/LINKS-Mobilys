// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  Box,
  Chip,
  Paper,
  Alert,
  Divider,
  TableContainer,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useMemo } from "react";
import { UI } from "../../constant/ui";
import { GTFS } from "../../strings/domains/gtfs";

export default function GTFSImportDetailErrorModal({
  open,
  onClose,
  errors = [],
  message = null,
  timestamp = null,
}) {
  const ui = GTFS.import.errorModal;
  const common = GTFS.common;
  const dash = UI.gtfs.fallbackDash;
  const maxRows = UI.gtfs.import.errorModal.maxRows;

  const rows = useMemo(() => {
    const arr = Array.isArray(errors) ? errors : [errors];
    const filtered = arr.filter(
      (e) =>
        e &&
        e.source === "internal" &&
        (e.row !== undefined || e.file !== undefined)
    );
    return filtered.slice(0, maxRows);
  }, [errors]);

  const total = Array.isArray(errors) ? errors.length : errors ? 1 : 0;

  // Parse details to extract field and error message
  const parseErrorDetails = (details) => {
    if (!details) return { field: dash, message: dash };

    // If details is an object with error field
    if (typeof details === "object" && details.error) {
      const errorStr = details.error;
      
      // Check if it's a dict-like string: "{'field': ['message']}"
      if (typeof errorStr === "string" && errorStr.trim().startsWith("{")) {
        const fieldRegex = /'([^']+)':\s*\[([^\]]+)\]/;
        const match = fieldRegex.exec(errorStr);
        
        if (match) {
          const fieldName = match[1];
          const messagesStr = match[2];
          
          // Extract message
          const msgRegex = /'([^']*)'/;
          const msgMatch = msgRegex.exec(messagesStr);
          
          if (msgMatch) {
            return { field: fieldName, message: msgMatch[1] };
          }
        }
      }
      
      // Plain error string - try to extract field name from message
      // e.g., "route_id is required." -> field: "route_id"
      if (typeof errorStr === "string") {
        const fieldMatch = errorStr.match(/^(\w+)\s/);
        if (fieldMatch) {
          return { field: fieldMatch[1], message: errorStr };
        }
        return { field: "error", message: errorStr };
      }
      
      return { field: "error", message: String(errorStr) };
    }

    // If details is a plain string
    if (typeof details === "string") {
      return { field: dash, message: details };
    }

    // Otherwise, stringify it
    try {
      return { field: dash, message: JSON.stringify(details, null, 2) };
    } catch {
      return { field: dash, message: String(details) };
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            maxHeight: "85vh",
            zIndex: (theme) => (theme.zIndex?.modal ?? 1300) + UI.gtfs.import.errorModal.zIndexOffset,
          },
        }}
        sx={{
        zIndex: (theme) => (theme.zIndex?.modal ?? 1300) + UI.gtfs.import.errorModal.zIndexOffset,
        "& .MuiBackdrop-root": {
          zIndex: (theme) => (theme.zIndex?.modal ?? 1300) + UI.gtfs.import.errorModal.backdropZIndexOffset,
        },
      }}>
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pb: 2,
        }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <span
            className="material-symbols-outlined outlined"
            style={{ color: "#E53935", fontSize: 28 }}>
            error
          </span>
          <Typography variant="h6" fontWeight={700}>
            {ui.title}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 3 }}>
        {/* Error Message Alert */}
        {message && (
          <Alert severity="error" sx={{ mb: 3 }}>
            <Typography variant="body2" fontWeight={600} gutterBottom>
              {message}
            </Typography>
            {timestamp && (
              <Typography variant="caption" color="text.secondary">
                {ui.occurredAtLabel} {new Date(timestamp).toLocaleString()}
              </Typography>
            )}
          </Alert>
        )}

        {rows.length === 0 ? (
          <Alert severity="info">
            {errors[0]?.message || ui.noRowDetailsFallback}
          </Alert>
        ) : (
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <Typography variant="subtitle2" fontWeight={700}>
                {ui.listTitle}
              </Typography>
              <Chip
                label={ui.countSuffixTemplate.replace("{count}", String(total))}
                size="small"
                color="error"
                sx={{ fontWeight: 600 }}
              />
              {total > rows.length && (
                <Chip
                  label={ui.showingCountTemplate.replace("{count}", String(rows.length))}
                  size="small"
                  variant="outlined"
                  sx={{ fontWeight: 600 }}
                />
              )}
            </Box>

            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "#f5f5f5" }}>
                    <TableCell sx={{ fontWeight: 700, width: 60 }}>
                      No.
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 140 }}>
                      {ui.table.headers.file}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 80 }}>
                      {ui.table.headers.rowNumber}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 150 }}>
                      {ui.table.headers.field}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {ui.table.headers.errorContent}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((e, i) => {
                    const parsed = parseErrorDetails(e.details);
                    // Use details message if available, otherwise use e.message
                    const errorContent =
                      parsed.message !== dash ? parsed.message : (e.message || dash);
                     
                    return (
                      <TableRow key={i} hover>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell
                          sx={{ fontFamily: "monospace", fontSize: 12 }}>
                          {e.file || dash}
                        </TableCell>
                        <TableCell
                          sx={{ fontFamily: "monospace", fontSize: 12 }}>
                          {e.row ?? dash}
                        </TableCell>
                        <TableCell>
                          {parsed.field !== dash ? (
                            <Chip
                              label={parsed.field}
                              size="small"
                              variant="outlined"
                              color="primary"
                              sx={{ fontFamily: "monospace", fontSize: 11 }}
                            />
                          ) : (
                            dash
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: 13 }}>
                            {errorContent}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Source and Code Info */}
            {rows.length > 0 && rows[0].source && (
              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <Typography variant="caption" color="text.secondary">
                  {ui.meta.source}
                </Typography>
                <Chip
                  label={rows[0].source}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: 11 }}
                />
                {rows[0].code && (
                  <>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ ml: 1 }}>
                      {ui.meta.code}
                    </Typography>
                    <Chip
                      label={rows[0].code}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: 11 }}
                    />
                  </>
                )}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="contained" color="primary">
          {common.actions.close}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
