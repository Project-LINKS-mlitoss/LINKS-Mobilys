import React, { useState } from "react";
import TranslationFields from "./TranslationFields";
import {
  Box,
  TextField,
  MenuItem,
  Button,
  Typography,
  Paper,
  Select,
  Autocomplete,
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
import ConfirmRouteDialog from "./CreateRouteConfirmDialog";
import { routeTypeOptions } from "../../../constant/gtfs";
import { LABELS, BUTTONS } from "../../../strings";
import { MESSAGES } from "../../../constant";

/* --- Small two-line field label (JP + EN) --- */
const FieldLabel = ({ jp, en, required = false }) => (
  <Box display="flex" alignItems="baseline" gap={0.5}>
    <Typography fontSize={17} color="text.secondary">
      {jp}
    </Typography>
    <Typography fontSize={14} color="text.secondary">
      {en}
      {required ? " *" : ""}
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

const createStopRowId = () =>
  `stop-row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const CreateRouteForm = ({
  agency_list,
  service_id_list,
  stops_list,
  onCancel,
  onSave,
  scenarioId,
  onSuccess,
  loadingRouteActions,
  shapeData,
  previewShapeData,
}) => {
  const [routeInfo, setRouteInfo] = useState({
    route_id: "",
    route_short_name: "",
    route_long_name: "",
    route_type: "",
    agency_id: "",
    direction_id: "",
    service_id: "",
  });

  const [selectedStop, setSelectedStop] = useState("");
  const [stopSequence, setStopSequence] = useState([]);
  const [reverseSequence, setReverseSequence] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [translations, setTranslations] = useState([]);

  const isFormValid =
    routeInfo.route_id.trim() &&
    routeInfo.route_short_name.trim() &&
    routeInfo.route_type !== "" &&
    routeInfo.agency_id !== "" &&
    routeInfo.direction_id !== "" &&
    routeInfo.service_id.trim() &&
    stopSequence.length > 0;

  const handleAddStop = () => {
    if (!selectedStop) return;

    const stop = stops_list.find((s) => s.id === selectedStop);
    if (!stop) return;

    const ll = stop.latlng || stop.latlon || null;

    setStopSequence((prev) => [
      ...prev,
      {
        rowId: createStopRowId(),
        ...stop,
        latlng: ll,
      },
    ]);

    setSelectedStop("");
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

  const toggleReverse = () => {
    setStopSequence([...stopSequence].reverse());
    setReverseSequence((prev) => !prev);
  };

  const stopLabelId = "stop-select-label";

  return (
    <Box sx={{ px: 3, py: 2, width: "100%", boxSizing: "border-box" }}>
      {/* Header Buttons */}
      <Box display="flex" gap={2} justifyContent="flex-start" mb={2}>
        <Button
          variant="outlined"
          size="small"
          onClick={async () => {
            const stop_ids = stopSequence.map((stop) => stop.id);
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

      {/* Main content: two columns */}
      <Box display="flex" gap={3} width="100%">
        {/* Left column: Route Info + Translations */}
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Route Info Panel */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" mb={2}>
              {LABELS.common.routeInfo}
            </Typography>

            <Box display="flex" flexDirection="column" gap={2}>
              <TextField
                label={<FieldLabel jp={LABELS.common.routeId} en={LABELS.gtfs.routeId} required />}
                value={routeInfo.route_id}
                onChange={(e) =>
                  setRouteInfo({ ...routeInfo, route_id: e.target.value })
                }

                fullWidth
              />

              <TextField
                label={<FieldLabel jp={LABELS.route.routeShortName} en={LABELS.gtfs.routeShortName} required />}
                value={routeInfo.route_short_name}
                onChange={(e) =>
                  setRouteInfo({ ...routeInfo, route_short_name: e.target.value })
                }
                fullWidth
              />

              <TextField
                label={<FieldLabel jp={LABELS.common.routeLongName} en={LABELS.gtfs.routeLongName} />}
                value={routeInfo.route_long_name}
                onChange={(e) =>
                  setRouteInfo({ ...routeInfo, route_long_name: e.target.value })
                }
                fullWidth
              />

              <Box display="flex" gap={1}>
                <TextField
                  select
                  label={<FieldLabel jp={LABELS.route.routeType} en={LABELS.gtfs.routeType} required />}
                  value={routeInfo.route_type}
                  onChange={(e) =>
                    setRouteInfo({ ...routeInfo, route_type: e.target.value })
                  }
                  fullWidth
                >
                  {routeTypeOptions.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  select
                  label={<FieldLabel jp={LABELS.common.agencyId} en={LABELS.gtfs.agencyId} required />}
                  value={routeInfo.agency_id}
                  onChange={(e) =>
                    setRouteInfo({ ...routeInfo, agency_id: e.target.value })
                  }
                  fullWidth
                >
                  {agency_list.map((id) => (
                    <MenuItem key={id} value={id}>
                      {id}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>

              <Box display="flex" gap={1}>
                <TextField
                  select
                  label={<FieldLabel jp={LABELS.common.direction} en={LABELS.gtfs.directionId} required />}
                  value={routeInfo.direction_id}
                  onChange={(e) =>
                    setRouteInfo({ ...routeInfo, direction_id: e.target.value })
                  }
                  size="small"
                  fullWidth
                >
                  <MenuItem value="0">{LABELS.trip.directionLabel("0", LABELS.trip.inbound)}</MenuItem>
                  <MenuItem value="1">{LABELS.trip.directionLabel("1", LABELS.trip.outbound)}</MenuItem>
                </TextField>

                <TextField
                  select
                  label={<FieldLabel jp={LABELS.common.serviceId} en={LABELS.gtfs.serviceId} required />}
                  value={routeInfo.service_id}
                  onChange={(e) =>
                    setRouteInfo({ ...routeInfo, service_id: e.target.value })
                  }
                  size="small"
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

          {/* Translations Panel */}
          <TranslationFields
            translations={translations}
            setTranslations={setTranslations}
            originalValues={{
              route_short_name: routeInfo.route_short_name,
              route_long_name: routeInfo.route_long_name,
              route_desc: "",
            }}
          />
        </Box>

        {/* Right column: Stop Sequence Panel */}
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold" mb={2}>
            {LABELS.trip.stopSettings}
          </Typography>

          <Autocomplete
            options={Array.isArray(stops_list) ? stops_list : []}
            getOptionLabel={(option) =>
              `${option?.id ?? ""} ${option?.name ?? ""}`.trim()
            }
            value={(Array.isArray(stops_list) ? stops_list : []).find((s) => s.id === selectedStop) || null}
            onChange={(_, value) => setSelectedStop(value?.id || "")}
            renderInput={(params) => (
              <TextField
                {...params}
                label={<FieldLabel jp={LABELS.trip.stopSelectLabel} required />}
                placeholder={MESSAGES.validation.searchByPlaceholder}
              />
            )}
            fullWidth
          />

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
                      <TableCell sx={{ width: 50 }}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <IconButton
                            size="small"
                            aria-label="reverse order"
                            onClick={toggleReverse}
                            title={reverseSequence ? BUTTONS.common.undo : BUTTONS.common.reverse}
                            sx={{ color: reverseSequence ? "primary.main" : "text.secondary" }}
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
                      <TableCell />
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {stopSequence.map((stop, index) => (
                      <Draggable
                        key={stop.rowId}
                        draggableId={stop.rowId}
                        index={index}
                      >
                        {(provided) => (
                          <TableRow
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                          >
                            <TableCell />
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>{stop.id}</TableCell>
                            <TableCell>{stop.name}</TableCell>
                            <TableCell>
                              <IconButton size="small" onClick={() => handleRemoveStop(index)}>
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
        </Paper>
      </Box>

      {/* Confirmation Dialog */}
      <ConfirmRouteDialog
        open={showConfirm}
        onClose={() => !loadingRouteActions && setShowConfirm(false)}
        onSave={onSave}
        onConfirm={async () => {
          const payload = {
            scenario_id: scenarioId,
            route_data: {
              route_id: routeInfo.route_id,
              route_short_name: routeInfo.route_short_name,
              route_long_name: routeInfo.route_long_name,
              agency_id: routeInfo.agency_id,
              route_type: parseInt(routeInfo.route_type, 10),
            },
            trip_data: {
              service_id: routeInfo.service_id,
              direction_id: parseInt(routeInfo.direction_id, 10),
              shape_id: "",
            },
            stop_sequence: stopSequence.map((stop) => ({
              stop_id: stop.id,
              name: stop.name,
              latlng: stop.latlng,
            })),
            translations,
          };
          try {
            await onSave(payload);
            setShowConfirm(false);
            onSuccess?.();
          } catch (error) {
            console.error("Save failed:", error);
            // Propagate error so the confirm dialog remains open on failure
            throw error;
          }
        }}
        routeInfo={routeInfo}
        stopSequence={stopSequence}
        reverseSequence={reverseSequence}
        scenarioId={scenarioId}
        loadingRouteActions={loadingRouteActions}
        shapeData={shapeData}
      />
    </Box>
  );
};

export default CreateRouteForm;
