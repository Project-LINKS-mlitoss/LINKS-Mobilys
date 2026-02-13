// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
} from "@mui/material";
import { MapContainer, Polyline, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MapTileLayer } from "../../MapTileLayer";
import { directionMap } from "../../../constant/gtfs";
import L from "leaflet";
import { LABELS, BUTTONS } from "../../../strings";

/* --- Small two-line field label (JP + EN) --- */
const FieldLabel = ({ jp, en, required = false }) => (
  <Box display="flex" alignItems="baseline" gap={0.5}>
    <Typography fontSize={17} color="text.secondary">{jp}</Typography>
    <Typography fontSize={14} color="text.secondary">
      {en}{required ? " *" : ""}
    </Typography>
  </Box>
);

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

const ConfirmRouteDialog = ({
  open,
  onClose,
  routeInfo,
  stopSequence,
  reverseSequence,
  onConfirm,
  loadingRouteActions,
  shapeData,
}) => {
  const displayedStops = reverseSequence ? [...stopSequence].reverse() : stopSequence;

  const handleSaveClick = async () => {
    try {
      await onConfirm();
      onClose?.();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{LABELS.route.createRoute}</DialogTitle>

      <DialogContent sx={{ display: "flex", gap: 2, mt: 1 }}>
        {/* Left: Map */}
        <Box flex={1}>
          <MapContainer
            center={shapeData?.[0] ? [shapeData[0][1], shapeData[0][0]] : [35.68, 139.76]}
            zoom={13}
            style={{ height: 400, width: "100%" }}
          >
            <MapTileLayer />
            {Array.isArray(shapeData) && shapeData.length > 0 && (
              <Polyline positions={shapeData.map(([lng, lat]) => [lat, lng])} />
            )}

            {displayedStops.map((s, i) =>
              Array.isArray(s.latlng) ? (
                <Marker key={s.rowId ?? i} position={s.latlng} icon={blueStopDivIcon} />
              ) : null
            )}
          </MapContainer>
        </Box>

        {/* Right: Route Summary */}
        <Box flex={1}>
          <TextField
            label={<FieldLabel jp={LABELS.common.routeId} en={LABELS.gtfs.routeId} />}
            value={routeInfo.route_id}
            fullWidth
            margin="dense"
            disabled
          />
          <TextField
            label={<FieldLabel jp={LABELS.route.routeShortName} en={LABELS.gtfs.routeShortName} />}
            value={routeInfo.route_short_name}
            fullWidth
            margin="dense"
            disabled
          />
          <TextField
            label={<FieldLabel jp={LABELS.common.direction} en={LABELS.gtfs.directionId} />}
            value={directionMap[routeInfo.direction_id]}
            fullWidth
            margin="dense"
            disabled
          />
          <TextField
            label={<FieldLabel jp={LABELS.common.serviceId} en={LABELS.gtfs.serviceId} />}
            value={routeInfo.service_id}
            fullWidth
            margin="dense"
            disabled
          />
          <TextField
            label={<FieldLabel jp={LABELS.common.agencyId} en={LABELS.gtfs.agencyId} />}
            value={routeInfo.agency_id}
            fullWidth
            margin="dense"
            disabled
          />

          <Typography variant="subtitle1" mb={1} mt={1}>
            {LABELS.trip.stopSettings}
          </Typography>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>
                  <TwoLineHeader jp={LABELS.trip.stopSequence} en={LABELS.gtfs.stopSequence} />
                </TableCell>
                <TableCell>
                  <TwoLineHeader jp={LABELS.stop.poleId} en={LABELS.gtfs.stopId} />
                </TableCell>
                <TableCell>
                  <TwoLineHeader jp={LABELS.stop.poleName} en={LABELS.gtfs.stopName} />
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayedStops.map((s, i) => (
                <TableRow key={s.rowId ?? i}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{s.id}</TableCell>
                  <TableCell>{s.name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="primary" disabled={loadingRouteActions}>
          {BUTTONS.common.cancel}
        </Button>
        <Button
          onClick={handleSaveClick}
          variant="contained"
          color="primary"
          disabled={loadingRouteActions}
        >
          {loadingRouteActions ? LABELS.trip.saving : BUTTONS.common.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmRouteDialog;
