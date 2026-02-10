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
import { LABELS, BUTTONS } from "../../../strings";
import { MESSAGES } from "../../../constant";
import { MapContainer, Polyline, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MapTileLayer } from "../../MapTileLayer";
import { directionMap, formatRouteType } from "../../../constant/gtfs";
import L from "leaflet";


/* --- Small two-line field label (JP + EN) --- */
const FieldLabel = ({ jp, en, required = false }) => (
  <Box display="flex" alignItems="baseline" gap={0.5}>
    <Typography fontSize={17} color="text.secondary">{jp}</Typography>
    <Typography fontSize={14} color="text.secondary">
      {en}{required ? " *" : ""}
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

/**
 * Renders exactly the data it receives (no recompute).
 * Expects stopSequence in the final, displayed order.
 * Uses s.latlng || s.stop_latlng for markers.
 */
const ConfirmExistingRouteDialog = ({
  open,
  onClose,
  routeInfo,
  stopSequence,          // already in displayed order
  onConfirm,
  loadingRouteActions,
  shapeData,
  onSave, // (kept for compatibility; not used directly here)
  afterConfirm, // optional hook to run after onConfirm
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{MESSAGES.route.createPatternDialogTitle}</DialogTitle>

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
            {stopSequence?.map((s, i) => {
              const ll = s.latlng || s.stop_latlng;
              return ll ? <Marker key={`${s.id}-${i}`} position={ll} icon={blueStopDivIcon} /> : null;
            })}
          </MapContainer>
        </Box>

        {/* Right: Summary */}
        <Box flex={1}>
          <TextField
            label={<FieldLabel jp={LABELS.common.routeId} en={LABELS.gtfs.routeId} />}
            disabled
            value={routeInfo.route_id}
            fullWidth
            margin="dense"
          />
          <TextField
            label={<FieldLabel jp={LABELS.route.routeShortName} en={LABELS.gtfs.routeShortName} />}
            disabled
            value={routeInfo.route_short_name || ""}
            fullWidth
            margin="dense"
          />
          <TextField
            label={<FieldLabel jp={LABELS.route.routeType} en={LABELS.gtfs.routeType} />}
            disabled
            value={formatRouteType(routeInfo.route_type)}
            fullWidth
            margin="dense"
          />
          <TextField
            label={<FieldLabel jp={LABELS.common.direction} en={LABELS.gtfs.directionId} />}
            disabled
            value={directionMap?.[routeInfo.direction_id] ?? ""}
            fullWidth
            margin="dense"
          />
          <TextField
            label={<FieldLabel jp={LABELS.common.serviceId} en={LABELS.gtfs.serviceId} />}
            disabled
            value={routeInfo.service_id}
            fullWidth
            margin="dense"
          />
          <TextField
            label={<FieldLabel jp={LABELS.common.agencyId} en={LABELS.gtfs.agencyId} />}
            disabled
            value={routeInfo.agency_id}
            fullWidth
            margin="dense"
          />

          <Typography variant="subtitle1" mb={1} mt={1}>
            {LABELS.trip.stopSettings}
          </Typography>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><TwoLineHeader jp={LABELS.trip.stopSequence} en={LABELS.gtfs.stopSequence} /></TableCell>
                <TableCell><TwoLineHeader jp={LABELS.stop.poleId} en={LABELS.gtfs.stopId} /></TableCell>
                <TableCell><TwoLineHeader jp={LABELS.stop.poleName} en={LABELS.gtfs.stopName} /></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stopSequence?.map((s, i) => (
                <TableRow key={`${s.id}-${i}`}>
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
          onClick={async () => {
            try {
              if (typeof onConfirm === "function") {
                await onConfirm();
              }
            } finally {
              if (typeof afterConfirm === "function") {
                try { await afterConfirm(); } catch (_) { }
              }
            }
          }}
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

export default ConfirmExistingRouteDialog;
