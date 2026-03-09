// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  Typography,
  Box,
} from "@mui/material";
import { LABELS, BUTTONS } from "../../../strings";
import { MESSAGES } from "../../../constant";

/* --- Two-line table header (JP + EN) --- */
const TwoLineHeader = ({ jp, en }) => (
  <Box>
    <Typography fontWeight="bold" fontSize={14} noWrap color="text.primary">
      {jp}
    </Typography>
    <Typography
      fontWeight="bold"
      fontSize={12}
      color="text.secondary"
      sx={{ display: "block", lineHeight: "16px", minHeight: "16px", whiteSpace: "nowrap" }}
    >
      {en || " "}
    </Typography>
  </Box>
);

const EditRoutePatternConfirmDialog = ({ open, onClose, onConfirm, originalStops, trimmedStops }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{MESSAGES.route.shortenRouteDialogTitle}</DialogTitle>
      <DialogContent sx={{ display: "flex", gap: 4, mt: 1 }}>
        <Box flex={1}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            {LABELS.common.beforeEdit}
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><TwoLineHeader jp={LABELS.stop.poleId} en={LABELS.gtfs.stopId} /></TableCell>
                <TableCell><TwoLineHeader jp={LABELS.stop.poleName} en={LABELS.gtfs.stopName} /></TableCell>
                <TableCell><TwoLineHeader jp={LABELS.trip.stopSequence} en={LABELS.gtfs.stopSequence} /></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {originalStops.map((stop, i) => (
                <TableRow key={i}>
                  <TableCell>{stop.stop_id}</TableCell>
                  <TableCell>{stop.stop_name}</TableCell>
                  <TableCell>{stop.stop_sequence}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        <Box flex={1}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            {LABELS.common.afterEdit}
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><TwoLineHeader jp={LABELS.stop.poleId} en={LABELS.gtfs.stopId} /></TableCell>
                <TableCell><TwoLineHeader jp={LABELS.stop.poleName} en={LABELS.gtfs.stopName} /></TableCell>
                <TableCell><TwoLineHeader jp={LABELS.trip.stopSequence} en={LABELS.gtfs.stopSequence} /></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {trimmedStops.map((stop, i) => (
                <TableRow key={i}>
                  <TableCell>{stop.stop_id}</TableCell>
                  <TableCell>{stop.stop_name}</TableCell>
                  <TableCell>{i + 1}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">{BUTTONS.common.cancel}</Button>
        <Button onClick={onConfirm} variant="contained" color="primary">{BUTTONS.common.save}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditRoutePatternConfirmDialog;
