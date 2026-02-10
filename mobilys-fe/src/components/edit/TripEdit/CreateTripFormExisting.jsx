import React, { useState } from "react";
import {
  Box,
  TextField,
  MenuItem,
  Button,
  Typography,
  Paper,
  Select,
  FormControl,
  FormControlLabel,
  InputLabel,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Checkbox,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Close";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import ConfirmExistingRouteDialog from "./CreateRouteExistingConfirmDialog";
import { routeTypeOptions } from "../../../constant/gtfs";
import { LABELS, BUTTONS } from "../../../strings";

const EditRouteForm = ({
  agency_list,
  service_id_list,
  stops_list,
  route_list,
  route_pattern_list,
  onCancel,
  onSave,
  scenarioId,
  onSuccess
}) => {
  const [routeInfo, setRouteInfo] = useState({
    route_id: "",
    route_pattern_id: "",
    route_type: "",
    agency_id: "",
    direction_id: "",
    service_id: "",
  });

  const [selectedStop, setSelectedStop] = useState("");
  const [stopSequence, setStopSequence] = useState([]);
  const [reverseSequence, setReverseSequence] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedPatterns, setSelectedPatterns] = useState([]);

  const isFormValid =
    routeInfo.route_id.trim() &&
    routeInfo.route_pattern_id.trim() &&
    routeInfo.route_type !== "" &&
    routeInfo.agency_id !== "" &&
    routeInfo.direction_id !== "" &&
    routeInfo.service_id.trim() &&
    stopSequence.length > 0;

  const handleAddStop = () => {
    if (stopSequence.find((s) => s.id === selectedStop)) return;

    const stop = stops_list.find((s) => s.id === selectedStop);
    if (stop) {
      setStopSequence((prev) => [
        ...prev,
        {
          id: stop.id,
          name: stop.name,
          latlng: stop.latlon || stop.latlng || [],
        },
      ]);
    }
  };

  const handleRemoveStop = (index) => {
    setStopSequence((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const updated = Array.from(stopSequence);
    const [moved] = updated.splice(result.source.index, 1);
    updated.splice(result.destination.index, 0, moved);
    setStopSequence(updated);
  };

  return (
    <Box sx={{ px: 3, py: 2, width: "100%", boxSizing: "border-box" }}>
      <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-start", mb: 2 }}>
        <Button
          variant="outlined"
          size="small"
          onClick={() => setShowConfirm(true)}
          disabled={!isFormValid}
        >
          {BUTTONS.common.save}
        </Button>
        <Button variant="outlined" size="small" onClick={onCancel}>
          {BUTTONS.common.back}
        </Button>
      </Box>

      <Box display="flex" gap={3} width="100%">
        {/* Left Panel */}
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
            {LABELS.common.routeInfo}
          </Typography>
          <Box display="flex" flexDirection="column" gap={2}>
            <TextField
              select
              label={`${LABELS.gtfs.routeId} *`}
              value={routeInfo.route_id}
              onChange={(e) => {
                const selectedRouteId = e.target.value;
                const patterns = route_pattern_list[selectedRouteId] || [];
                setRouteInfo((prev) => ({
                  ...prev,
                  route_id: selectedRouteId,
                  route_pattern_id: "",
                  route_type: "",
                  agency_id: "",
                }));
                setSelectedPatterns(patterns);
                setStopSequence([]);
              }}
              fullWidth
            >
              {route_list.map((routeId) => (
                <MenuItem key={routeId} value={routeId}>
                  {routeId}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label={`${LABELS.gtfs.routePatternId} *`}
              value={routeInfo.route_pattern_id}
              onChange={(e) => {
                const patternId = e.target.value;
                const selectedPattern = selectedPatterns.find(
                  (p) => p.pattern_id === patternId
                );
                if (selectedPattern) {
                  setRouteInfo((prev) => ({
                    ...prev,
                    route_pattern_id: patternId,
                    direction_id: selectedPattern.direction_id.toString(),
                    service_id: selectedPattern.service_id,
                  }));

                  if (Array.isArray(selectedPattern.stop_sequence)) {
                    const stops = selectedPattern.stop_sequence.map((stop) => {
                      const matched = stops_list.find((s) => s.id === stop.stop_id);
                      if (!matched) {
                        console.warn(`Stop ${stop.stop_id} not found in stops_list`);
                      }
                      return {
                        id: stop.stop_id,
                        name: matched?.name || stop.stop_name || "(no name)",
                        latlng: matched?.latlng || [],
                      };
                    });
                    setStopSequence(stops);
                  } else {
                    console.warn("No stop_sequence array in selected pattern");
                    setStopSequence([]);
                  }

                }
              }}
              fullWidth
            >
              {selectedPatterns.map((p) => (
                <MenuItem key={p.pattern_id} value={p.pattern_id}>
                  {p.pattern_id}
                </MenuItem>
              ))}
            </TextField>

            <Box display="flex" gap={1}>
              <TextField
                select
                label={`${LABELS.gtfs.routeType} *`}
                value={routeInfo.route_type}
                onChange={(e) =>
                  setRouteInfo({ ...routeInfo, route_type: e.target.value })
                }
                fullWidth
              >
                {(routeTypeOptions || []).map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={`${LABELS.gtfs.agencyId} *`}
                value={routeInfo.agency_id}
                onChange={(e) =>
                  setRouteInfo({ ...routeInfo, agency_id: e.target.value })
                }
                fullWidth
              >
                {agency_list.map((agencyId) => (
                  <MenuItem key={agencyId} value={agencyId}>
                    {agencyId}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            <Box display="flex" gap={1}>
              <TextField
                select
                label={`${LABELS.gtfs.directionId} *`}
                value={routeInfo.direction_id}
                onChange={(e) =>
                  setRouteInfo({ ...routeInfo, direction_id: e.target.value })
                }
                fullWidth
              >
                <MenuItem value="0">{LABELS.trip.directionLabel("0", LABELS.trip.inbound)}</MenuItem>
                <MenuItem value="1">{LABELS.trip.directionLabel("1", LABELS.trip.outbound)}</MenuItem>
              </TextField>
              <TextField
                select
                label={`${LABELS.gtfs.serviceId} *`}
                value={routeInfo.service_id}
                onChange={(e) =>
                  setRouteInfo({ ...routeInfo, service_id: e.target.value })
                }
                fullWidth
              >
                {service_id_list.map((service_id) => (
                  <MenuItem key={service_id} value={service_id}>
                    {service_id}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          </Box>
        </Paper>

        {/* Right Panel */}
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
            {LABELS.trip.stopSettings}
          </Typography>

          <FormControl fullWidth>
            <InputLabel>{`${LABELS.trip.selectStop} *`}</InputLabel>
            <Select
              value={selectedStop}
              label={`${LABELS.trip.selectStop} *`}
              onChange={(e) => setSelectedStop(e.target.value)}
            >
              {stops_list.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {`${s.id} ${s.name}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button variant="outlined" size="small" sx={{ mt: 1 }} onClick={handleAddStop}>
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
                      <TableCell>{LABELS.trip.stopSequence}</TableCell>
                      <TableCell>{LABELS.gtfs.stopName}</TableCell>
                      <TableCell>{LABELS.gtfs.stopId}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(reverseSequence ? [...stopSequence].reverse() : stopSequence).map(
                      (stop, index) => {
                        const originalIndex = reverseSequence
                          ? stopSequence.length - 1 - index
                          : index;

                        return (
                          <Draggable
                            key={stop.id}
                            draggableId={stop.id.toString()}
                            index={originalIndex}
                          >
                            {(provided) => (
                              <TableRow
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                              >
                                <TableCell>{index + 1}</TableCell>
                                <TableCell>{stop.name}</TableCell>
                                <TableCell>{stop.id}</TableCell>
                                <TableCell>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleRemoveStop(originalIndex)}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            )}
                          </Draggable>
                        );
                      }
                    )}

                  </TableBody>
                </Table>
              )}
            </Droppable>
          </DragDropContext>

          <Box mt={1}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={reverseSequence}
                  onChange={(e) => setReverseSequence(e.target.checked)}
                />
              }
              label={LABELS.trip.reverseSequence}
            />
          </Box>
        </Paper>
      </Box>

      <ConfirmExistingRouteDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onSave={onSave}
        onConfirm={() => {
          const payload = {
            scenario_id: scenarioId,
            route_id: routeInfo.route_id,
            trip_data: {
              service_id: routeInfo.service_id,
              direction_id: parseInt(routeInfo.direction_id, 10),
              agency_id: routeInfo.agency_id,
            },
            stop_sequence: (reverseSequence
              ? [...stopSequence].reverse()
              : stopSequence
            ).map((stop) => ({
              stop_id: stop.id,
              name: stop.name,
              latlng: stop.latlng || [],
            })),
          };
          onSave(payload);
          setShowConfirm(false);
          onSuccess?.();
        }}
        routeInfo={routeInfo}
        stopSequence={stopSequence}
        reverseSequence={reverseSequence}
        scenarioId={scenarioId}
      />
    </Box>
  );
};

export default EditRouteForm;
