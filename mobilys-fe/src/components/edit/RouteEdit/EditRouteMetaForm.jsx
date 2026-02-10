import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  MenuItem,
  Paper,
  TextField,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from "@mui/material";
import { routeTypeOptions } from "../../../constant/gtfs";
import ConfirmExistingRouteDialog from "./CreateRouteExistingConfirmDialog";
import ShapeEditModal from "../RouteEdit/ShapeEditModal";
import { editTrip as editTripSvc, getTrip as getTripSvc } from "../../../services/tripService";
import {
  addNewShapeAndApplyToPatterns as addNewShapeAndApplyToPatternsSvc,
  generateShapeFromStops as generateShapeFromStopsSvc,
} from "../../../services/shapeService";
import { useSnackbarStore } from "../../../state/snackbarStore";
import ApplyShapeToPatternsDialog from "./ApplyShapeToPatternsDialog";
import { LABELS, BUTTONS } from "../../../strings";
import { MESSAGES } from "../../../constant";

// Two-line field label (JP + EN)
const FieldLabel = ({ jp, en, required = false }) => (
  <Box display="flex" alignItems="baseline" gap={0.5}>
    <Typography fontSize={17} color="text.secondary">{jp}</Typography>
    <Typography fontSize={14} color="text.secondary">
      {en}
      {required ? " *" : ""}
    </Typography>
  </Box>
);

// Two-line table header (JP + EN)
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

