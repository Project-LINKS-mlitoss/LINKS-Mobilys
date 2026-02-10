import React, { useState, useEffect } from "react";
import {
  Box,
  TextField,
  MenuItem,
  Button,
  Typography,
  Paper,
  Select,
  FormControl,
  InputLabel,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Close";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import CreateTripConfirmDialog from "./CreateTripConfirmDialog";
import { useSnackbarStore } from "../../../state/snackbarStore";
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

/* --- helpers to match CreateTrip --- */
const normalizeHHMMSS = (t) => {
  if (!t) return "";
  return /^\d{2}:\d{2}:\d{2}$/.test(t) ? t : `${t}:00`;
};
const toSeconds = (t) => {
  if (!t) return null;
  const [hh = "0", mm = "0", ss = "0"] = t.split(":");
  const h = parseInt(hh, 10), m = parseInt(mm, 10), s = parseInt(ss, 10);
  if ([h, m, s].some(Number.isNaN)) return null;
  return h * 3600 + m * 60 + s;
};

// Put this next to toSeconds/normalizeHHMMSS
const isWholeSequenceChronological = (seq) => {
  let prev = null; // seconds of previous stop's departure
  for (const s of seq) {
    const a = s.arrival_time ? toSeconds(s.arrival_time) : null;
    const d = s.departure_time ? toSeconds(s.departure_time) : null;

    // arrival <= departure (same time allowed)
    if (a !== null && d !== null && a > d) return false;

    // each time must be >= previous stop's departure
    if (prev !== null) {
      if (a !== null && a < prev) return false;
      if (d !== null && d < prev) return false;
    }

    // advance "prev" for the next row
    if (d !== null) prev = d;
    else if (a !== null) prev = a;
  }
  return true;
};

const DuplicateTripForm = ({
  stops_list,
  service_id_list,
  onCancel,
  onSave,
  scenarioId,
  onSuccess,
  tripData,
  route_id,
  loadingTripActions,
  shapeData,
  previewShapeData,
}) => {
  const [tripInfo, setTripInfo] = useState({
    trip_id: "",
    direction_id: "",
    service_id: "",
  });

  // Global snackbar (same formatting as SideNavbar)
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const showError = (msg) => showSnackbar({ title: msg, severity: "error" });

  const isChronologicallyValid = (prevDeparture, arrival, departure) => {
    const a = arrival ? toSeconds(arrival) : null;
    const d = departure ? toSeconds(departure) : null;
    const p = prevDeparture ? toSeconds(prevDeparture) : null;
    if (a !== null && p !== null && a < p) return false; // arrival >= previous depart
    if (d !== null && p !== null && d < p) return false; // depart >= previous depart
    if (a !== null && d !== null && a > d) return false; // arrival <= depart
    return true;
  };

  const [selectedStop, setSelectedStop] = useState("");
  const [stopSequence, setStopSequence] = useState([]);
  const [reverseSequence, setReverseSequence] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const enrichedStopSequence = stopSequence.map((stop) => {
    const full = stops_list.find((s) => s.stop_id === stop.stop_id);
    return {
      ...stop,
      stop_latlng: full ? [full.stop_latlng[0], full.stop_latlng[1]] : null,
    };
  });

  useEffect(() => {
    if (tripData && tripData.trip && tripData.stop_times) {
      setTripInfo({
        trip_id: tripData.trip.trip_id,
        trip_short_name: tripData.trip.trip_short_name || "",
        trip_headsign: tripData.trip.trip_headsign || "",
        direction_id: String(tripData.trip.direction_id),
        service_id: tripData.trip.service_id || "",
      });

      const formattedStops = tripData.stop_times.map((stop) => ({
        stop_id: stop.stop_id,
        stop_name: stop.stop_name,
        arrival_time: stop.arrival_time,
        departure_time: stop.departure_time,
        stop_sequence: stop.stop_sequence,
      }));

      setStopSequence(formattedStops);
    }
  }, [tripData]);

  const isFormValid =
    tripInfo.trip_id.trim() &&
    tripInfo.direction_id !== "" &&
    tripInfo.service_id.trim() &&
    stopSequence.length > 0 &&
    stopSequence.every(
      (stop) => stop.arrival_time?.trim() && stop.departure_time?.trim()
    );

  const handleAddStop = () => {
    if (stopSequence.find((s) => s.stop_id === selectedStop)) return;
    const stop = stops_list.find((s) => s.stop_id === selectedStop);
    if (stop) {
      setStopSequence((prev) => [...prev, stop]);
      setSelectedStop("");
    }
  };

  const handleRemoveStop = (index) => {
    setStopSequence((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const times = stopSequence.map((stop) => ({
      arrival_time: stop.arrival_time,
      departure_time: stop.departure_time,
    }));

    const updated = Array.from(stopSequence);
    const [moved] = updated.splice(result.source.index, 1);
    updated.splice(result.destination.index, 0, moved);

    const updatedWithTimes = updated.map((stop, index) => ({
      ...stop,
      arrival_time: times[index].arrival_time,
      departure_time: times[index].departure_time,
    }));

    setStopSequence(updatedWithTimes);
  };

  const toggleReverse = () => {
    const times = stopSequence.map((stop) => ({
      arrival_time: stop.arrival_time,
      departure_time: stop.departure_time,
    }));
    const reversedStops = [...stopSequence].reverse();
    const updated = reversedStops.map((stop, index) => ({
      ...stop,
      arrival_time: times[index].arrival_time,
      departure_time: times[index].departure_time,
    }));
    setStopSequence(updated);
    setReverseSequence((prev) => !prev);
  };

  return (
    <Box sx={{ px: 3, py: 2, width: "100%", boxSizing: "border-box" }}>
      {/* Header Buttons */}
      <Box display="flex" gap={2} justifyContent="flex-start" mb={2}>
        <Button
          variant="outlined"
          size="small"
          onClick={async () => {
            if (!isWholeSequenceChronological(stopSequence)) {
              showError(MESSAGES.trip.tripChronologicalError);
              return;
            }
            const stop_ids = enrichedStopSequence.map((stop) => stop.stop_id);
            const payload = { scenario_id: scenarioId, stop_ids };
            await previewShapeData(payload);
            setShowConfirm(true);
          }}
          disabled={!isFormValid}
        >
          {BUTTONS.common.save}
        </Button>
        <Button variant="outlined" size="small" onClick={onCancel}>
          {BUTTONS.common.back}
        </Button>
      </Box>

      <Box display="flex" gap={3} width="100%">
        {/* Trip Info Panel */}
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold" mb={2}>
            {LABELS.trip.tripInfo}
          </Typography>
          <Box display="flex" flexDirection="column" gap={2}>
            <TextField
              label={`${LABELS.trip.tripId} ${LABELS.gtfs.tripId}*`}
              value={tripInfo.trip_id}
              onChange={(e) =>
                setTripInfo({ ...tripInfo, trip_id: e.target.value })
              }
              helperText={LABELS.stop.uniqueIdHint}
              slotProps={{ formHelperText: { sx: { ml: 0, pl: 0, mt: 0.5 } } }}
            />
            <TextField
              label={`${LABELS.trip.tripShortName} ${LABELS.gtfs.tripShortName}`}
              value={tripInfo.trip_short_name || ""}
              onChange={(e) =>
                setTripInfo({ ...tripInfo, trip_short_name: e.target.value })
              }
            />
            <TextField
              label={`${LABELS.trip.tripHeadsign} ${LABELS.gtfs.tripHeadsign}`}
              value={tripInfo.trip_headsign || ""}
              onChange={(e) =>
                setTripInfo({ ...tripInfo, trip_headsign: e.target.value })
              }
            />
            <Box display="flex" gap={1}>
              <TextField
                select
                label={`${LABELS.common.direction} ${LABELS.gtfs.directionId} *`}
                value={tripInfo.direction_id}
                onChange={(e) =>
                  setTripInfo({ ...tripInfo, direction_id: e.target.value })
                }
                fullWidth
              >
                <MenuItem value="0">{LABELS.trip.directionLabel("0", LABELS.trip.inbound)}</MenuItem>
                <MenuItem value="1">{LABELS.trip.directionLabel("1", LABELS.trip.outbound)}</MenuItem>
              </TextField>
              <TextField
                select
                label={`${LABELS.common.serviceId} ${LABELS.gtfs.serviceId}*`}
                value={tripInfo.service_id}
                onChange={(e) =>
                  setTripInfo({ ...tripInfo, service_id: e.target.value })
                }
                fullWidth
              >
                {service_id_list.map((id) => (
                  <MenuItem key={id} value={id}>
                    {id}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          </Box>
        </Paper>

        {/* Stop Sequence Panel */}
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold" mb={2}>
            {LABELS.trip.stopSettings}
          </Typography>

          <FormControl fullWidth>
            <InputLabel>{LABELS.trip.stopSelectLabel} *</InputLabel>
            <Select
              value={selectedStop}
              label="Select Stop *"
              onChange={(e) => setSelectedStop(e.target.value)}
            >
              {stops_list.map((s) => (
                <MenuItem key={s.stop_id} value={s.stop_id}>
                  {`${s.stop_id} ${s.stop_name}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            size="small"
            sx={{ mt: 1 }}
            onClick={handleAddStop}
            disabled={!selectedStop}
          >
            {BUTTONS.common.add}
          </Button>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="stopsTable">
              {(provided) => (
                <Table
                  size="small"
                  sx={{ mt: 2 }}
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  <TableHead>
                    <TableRow>
                      {/* reverse toggle (matches CreateTrip/CreateRoute) */}
                      <TableCell sx={{ width: 50 }}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <IconButton
                            size="small"
                            aria-label="reverse order"
                            onClick={toggleReverse}
                            title={reverseSequence ? BUTTONS.common.reset : LABELS.trip.stopOrder}
                            sx={{
                              color: reverseSequence ? "primary.main" : "text.secondary",
                            }}
                          >
                            <span class="material-symbols-outlined outlined">
                              swap_vert
                            </span>
                          </IconButton>
                        </Box>
                      </TableCell>

                      <TableCell>
                        <TwoLineHeader jp={LABELS.trip.stopSequence} en={LABELS.gtfs.stopSequence} />
                      </TableCell>
                      <TableCell>
                        <TwoLineHeader jp={LABELS.stop.poleId} en={LABELS.gtfs.stopId} />
                      </TableCell>
                      <TableCell>
                        <TwoLineHeader jp={LABELS.stop.poleName} en={LABELS.gtfs.stopName} />
                      </TableCell>
                      <TableCell>
                        <TwoLineHeader jp={LABELS.trip.arrivalTime} en={LABELS.gtfs.arrivalTime} />
                      </TableCell>
                      <TableCell>
                        <TwoLineHeader jp={LABELS.trip.departureTime} en={LABELS.gtfs.departureTime} />
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {stopSequence.map((stop, index) => (
                      <Draggable
                        key={stop.stop_id}
                        draggableId={stop.stop_id.toString()}
                        index={index}
                      >
                        {(provided) => (
                          <TableRow
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                          >
                            {/* align with icon column */}
                            <TableCell />

                            <TableCell>{index + 1}</TableCell>
                            <TableCell>{stop.stop_id}</TableCell>
                            <TableCell>{stop.stop_name}</TableCell>

                            {/* Arrival: 24h with seconds */}
                            <TableCell>
                              <TextField
                                type="time"
                                value={stop.arrival_time || ""}
                                onChange={(e) => {
                                  const updated = [...stopSequence];
                                  const newArrival = normalizeHHMMSS(e.target.value);
                                  const departure = updated[index].departure_time;
                                  const prevDeparture =
                                    index > 0 ? updated[index - 1].departure_time : null;

                                  if (
                                    !isChronologicallyValid(
                                      prevDeparture,
                                      newArrival,
                                      departure
                                    )
                                  ) {
                                    showError(MESSAGES.trip.arrivalDepartureConstraint);
                                    return;
                                  }
                                  updated[index].arrival_time = newArrival;
                                  setStopSequence(updated);
                                }}
                                inputProps={{
                                  step: 1,        // enable seconds (HH:mm:ss)
                                  lang: "ja-JP",  // 24h UI
                                  inputMode: "numeric",
                                  pattern: "[0-9:]*",
                                }}
                                size="small"
                                fullWidth
                              />
                            </TableCell>

                            {/* Departure: 24h with seconds */}
                            <TableCell>
                              <TextField
                                type="time"
                                value={stop.departure_time || ""}
                                onChange={(e) => {
                                  const updated = [...stopSequence];
                                  const newDeparture = normalizeHHMMSS(e.target.value);
                                  const arrival = updated[index].arrival_time;
                                  const prevDeparture =
                                    index > 0 ? updated[index - 1].departure_time : null;

                                  if (
                                    !isChronologicallyValid(
                                      prevDeparture,
                                      arrival,
                                      newDeparture
                                    )
                                  ) {
                                    showError(MESSAGES.trip.departureArrivalConstraint);
                                    return;
                                  }

                                  updated[index].departure_time = newDeparture;
                                  setStopSequence(updated);
                                }}
                                inputProps={{
                                  step: 1,
                                  lang: "ja-JP",
                                  inputMode: "numeric",
                                  pattern: "[0-9:]*",
                                }}
                                size="small"
                                fullWidth
                              />
                            </TableCell>

                            <TableCell>
                              <IconButton
                                size="small"
                                onClick={() => handleRemoveStop(index)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </TableBody>
                </Table>
              )}
            </Droppable>
          </DragDropContext>

          {/* Removed the checkbox control */}
        </Paper>
      </Box>

      {/* Confirmation Dialog */}
      <CreateTripConfirmDialog
        open={showConfirm}
        onClose={() => {
          if (!loadingTripActions) {
            setShowConfirm(false);
          }
        }}
        onSave={onSave}
        onConfirm={async () => {
          const stop_times = enrichedStopSequence.map((stop, index) => ({
            stop_sequence: index + 1,
            arrival_time: stop.arrival_time,
            departure_time: stop.departure_time,
            stop_id: stop.stop_id,
          }));

          const payload = {
            scenario_id: scenarioId,
            route_id: route_id,
            trip_short_name: tripInfo.trip_short_name,
            trip_headsign: tripInfo.trip_headsign,
            service_id: tripInfo.service_id,
            trip_id: tripInfo.trip_id,
            direction_id: parseInt(tripInfo.direction_id, 10),
            stop_times,
          };
          try {
            await onSave(payload);
            setShowConfirm(false);
            onSuccess?.();
          } catch (error) {
            console.error("Save failed:", error);
          }
        }}
        tripInfo={tripInfo}
        stopSequence={enrichedStopSequence}
        reverseSequence={reverseSequence}
        scenarioId={scenarioId}
        shapeData={shapeData}
        loadingTripActions={loadingTripActions}
      />
    </Box>
  );
};

export default DuplicateTripForm;
