// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Table, TableHead, TableRow, TableCell, TableBody, Backdrop, CircularProgress } from "@mui/material";
import { LABELS, BUTTONS } from "../../../strings";
import { MESSAGES } from "../../../constant";

const CreateTripFinalConfirmDialog = ({ open, onClose, onConfirm, tripInfo, loadingTripActions }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{MESSAGES.common.pleaseConfirm}</DialogTitle>

      <DialogContent>
        <Table size="small" sx={{ mb: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell>{LABELS.trip.tripId}</TableCell>
              <TableCell>{LABELS.trip.tripHeadsign}</TableCell>
              <TableCell>{LABELS.gtfs.directionId}</TableCell>
              <TableCell>{LABELS.gtfs.serviceId}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>{tripInfo.trip_id}</TableCell>
              <TableCell>{tripInfo.trip_headsign}</TableCell>
              <TableCell>{tripInfo.direction_id}</TableCell>
              <TableCell>{tripInfo.service_id}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="primary">
          {BUTTONS.common.cancel}
        </Button>
        <Button onClick={onConfirm} variant="contained" color="primary">
          {BUTTONS.common.save}
        </Button>
      </DialogActions>

      {/* Spinner overlay */}
      <Backdrop
        sx={{ position: 'absolute', zIndex: (theme) => theme.zIndex.modal + 1, color: '#fff' }}
        open={loadingTripActions}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
    </Dialog>
  );
};

export default CreateTripFinalConfirmDialog;