// Minimal edit form: only route_id, 運行パターンID, direction_id, service_id
const EditRouteMetaForm = ({
  agency_list,
  service_id_list,
  stops_list,
  route_list,
  route_pattern_list,
  onCancel,
  onSave,
  scenarioId,
  onSuccess,
  onRefetchTrips,
  hardReloadOnSuccess = false,
  loadingRouteActions,
  shapeData,
  previewShapeData,
  initialRouteId = null,
  initialPatternId = null,
  initialShapeId = null,
  initialShapePoints = null,
  tripsToUpdate = [], // optional: list of trip_ids to update when meta changes
  enableShapeApplyDialog = false,

  // shape editing props
  onSaveShape,
  onUpdateShapesBulk,

}) => {
  const { showSnackbar } = useSnackbarStore?.() || { showSnackbar: () => { } };
  const [routeInfo, setRouteInfo] = useState({
    route_id: "",
    route_pattern_id: "",
    direction_id: "",
    service_id: "",
    shape_id: "",
    // kept internally for payload/confirm dialog context
    route_type: "",
    agency_id: "",
  });

  // Keep shape points for the modal
  const [currentShapePoints, setCurrentShapePoints] = useState([]);

  // Keep a local copy of the current pattern's stops to send in payload/preview
  const [stopSequence, setStopSequence] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Shape edit modal state
  const [showShapeModal, setShowShapeModal] = useState(false);

  // Shape apply flow (after clicking "save" in ShapeEditModal)
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [pendingShapeSave, setPendingShapeSave] = useState(null); // { shapePoints, body }

  const prevInitRef = useRef({ routeId: null, patternId: null });
  const initialMetaRef = useRef({ direction_id: "", service_id: "" });

  const affectedPatterns = useMemo(() => {
    if (!enableShapeApplyDialog) return [];
    const targetShapeId = routeInfo?.shape_id;
    if (!targetShapeId || !route_pattern_list) return [];

    const items = [];
    Object.entries(route_pattern_list).forEach(([routeId, patterns]) => {
      (patterns || []).forEach((p) => {
        if (String(p?.shape_id ?? "") !== String(targetShapeId)) return;
        items.push({ ...p, route_id: routeId });
      });
    });

    return items;
  }, [enableShapeApplyDialog, routeInfo?.shape_id, route_pattern_list]);

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
      (initialPatternId && patterns.find((p) => p.pattern_id === initialPatternId)) ||
      patterns[0];

    const nextInfo = {
      route_id: initialRouteId,
      route_pattern_id: pat?.pattern_id ?? "",
      route_type: selectedRoute?.route_type?.toString() ?? "",
      agency_id: selectedRoute?.agency_id ?? "",
      direction_id: pat ? String(pat.direction_id) : "",
      service_id: pat?.service_id ?? "",
      shape_id: initialShapeId || pat?.shape_id || "",
    };
    setRouteInfo(nextInfo);
    initialMetaRef.current = {
      direction_id: nextInfo.direction_id,
      service_id: nextInfo.service_id,
    };

    // Set shape points from pattern or initial props
    if (initialShapePoints && Array.isArray(initialShapePoints)) {
      setCurrentShapePoints(initialShapePoints);
    } else if (pat?.shape && Array.isArray(pat.shape)) {
      setCurrentShapePoints(pat.shape);
    } else {
      setCurrentShapePoints([]);
    }

    if (pat && Array.isArray(pat.stop_sequence)) {
      const stops = pat.stop_sequence
        .slice()
        .sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence))
        .map((stop) => {
          const matched = stops_list?.find((s) => s.id === stop.stop_id);
          const ll = matched?.latlng || matched?.latlon || null;
          return {
            id: stop.stop_id,
            name: matched?.name || stop.stop_name || "(no name)",
            latlng: ll || stop.latlng,
          };
        });
      setStopSequence(stops);
    } else {
      setStopSequence([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRouteId, initialPatternId, initialShapeId, initialShapePoints]);

  const existingShapeIds = useMemo(() => {
    const ids = new Set();
    Object.values(route_pattern_list).forEach((patterns) => {
      (patterns || []).forEach((p) => {
        if (p?.shape_id) ids.add(p.shape_id);
      });
    });
    return Array.from(ids);
  }, [route_pattern_list]);

  const isFormValid =
    routeInfo.route_id.trim() &&
    routeInfo.route_pattern_id.trim() &&
    routeInfo.direction_id !== "" &&
    routeInfo.service_id.trim();

  const handleShapeModalSave = async (saveResult) => {
    const shapePoints = Array.isArray(saveResult)
      ? saveResult
      : Array.isArray(saveResult?.shapePoints)
        ? saveResult.shapePoints
        : [];
    const body = !Array.isArray(saveResult) ? saveResult?.body : undefined;

    if (enableShapeApplyDialog) {
      setPendingShapeSave({ shapePoints, body });
      setApplyDialogOpen(true);
      return;
    }

    // Legacy behavior (e.g. TripList): save immediately (or just close if no save handler)
    if (typeof onUpdateShapesBulk === "function" && body) {
      try {
        setSaving(true);
        await onUpdateShapesBulk(body);
        setCurrentShapePoints(shapePoints);
        setShowShapeModal(false);
      } catch (e) {
        console.error("Shape bulk update failed", e);
      } finally {
        setSaving(false);
      }
      return;
    }

    setCurrentShapePoints(shapePoints);
    if (onSaveShape) {
      onSaveShape({
        shape_id: routeInfo.shape_id,
        shape_points: shapePoints,
        route_id: routeInfo.route_id,
        pattern_id: routeInfo.route_pattern_id,
      });
    }
    setShowShapeModal(false);
  };

  const closeApplyDialog = () => {
    setApplyDialogOpen(false);
    setPendingShapeSave(null);
  };

  const handleApplyShapeSave = async ({ mode, selectedPatterns, newShapeId }) => {
    if (!pendingShapeSave) return;
    const { shapePoints, body } = pendingShapeSave;
    const selected = Array.isArray(selectedPatterns) ? selectedPatterns : [];
    if (selected.length === 0) return;

    if (mode === "override") {
      if (typeof onUpdateShapesBulk === "function" && body) {
        try {
          setSaving(true);
          await onUpdateShapesBulk(body);
          setCurrentShapePoints(shapePoints);
          closeApplyDialog();
          setShowShapeModal(false);
          if (typeof onRefetchTrips === "function") {
            Promise.resolve(onRefetchTrips()).catch(() => null);
          }
        } catch (e) {
          console.error("Shape bulk update failed", e);
        } finally {
          setSaving(false);
        }
        return;
      }

      setCurrentShapePoints(shapePoints);
      if (onSaveShape) {
        onSaveShape({
          shape_id: routeInfo.shape_id,
          shape_points: shapePoints,
          route_id: routeInfo.route_id,
          pattern_id: routeInfo.route_pattern_id,
        });
      }
      closeApplyDialog();
      setShowShapeModal(false);

      if (typeof onRefetchTrips === "function") {
        Promise.resolve(onRefetchTrips()).catch(() => null);
      }

      return;
    }

    if (!String(newShapeId || "").trim()) {
      showSnackbar?.({ title: MESSAGES.validation.inputShapeId, severity: "error" });
      return;
    }

    // Mode 2: payload prepared for upcoming API
    const nextShapeId = String(newShapeId).trim();
    const coordinates = Array.isArray(body?.shapes)
      ? body.shapes.map((row) => ({
        shape_id: nextShapeId,
        shape_pt_sequence: row.shape_pt_sequence,
        shape_pt_lat: row.shape_pt_lat,
        shape_pt_lon: row.shape_pt_lon,
        shape_dist_traveled: row.shape_dist_traveled,
      }))
      : [];

    const payload = {
      trip_patterns: selected.map((p) => ({
        scenario_id: scenarioId,
        route_id: p.route_id,
        service_id: p.service_id,
        trip_headsign: p.trip_headsign ?? "",
        shape_id: String(routeInfo.shape_id ?? ""),
        direction_id:
          typeof p.direction_id === "string" ? parseInt(p.direction_id, 10) : p.direction_id,
      })),
      shape: {
        shape_id: nextShapeId,
        coordinates,
      },
    };

    try {
      setSaving(true);
      await addNewShapeAndApplyToPatternsSvc(payload);
      setCurrentShapePoints(shapePoints);

      const isCurrentPatternSelected = selected.some(
        (p) =>
          String(p?.route_id ?? "") === String(routeInfo.route_id ?? "") &&
          String(p?.pattern_id ?? "") === String(routeInfo.route_pattern_id ?? "")
      );
      if (isCurrentPatternSelected) {
        setRouteInfo((prev) => ({ ...prev, shape_id: payload.shape.shape_id }));
      }

      if (typeof onRefetchTrips === "function") {
        Promise.resolve(onRefetchTrips()).catch(() => null);
      }

      closeApplyDialog();
      setShowShapeModal(false);
      showSnackbar?.({ title: MESSAGES.route.shapeAdded, severity: "success" });
    } catch (e) {
      console.error("addNewShapeAndApplyToPatterns failed", e);
      showSnackbar?.({
        title: e?.message || MESSAGES.route.shapeAddFailed,
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateShape = async () => {
    try {
      if (!Array.isArray(stopSequence) || stopSequence.length === 0) return;

      const stops = stopSequence
        .map((s) => {
          const ll = s?.latlng || s?.latlon || null;
          const lat = Array.isArray(ll) ? ll[0] : ll?.lat;
          const lon = Array.isArray(ll) ? ll[1] : (ll?.lng ?? ll?.lon);
          return {
            stop_id: s?.id,
            stop_name: s?.name,
            stop_lat: lat,
            stop_lon: lon,
          };
        })
        .filter((s) => s.stop_id && Number.isFinite(Number(s.stop_lat)) && Number.isFinite(Number(s.stop_lon)))
        .map((s) => ({
          ...s,
          stop_lat: Number(s.stop_lat),
          stop_lon: Number(s.stop_lon),
        }));

      if (stops.length === 0) {
        showSnackbar?.({ title: MESSAGES.validation.missingStopCoords, severity: "error" });
        return;
      }

      const result = await generateShapeFromStopsSvc({
        stops,
        route_type: Number(routeInfo.route_type || 3),
        coordinate_keys: ["stop_lon", "stop_lat"],
      });

      const shapePoints = Array.isArray(result) ? result : (result?.data ?? []);
      if (Array.isArray(shapePoints) && shapePoints.length > 0) {
        setCurrentShapePoints(shapePoints);
        showSnackbar?.({ title: MESSAGES.route.shapeGenerated, severity: "success" });
      }
    } catch (e) {
      console.error("Shape generation failed", e);
      showSnackbar?.({ title: e?.message || MESSAGES.route.shapeGenerateFailed, severity: "error" });
    }
  };

  return (
    <Box sx={{ px: 3, py: 2, width: "100%", boxSizing: "border-box" }}>
      <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-start", mb: 2 }}>
        <Button
          variant="outlined"
          size="small"
          onClick={async () => {
            if (!isFormValid) return;
            try {
              const stop_ids = stopSequence.map((s) => s.id);
              if (previewShapeData && stop_ids.length > 0) {
                await previewShapeData({ scenario_id: scenarioId, stop_ids });
              }
              setShowConfirm(true);
            } catch (e) {
              console.error("previewShapeData failed", e);
              setShowConfirm(true);
            }
          }}
          disabled={!isFormValid || saving}
        >
          {BUTTONS.common.save}
        </Button>
        <Button variant="outlined" size="small" onClick={onCancel} disabled={saving}>
          {BUTTONS.common.back}
        </Button>
      </Box>

      <Box display="flex" gap={3} width="100%">
        <Paper sx={{ p: 2, maxWidth: 560, flex: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
            {LABELS.route.routeInfoBasic}
          </Typography>

          <Box display="flex" flexDirection="column" gap={2}>
            <TextField
              label={<FieldLabel jp={LABELS.common.routeId} en={LABELS.gtfs.routeId} required />}
              value={routeInfo.route_id}
              fullWidth
              disabled
            />

            <TextField
              label={<FieldLabel jp={LABELS.common.patternId} en={LABELS.gtfs.routePatternId} required />}
              value={routeInfo.route_pattern_id}
              fullWidth
              disabled
              margin="dense"
              sx={{ mb: 0, "& .MuiInputBase-root": { fontSize: 14 } }}
            />

            <Box display="flex" gap={1}>
              <TextField
                select
                label={<FieldLabel jp={LABELS.route.routeType} en={LABELS.gtfs.routeType} />}
                value={routeInfo.route_type}
                fullWidth
                disabled
              >
                {(routeTypeOptions || []).map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label={<FieldLabel jp={LABELS.common.agencyId} en={LABELS.gtfs.agencyId} />}
                value={routeInfo.agency_id}
                fullWidth
                disabled
              >
                {(agency_list || []).map((agencyId) => (
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
                <MenuItem value="0">{LABELS.trip.directionLabelHalf("0", LABELS.trip.inbound)}</MenuItem>
                <MenuItem value="1">{LABELS.trip.directionLabelHalf("1", LABELS.trip.outbound)}</MenuItem>
              </TextField>

              <TextField
                select
                label={<FieldLabel jp={LABELS.common.serviceId} en={LABELS.gtfs.serviceId} required />}
                value={routeInfo.service_id}
                onChange={(e) => setRouteInfo({ ...routeInfo, service_id: e.target.value })}
                fullWidth
              >
                {(service_id_list || []).map((service_id) => (
                  <MenuItem key={service_id} value={service_id}>
                    {service_id}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            <TextField
              label={<FieldLabel jp={LABELS.common.shapeId} en={LABELS.gtfs.shapeId} />}
              value={routeInfo.shape_id}
              fullWidth
              disabled
              margin="dense"
              sx={{ "& .MuiInputBase-root": { fontSize: 14 } }}
            />

            {/* Shape Edit Button */}
            <Button
              variant="contained"
              color="primary"
              onClick={() => setShowShapeModal(true)}
              sx={{ alignSelf: "flex-start", mt: 1 }}
            >
              {LABELS.route.editShape}
            </Button>
          </Box>
        </Paper>

        {/* Stop Sequence Panel */}
        <Paper sx={{ p: 2, flex: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold" mb={2}>
            {LABELS.trip.stops}
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
              {stopSequence.map((stop, index) => (
                <TableRow key={`${stop.id}-${index}`}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{stop.id}</TableCell>
                  <TableCell>{stop.name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      </Box>

      {/* Shape Edit Modal */}
      <ShapeEditModal
        open={showShapeModal}
        onClose={() => setShowShapeModal(false)}
        shapeId={routeInfo.shape_id}
        shapePoints={currentShapePoints}
        stopSequence={stopSequence}
        onSave={handleShapeModalSave}
        onGenerateShape={handleGenerateShape}
        loading={saving || loadingRouteActions || applyDialogOpen}
      />

      {/* Apply-to-patterns dialog (RouteEdit only) */}
      {enableShapeApplyDialog && (
        <ApplyShapeToPatternsDialog
          open={applyDialogOpen}
          onClose={closeApplyDialog}
          onConfirm={handleApplyShapeSave}
          loading={saving || loadingRouteActions}
          shapeId={routeInfo.shape_id}
          affectedPatterns={affectedPatterns}
          defaultSelectedRouteId={routeInfo.route_id}
          defaultSelectedPatternId={routeInfo.route_pattern_id}
          existingShapeIds={existingShapeIds}
        />
      )}

      {/* Reuse existing confirmation dialog to keep UX consistent */}
      <ConfirmExistingRouteDialog
        open={showConfirm}
        onClose={() => !(saving || loadingRouteActions) && setShowConfirm(false)}
        onSave={onSave}
        afterConfirm={async () => {
          try {
            if (typeof onRefetchTrips === "function") await onRefetchTrips();
          } catch {
            void 0;
          }
        }}
        onConfirm={async () => {
          try {
            setSaving(true);
            // If meta changed, update each trip in the selected pattern
            const dirChanged =
              String(initialMetaRef.current.direction_id) !== String(routeInfo.direction_id);
            const svcChanged =
              String(initialMetaRef.current.service_id) !== String(routeInfo.service_id);

            // Determine target trip IDs: use provided list, otherwise fetch from API
            let targetTripIds = Array.isArray(tripsToUpdate) ? tripsToUpdate : [];
            if (targetTripIds.length === 0 && scenarioId && routeInfo.route_id && routeInfo.route_pattern_id) {
              try {
                const tripAgg = await getTripSvc(scenarioId);
                const routes = tripAgg?.data || [];
                const r = routes.find((x) => String(x.route_id) === String(routeInfo.route_id));
                const pat = (r?.route_patterns || []).find((p) => String(p.pattern_id) === String(routeInfo.route_pattern_id));
                targetTripIds = (pat?.trips || []).map((t) => t.trip_id);
              } catch (e) {
                console.error("Failed to load trips for pattern", e);
              }
            }

            if (scenarioId && (dirChanged || svcChanged) && targetTripIds.length > 0) {
              const newDirection = parseInt(routeInfo.direction_id, 10);
              const newService = routeInfo.service_id;
              // Update each trip sequentially to ensure backend applies all changes reliably
              for (const tripId of targetTripIds) {
                try {
                  await editTripSvc(scenarioId, tripId, {
                    old_trip_id: tripId,
                    service_id: newService,
                    direction_id: newDirection,
                  });
                } catch (e) {
                  console.error("Failed to update trip", tripId, e);
                }
              }
            }

            try {
              showSnackbar && showSnackbar({ title: MESSAGES.trip.updateSuccess, severity: "success" });
            } catch {
              void 0;
            }

            try {
              if (typeof onRefetchTrips === "function") onRefetchTrips();
            } catch {
              void 0;
            }
            setShowConfirm(false);
            onSuccess?.();
            if (hardReloadOnSuccess && typeof window !== "undefined") {
              window.location.reload();
            }
          } catch (error) {
            console.error("Save failed:", error);
            try {
              showSnackbar && showSnackbar({ title: error?.message || MESSAGES.trip.updateFailed, severity: "error" });
            } catch {
              void 0;
            }
          } finally {
            setSaving(false);
          }
        }}
        routeInfo={routeInfo}
        stopSequence={stopSequence}
        shapeData={shapeData}
        loadingRouteActions={saving || loadingRouteActions}
      />
    </Box>
  );
};

export default EditRouteMetaForm;
