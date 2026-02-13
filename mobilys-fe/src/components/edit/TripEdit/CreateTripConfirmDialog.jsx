// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Table, TableHead, TableRow, TableCell, TableBody, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { MapContainer, Polyline, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MapTileLayer } from "../../MapTileLayer";
import L from "leaflet";
import { LABELS, BUTTONS } from "../../../strings";
import { MESSAGES } from "../../../constant";

const blueStopDivIcon = L.divIcon({
  className: "",
  html: `
    <span class="material-symbols-outlined"
      style="
        color:#1976D2;
        font-size:35px;
        line-height:1;
        display:inline-block;
        font-variation-settings: 'FILL' 1;
      ">
      location_on
    </span>
  `,
  iconAnchor: [14, 28],
});


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

/* --- NEW: always show HH:mm:ss (append :00 if seconds missing) --- */
const asHHMMSS = (t) => {
  if (!t) return "";
  const m = String(t).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return String(t);
  const [, h, mm, ss] = m;
  const hh = String(parseInt(h, 10)).padStart(2, "0");
  return `${hh}:${mm}:${ss ?? "00"}`;
};

const CreateTripConfirmDialog = ({ open, onClose, tripInfo, stopSequence, reverseSequence, onConfirm, shapeData, loadingTripActions }) => {
  const [submitting, setSubmitting] = useState(false);
  const displayedStops = reverseSequence ? [...stopSequence].reverse() : stopSequence;

  useEffect(() => {
    if (!open) setSubmitting(false);
  }, [open]);

  const handleSave = async () => {
    // Prevent double-clicks
    if (submitting || loadingTripActions) return;

    setSubmitting(true);
    try {
      await onConfirm?.();
    } catch (e) {
      console.error("Failed to save trip:", e);
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>{MESSAGES.trip.editDialogTitle}</DialogTitle>

        <DialogContent sx={{ display: "flex", gap: 2, mt: 1 }}>
          {/* Left: Map */}
          <Box flex={1}>
            <MapContainer
              center={shapeData?.[0] ? [shapeData[0][1], shapeData[0][0]] : [35.68, 139.76]}
              zoom={13}
              style={{ height: 400, width: "100%" }}
            >
              <MapTileLayer />
              {shapeData?.length > 0 && (
                <Polyline positions={shapeData.map(([lng, lat]) => [lat, lng])} color="blue" />
              )}
              {displayedStops.map((s, i) =>
                s.stop_latlng ? <Marker key={i} position={s.stop_latlng} icon={blueStopDivIcon} /> : null
              )}
            </MapContainer>
          </Box>

          {/* Right: Route Summary */}
          <Box flex={1}>
            <TextField
              label={`${LABELS.trip.tripId} ${LABELS.gtfs.tripId}`}
              value={tripInfo.trip_id}
              fullWidth
              margin="dense"
              disabled
            />
            <TextField
              label={`${LABELS.trip.tripHeadsign} ${LABELS.gtfs.tripHeadsign}`}
              value={tripInfo.trip_headsign}
              fullWidth
              margin="dense"
              disabled
            />
            <TextField
              label={`${LABELS.common.direction} ${LABELS.gtfs.directionId}`}
              value={tripInfo.direction_id}
              fullWidth
              margin="dense"
              disabled
            />
            <TextField
              label={`${LABELS.common.serviceId} ${LABELS.gtfs.serviceId}`}
              value={tripInfo.service_id}
              fullWidth
              margin="dense"
              disabled
            />

            <Typography variant="subtitle2" sx={{ mt: 2 }}>
              {LABELS.trip.stopSettings}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><TwoLineHeader jp={LABELS.trip.stopSequence} en={LABELS.gtfs.stopSequence} /></TableCell>
                  <TableCell><TwoLineHeader jp={LABELS.stop.poleId} en={LABELS.gtfs.stopId} /></TableCell>
                  <TableCell><TwoLineHeader jp={LABELS.stop.poleName} en={LABELS.gtfs.stopName} /></TableCell>
                  <TableCell><TwoLineHeader jp={LABELS.trip.arrivalTime} en={LABELS.gtfs.arrivalTime} /></TableCell>
                  <TableCell><TwoLineHeader jp={LABELS.trip.departureTime} en={LABELS.gtfs.departureTime} /></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stopSequence.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{s.stop_id}</TableCell>
                    <TableCell>{s.stop_name}</TableCell>
                    <TableCell>{asHHMMSS(s.arrival_time)}</TableCell>
                    <TableCell>{asHHMMSS(s.departure_time)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button
            onClick={onClose}
            color="primary"
            disabled={submitting || loadingTripActions}
          >
            {BUTTONS.common.cancel}
          </Button>

          <Button
            onClick={handleSave}
            variant="contained"
            color="primary"
            disabled={submitting || loadingTripActions}
          >
            {submitting || loadingTripActions ? (
              <>
                {BUTTONS.common.sending}
              </>
            ) : (
              BUTTONS.common.save
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CreateTripConfirmDialog;
