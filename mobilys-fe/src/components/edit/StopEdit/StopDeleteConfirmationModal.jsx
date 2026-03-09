// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Stack,
  Alert,
  List,
  ListItem,
  ListItemText,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Box,
} from "@mui/material";
import { directionMap } from "../../../constant/gtfs";
import { formatSectionLabel } from "../../../utils/text";
import { LABELS, BUTTONS } from "../../../strings";
import { MESSAGES } from "../../../constant";

const StopDeleteConfirmModal = ({
  open,
  stop,
  onClose,
  onDelete,
  loading = false,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Clear error message when the selected stop changes or dialog reopens
  useEffect(() => {
    if (open) setErrorMsg("");
  }, [stop, open]);

  // Parse API error message to extract structured rows
  let headerMessage = errorMsg;
  let tableRows = [];
  let fallbackList = [];
  if (errorMsg) {
    const lines = errorMsg.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length > 0) headerMessage = lines[0];
    // Subsequent lines with "- key: value, ..." become rows
    tableRows = lines.slice(1).map((l) => {
      if (l.startsWith("-")) l = l.slice(1).trim();
      const obj = {};
      l.split(/,\s*/).forEach((part) => {
        const m = part.match(/^([^:]+):\s*(.*)$/);
        if (m) obj[m[1].trim()] = m[2].trim();
      });
      return obj;
    }).filter((o) => Object.keys(o).length > 0);

    // Fallback list if no structured rows parsed
    if (tableRows.length === 0) {
      const punctMatch = errorMsg.match(/[。:：]/);
      let tail = "";
      if (punctMatch) {
        const idx = errorMsg.indexOf(punctMatch[0]);
        headerMessage = errorMsg.slice(0, idx + 1);
        tail = errorMsg.slice(idx + 1).trim();
      }
      if (tail) fallbackList = tail.split(/[，、,]\s*/).filter(Boolean);
    }
  }
  if (!stop) return null;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md">
      <DialogTitle>{MESSAGES.stop.deleteDialogTitle}</DialogTitle>
      <DialogContent>
        <Typography sx={{ display: 'none', mb: 2 }}>
          {MESSAGES.stop.deleteConfirmation}
        </Typography>
        <Stack spacing={1.5}>
          <Typography fontWeight="bold" gutterBottom>
            {LABELS.common.stopId}: {stop.stop_id}
          </Typography>
          <Typography fontWeight="bold">
            {LABELS.common.stopName}: {stop.stop_name}
          </Typography>
          {errorMsg && (
            <Alert severity="error" sx={{ mt: 1 }}>
              <Typography variant="body2" sx={{ mb: (tableRows.length || fallbackList.length) ? 1 : 0 }}>
                {headerMessage}
              </Typography>
              {tableRows.length > 0 ? (
                <Table size="small" sx={{ mt: 1 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <Box>
                          <Typography fontWeight="bold" fontSize={14} noWrap>
                            {LABELS.common.patternId}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography fontWeight="bold" fontSize={14} noWrap>
                            {LABELS.common.direction}
                          </Typography>
                          <Typography fontSize={12} color="text.secondary">{LABELS.gtfs.directionId}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography fontWeight="bold" fontSize={14} noWrap>
                            {LABELS.common.serviceId}
                          </Typography>
                          <Typography fontSize={12} color="text.secondary">{LABELS.gtfs.serviceId}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography fontWeight="bold" fontSize={14} noWrap>
                            {LABELS.common.section}
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tableRows.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{row.pattern_id || ""}</TableCell>
                        <TableCell>
                          {(() => {
                            const hasId = row.direction_id !== undefined && row.direction_id !== null && row.direction_id !== "";
                            if (!hasId) return "";
                            const idStr = String(row.direction_id);
                            const label = directionMap?.[idStr] ?? "";
                            const norm = String(label).replace(/\s/g, "");
                            // If label already starts with id (e.g., "1:往路"), avoid duplicating the id
                            if (norm.startsWith(idStr) || norm.startsWith(idStr + ":") || norm.startsWith(idStr + "：")) {
                              return label;
                            }
                            return `${idStr}: ${label}`;
                          })()}
                        </TableCell>
                        <TableCell>{row.service_id || ""}</TableCell>
                        <TableCell>{formatSectionLabel(row.first_and_last_stop_name) || ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                fallbackList.length > 0 && (
                  <List dense disablePadding>
                    {fallbackList.map((it, idx) => (
                      <ListItem key={idx} disableGutters sx={{ py: 0.25 }}>
                        <ListItemText
                          primaryTypographyProps={{ variant: "body2" }}
                          primary={`• ${it}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                )
              )}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button
          color="primary"
          onClick={onClose}
          disabled={loading || submitting}
        >
          {BUTTONS.common.cancel}
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={async () => {
            setErrorMsg("");
            setSubmitting(true);
            try {
              await onDelete(stop);
            } catch (err) {
              const msg = err?.response?.data?.message || err?.message || MESSAGES.stop.deleteFailed;
              setErrorMsg(msg);
            } finally {
              setSubmitting(false);
            }
          }}
          disabled={loading || submitting || Boolean(errorMsg)}
        >
          {BUTTONS.common.delete}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StopDeleteConfirmModal;
