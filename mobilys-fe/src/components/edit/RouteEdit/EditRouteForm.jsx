// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  TextField,
  MenuItem,
  Button,
  Typography,
  Paper,
  Autocomplete,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Close";
import { routeTypeOptions } from "../../../constant/gtfs";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import ConfirmExistingRouteDialog from "./CreateRouteExistingConfirmDialog";
import { LABELS, BUTTONS } from "../../../strings";
import { MESSAGES } from "../../../constant";

/* Two-line field label (JP + EN) */
const FieldLabel = ({ jp, en, required = false }) => (
  <Box display="flex" alignItems="baseline" gap={0.5}>
    <Typography fontSize={17} color="text.secondary">{jp}</Typography>
    <Typography fontSize={14} color="text.secondary">
      {en}{required ? " *" : ""}
    </Typography>
  </Box>
);

/* Two-line header block for tables */
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

const EditRouteForm = ({
  agency_list,
  service_id_list,
  stops_list,
  route_list,
  route_pattern_list,
  onCancel,
  onSave,
  scenarioId,
  onSuccess,
  loadingRouteActions,
  shapeData,
  previewShapeData,
  initialRouteId = null,
  initialPatternId = null,
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

  const prevInitRef = useRef({ routeId: null, patternId: null });

  useEffect(() => {
    if (!initialRouteId) return;
    const changed =
      prevInitRef.current.routeId !== initialRouteId ||
      prevInitRef.current.patternId !== initialPatternId;
    if (!changed && routeInfo.route_id) return;

    prevInitRef.current = { routeId: initialRouteId, patternId: initialPatternId };

    const selectedRoute = route_list.find((r) => r.route_id === initialRouteId);
    const patterns = route_pattern_list[initialRouteId] || [];
    const pat =
      (initialPatternId &&
        patterns.find((p) => p.pattern_id === initialPatternId)) || patterns[0];

    setRouteInfo((prev) => ({
      ...prev,
      route_id: initialRouteId,
      route_pattern_id: pat?.pattern_id ?? "",
      route_type: selectedRoute?.route_type?.toString() ?? "",
      agency_id: selectedRoute?.agency_id ?? "",
      direction_id: pat ? pat.direction_id.toString() : "",
      service_id: pat?.service_id ?? "",
    }));

    if (pat && Array.isArray(pat.stop_sequence)) {
      const stops = pat.stop_sequence.map((stop, idx) => {
        const matched = stops_list.find((s) => s.id === stop.stop_id);
        const ll = matched?.latlng || matched?.latlon || null;
        return {
          rowId: createStopRowId(),
          id: stop.stop_id,
          name: matched?.name || stop.stop_name || "(no name)",
          latlng: ll,
          stop_latlng: ll,
        };
      });
      setStopSequence(stops);
    } else {
      setStopSequence([]);
    }


    setSelectedStop("");
    setReverseSequence(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRouteId, initialPatternId]);

  const isFormValid =
    routeInfo.route_id.trim() &&
    routeInfo.route_pattern_id.trim() &&
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
        id: stop.id,
        name: stop.name,
        latlng: ll,
        stop_latlng: ll,
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

  const displayedStops = reverseSequence ? [...stopSequence].reverse() : stopSequence;

  return (
    <Box sx={{ px: 3, py: 2, width: "100%", boxSizing: "border-box" }}>
      <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-start", mb: 2 }}>
        <Button
          variant="outlined"
          size="small"
          onClick={async () => {
            try {
              const stop_ids = displayedStops.map((stop) => stop.id);
              await previewShapeData({ scenario_id: scenarioId, stop_ids });
              setShowConfirm(true);
            } catch (e) {
              console.error("previewShapeData failed", e);
              setShowConfirm(true);
            }
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
        {/* Left Panel */}
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
            {LABELS.common.routeInfo}
          </Typography>

          <Box display="flex" flexDirection="column" gap={2}>
            {/* Read-only IDs with two-line labels */}
            <TextField
              label={<FieldLabel jp={LABELS.common.routeId} en={LABELS.gtfs.routeId} required />}
              value={routeInfo.route_id}
              fullWidth
              disabled
            />
            <TextField
              label={<FieldLabel jp={LABELS.route.internalPatternId} en="" required />}
              value={routeInfo.route_pattern_id}
              fullWidth
              disabled
              margin="dense"
              sx={{
                mb: 0, // no bottom margin at all
                "& .MuiInputBase-root": { fontSize: 14 }, // optional compact input
              }}
            />

            <Typography
              variant="body2"
              sx={{ color: "text.secondary", fontSize: 12, mt: -1.5 }}
            >
              {LABELS.route.autoIdHint}
            </Typography>


            <Box display="flex" gap={1}>
              <TextField
                select
                label={<FieldLabel jp={LABELS.route.routeType} en={LABELS.gtfs.routeType} required />}
                value={routeInfo.route_type}
                onChange={(e) => setRouteInfo({ ...routeInfo, route_type: e.target.value })}
                fullWidth
                disabled
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
                onChange={(e) => setRouteInfo({ ...routeInfo, agency_id: e.target.value })}
                fullWidth
                disabled
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
                label={<FieldLabel jp={LABELS.common.direction} en={LABELS.gtfs.directionId} required />}
                value={routeInfo.direction_id}
                onChange={(e) => setRouteInfo({ ...routeInfo, direction_id: e.target.value })}
                fullWidth
              >
                <MenuItem value="0">{LABELS.trip.directionLabel("0", LABELS.trip.inbound)}</MenuItem>
                <MenuItem value="1">{LABELS.trip.directionLabel("1", LABELS.trip.outbound)}</MenuItem>
              </TextField>

              <TextField
                select
                label={<FieldLabel jp={LABELS.common.serviceId} en={LABELS.gtfs.serviceId} required />}
                value={routeInfo.service_id}
                onChange={(e) => setRouteInfo({ ...routeInfo, service_id: e.target.value })}
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

          <Autocomplete
            options={Array.isArray(stops_list) ? stops_list : []}
            getOptionLabel={(option) =>
              `${option?.id ?? ""} ${option?.name ?? ""}`.trim()
            }
            value={
              (Array.isArray(stops_list) ? stops_list : []).find(
                (s) => s.id === selectedStop
              ) || null
            }
            onChange={(_, value) => setSelectedStop(value?.id || "")}
            renderInput={(params) => (
              <TextField
                {...params}
                label={<FieldLabel jp={LABELS.trip.stopSelectLabel} en="" required />}
                placeholder={MESSAGES.validation.searchByPlaceholder}
              />
            )}
            fullWidth
          />

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
                      <TableCell sx={{ width: 50 }}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <IconButton
                            size="small"
                            aria-label={BUTTONS.common.reverseOrder}
                            onClick={() => setReverseSequence((v) => !v)}
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
                    {displayedStops.map((stop, index) => {
                      const originalIndex = reverseSequence
                        ? stopSequence.length - 1 - index
                        : index;
                      return (
                        <Draggable
                          key={stop.rowId}
                          draggableId={stop.rowId}
                          index={originalIndex}
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
                    })}
                  </TableBody>
                </Table>
              )}
            </Droppable>
          </DragDropContext>
        </Paper>
      </Box>

      {/* Confirmation Dialog */}
      <ConfirmExistingRouteDialog
        open={showConfirm}
        onClose={() => !loadingRouteActions && setShowConfirm(false)}
        onSave={onSave}
        onConfirm={async () => {
          const payload = {
            scenario_id: scenarioId,
            route_id: routeInfo.route_id,
            trip_data: {
              service_id: routeInfo.service_id,
              direction_id: parseInt(routeInfo.direction_id, 10),
              agency_id: routeInfo.agency_id,
            },
            stop_sequence: displayedStops.map((stop) => ({
              stop_id: stop.id,
              name: stop.name,
              latlng: stop.latlng || null,
            })),
          };
          try {
            await onSave(payload);
            setShowConfirm(false);
            onSuccess?.();
          } catch (error) {
            console.error("Save failed:", error);
          }
        }}
        routeInfo={routeInfo}
        stopSequence={displayedStops}
        shapeData={shapeData}
        loadingRouteActions={loadingRouteActions}
      />
    </Box>
  );
};

export default EditRouteForm;
