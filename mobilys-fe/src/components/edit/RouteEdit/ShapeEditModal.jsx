// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React, { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Tooltip,
} from "@mui/material";
import { LABELS, BUTTONS } from "../../../strings";
import { MESSAGES } from "../../../constant";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { MapContainer, TileLayer, Polyline, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import StopIcon, { stopLocationOnDivIconOptions } from "../../StopIcon";

// Fix default marker icon issue in Leaflet with webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Haversine formula to calculate distance between 2 coordinates (in meters)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Round coordinate to 6 decimal places
const roundCoord6 = (value) => {
  const n = typeof value === "number" ? value : parseFloat(value);
  if (!Number.isFinite(n)) return n;
  return Number(n.toFixed(6));
};

// Function to recalculate all distances in points array
const recalculateAllDistances = (points) => {
  if (!points || points.length === 0) return points;

  let totalDist = 0;
  return points.map((point, index) => {
    if (index === 0) {
      return { ...point, dist: 0 };
    }
    const prevPoint = points[index - 1];
    const distance = calculateDistance(prevPoint.lat, prevPoint.lon, point.lat, point.lon);
    totalDist += distance;
    return { ...point, dist: Math.round(totalDist) };
  });
};

// Normalize shape points to standard format
const normalizeShapePoints = (shapePoints) => {
  if (!Array.isArray(shapePoints) || shapePoints.length === 0) return [];

  const normalized = shapePoints.map((point, index) => {
    if (Array.isArray(point)) {
      return {
        sequence: index + 1,
        lat: roundCoord6(point[0]),
        lon: roundCoord6(point[1]),
        dist: 0,
        _originalId: `original-${index}`,
      };
    }
    return {
      sequence: point.shape_pt_sequence || index + 1,
      lat: roundCoord6(point.shape_pt_lat ?? point.lat ?? point[0]),
      lon: roundCoord6(point.shape_pt_lon ?? point.lon ?? point[1]),
      dist: point.shape_dist_traveled || 0,
      _originalId: `original-${index}`,
    };
  });

  return recalculateAllDistances(normalized);
};

// Custom draggable shape point icon
const createShapePointIcon = (isSelected = false, isModified = false) => {
  let bgColor = "#424242"; // default dark gray

  if (isModified) {
    bgColor = "#EF5350"; // light red for modified/new points
  }
  if (isSelected) {
    bgColor = "#1976d2"; // blue for selected
  }

  return L.divIcon({
    className: "shape-point-marker",
    html: `<div style="
      width: 12px;
      height: 12px;
      background-color: ${bgColor};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      cursor: grab;
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
};

// Component to fit map bounds to shape (initial load only)
const FitBounds = ({ positions, trigger }) => {
  const map = useMap();

  useEffect(() => {
    if (positions && positions.length > 0) {
      const bounds = positions.map((p) => [p.lat, p.lon]);
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [30, 30] });
      }
    }
  }, [map, trigger]);

  return null;
};

// Component to zoom to selected point
const ZoomToPoint = ({ point, trigger }) => {
  const map = useMap();

  useEffect(() => {
    if (point && trigger) {
      map.flyTo([point.lat, point.lon], 17, {
        duration: 0.5,
      });
    }
  }, [map, point, trigger]);

  return null;
};

// Draggable shape point marker component
const DraggableShapePoint = ({ position, index, onDragEnd, isSelected, isModified, onClick }) => {
  // Use state instead of ref for more reliable marker instance tracking
  const [markerInstance, setMarkerInstance] = useState(null);

  // Memoize icon to prevent unnecessary recreations
  const icon = useMemo(() => {
    return createShapePointIcon(isSelected, isModified);
  }, [isSelected, isModified]);

  // Update icon when selection or modification state changes
  // Using useLayoutEffect ensures the update happens before browser paint
  useLayoutEffect(() => {
    if (markerInstance) {
      markerInstance.setIcon(icon);
    }
  }, [markerInstance, icon]);

  const eventHandlers = useMemo(
    () => ({
      dragend(e) {
        const marker = e.target;
        const newPos = marker.getLatLng();
        onDragEnd(index, newPos.lat, newPos.lng);
      },
      click() {
        onClick(index);
      },
    }),
    [index, onDragEnd, onClick]
  );

  // Callback ref to capture marker instance when it's mounted
  const markerRef = useCallback((node) => {
    if (node !== null) {
      setMarkerInstance(node);
    }
  }, []);

  return (
    <Marker
      ref={markerRef}
      position={[position.lat, position.lon]}
      draggable={true}
      eventHandlers={eventHandlers}
      icon={icon}
      zIndexOffset={1000}
    />
  );
};

// Two-line table header component (Japanese + GTFS field name)
const TwoLineHeader = ({ jp, gtfsField }) => (
  <Box>
    <Typography fontWeight="bold" fontSize={13} noWrap color="text.primary">
      {jp}
    </Typography>
    <Typography
      fontSize={11}
      color="text.secondary"
      sx={{ display: "block", lineHeight: "14px" }}
    >
      {gtfsField}
    </Typography>
  </Box>
);

// Legend component
const MapLegend = () => (
  <Paper
    sx={{
      position: "absolute",
      bottom: 10,
      left: 10,
      zIndex: 1000,
      p: 1.5,
      backgroundColor: "rgba(255, 255, 255, 0.95)",
      minWidth: 160,
    }}
  >
    <Typography variant="caption" fontWeight="bold" sx={{ mb: 1, display: "block" }}>
      {LABELS.common.legend}
    </Typography>

    {/* Stop marker legend */}
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
      <StopIcon color="#1976D2" fontSize={28} />
      <Typography variant="caption" color="text.secondary">
        {LABELS.stop.pole}
      </Typography>
    </Box>

    {/* Shape point legend */}
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
      <Box
        sx={{
          width: 12,
          height: 12,
          backgroundColor: "#424242",
          border: "2px solid white",
          borderRadius: "50%",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          ml: "2px",
        }}
      />
      <Typography variant="caption" color="text.secondary">
        {LABELS.route.shapePoint}
      </Typography>
    </Box>

    {/* Modified/New point legend */}
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
      <Box
        sx={{
          width: 12,
          height: 12,
          backgroundColor: "#EF5350",
          border: "2px solid white",
          borderRadius: "50%",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          ml: "2px",
        }}
      />
      <Typography variant="caption" color="text.secondary">
        {LABELS.route.modifiedPoint}
      </Typography>
    </Box>

    {/* Selected shape point legend */}
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
      <Box
        sx={{
          width: 12,
          height: 12,
          backgroundColor: "#1976d2",
          border: "2px solid white",
          borderRadius: "50%",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          ml: "2px",
        }}
      />
      <Typography variant="caption" color="text.secondary">
        {LABELS.route.selectedPoint}
      </Typography>
    </Box>

    {/* Polyline legend */}
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Box
        sx={{
          width: 20,
          height: 3,
          backgroundColor: "#4CAF50",
          borderRadius: 1,
        }}
      />
      <Typography variant="caption" color="text.secondary">
        {LABELS.common.route}
      </Typography>
    </Box>
  </Paper>
);

const ShapeEditModal = ({
  open,
  onClose,
  shapeId,
  shapePoints = [],
  stopSequence = [],
  onSave,
  onGenerateShape,
  loading = false,
}) => {
  // Editable shape points state
  const [editablePoints, setEditablePoints] = useState([]);
  const [selectedPointIndex, setSelectedPointIndex] = useState(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [initializing, setInitializing] = useState(false);

  // Track original points for comparison
  const originalPointsRef = useRef([]);
  const wasOpenRef = useRef(false);

  // Track modified point indices
  const [modifiedIndices, setModifiedIndices] = useState(new Set());

  // Trigger for zoom to point (increment to trigger zoom)
  const [zoomTrigger, setZoomTrigger] = useState(0);

  // Flag to indicate zoom should happen (from table click)
  const [pendingZoom, setPendingZoom] = useState(false);

  // Memoize stop icon
  const stopIcon = useMemo(() => {
    return L.divIcon(stopLocationOnDivIconOptions({ color: "#1976D2", fontSize: 35 }));
  }, []);

  // Get selected point for zoom
  const selectedPoint = useMemo(() => {
    if (selectedPointIndex !== null && editablePoints[selectedPointIndex]) {
      return editablePoints[selectedPointIndex];
    }
    return null;
  }, [selectedPointIndex, editablePoints]);

  // Initialize editable points from props
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      setInitializing(false);
      setInitialLoadDone(false);
      return;
    }

    const isOpening = !wasOpenRef.current;
    wasOpenRef.current = true;

    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;

      // Reset selection/zoom when external shape points change (e.g. auto-generate)
      setSelectedPointIndex(null);
      setZoomTrigger(0);
      setPendingZoom(false);

      if (!Array.isArray(shapePoints) || shapePoints.length === 0) {
        setEditablePoints([]);
        originalPointsRef.current = [];
        setModifiedIndices(new Set());
        if (isOpening) setInitialLoadDone(false);
        if (isOpening) setInitializing(false);
        return;
      }

      const normalized = normalizeShapePoints(shapePoints);
      setEditablePoints(normalized);
      originalPointsRef.current = JSON.parse(JSON.stringify(normalized));
      setModifiedIndices(new Set());
      if (isOpening) setInitialLoadDone(true);
      if (isOpening) setInitializing(false);
    }, 0);

    if (isOpening) setInitializing(true);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, shapePoints]);

  // Handle delayed zoom after selection change
  // This ensures marker icon update is applied before map flyTo animation starts
  useEffect(() => {
    if (pendingZoom && selectedPointIndex !== null) {
      const timer = setTimeout(() => {
        setZoomTrigger((t) => t + 1);
        setPendingZoom(false);
      }, 150); // Delay to ensure icon update completes first

      return () => clearTimeout(timer);
    }
  }, [pendingZoom, selectedPointIndex]);

  // Check if a point is modified compared to original
  const isPointModified = useCallback((index) => {
    return modifiedIndices.has(index);
  }, [modifiedIndices]);

  // Mark point as modified
  const markAsModified = useCallback((index) => {
    setModifiedIndices((prev) => {
      const newSet = new Set(prev);
      newSet.add(index);
      return newSet;
    });
  }, []);

  // Reset to original state
  const handleReset = useCallback(() => {
    if (originalPointsRef.current.length > 0) {
      setEditablePoints(JSON.parse(JSON.stringify(originalPointsRef.current)));
      setModifiedIndices(new Set());
      setSelectedPointIndex(null);
    }
  }, []);

  // Check if there are any modifications
  const hasModifications = useMemo(() => {
    return modifiedIndices.size > 0;
  }, [modifiedIndices]);

  // Polyline positions for map
  const polylinePositions = useMemo(() => {
    return editablePoints.map((p) => [p.lat, p.lon]);
  }, [editablePoints]);

  // Stop positions for markers
  const stopPositions = useMemo(() => {
    if (!Array.isArray(stopSequence)) return [];
    return stopSequence
      .filter((s) => s.latlng && Array.isArray(s.latlng))
      .map((s) => ({
        id: s.id,
        name: s.name,
        lat: s.latlng[0],
        lon: s.latlng[1],
      }));
  }, [stopSequence]);

  // Calculate map center
  const mapCenter = useMemo(() => {
    if (editablePoints.length > 0) {
      const midIndex = Math.floor(editablePoints.length / 2);
      return [editablePoints[midIndex].lat, editablePoints[midIndex].lon];
    }
    if (stopPositions.length > 0) {
      return [stopPositions[0].lat, stopPositions[0].lon];
    }
    return [35.6812, 139.7671];
  }, [editablePoints, stopPositions]);

  // Handle drag end from map - auto recalculate distances
  const handleDragEnd = useCallback((index, newLat, newLon) => {
    setEditablePoints((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        lat: roundCoord6(newLat),
        lon: roundCoord6(newLon),
      };
      return recalculateAllDistances(updated);
    });
    markAsModified(index);
  }, [markAsModified]);

  // Handle point selection from map (no zoom, just select)
  const handlePointClick = useCallback((index) => {
    setSelectedPointIndex((prev) => (prev === index ? null : index));
  }, []);

  // Handle table cell edit - auto recalculate distances for lat/lon changes
  const handleCellEdit = useCallback((index, field, value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    setEditablePoints((prev) => {
      const updated = [...prev];
      const nextValue = field === "lat" || field === "lon" ? roundCoord6(numValue) : numValue;
      updated[index] = {
        ...updated[index],
        [field]: nextValue,
      };

      if (field === "lat" || field === "lon") {
        return recalculateAllDistances(updated);
      }

      return updated;
    });
    markAsModified(index);
  }, [markAsModified]);

  // Add new point after selected or at end - auto recalculate distances
  const handleAddPoint = useCallback(() => {
    setEditablePoints((prev) => {
      const insertIndex = selectedPointIndex !== null ? selectedPointIndex + 1 : prev.length;

      let newLat, newLon;
      if (prev.length === 0) {
        if (stopPositions.length > 0) {
          newLat = Number(stopPositions[0].lat);
          newLon = Number(stopPositions[0].lon);
        } else {
          newLat = 35.6812;
          newLon = 139.7671;
        }
      } else if (insertIndex < prev.length) {
        const curr = prev[insertIndex - 1];
        const next = prev[insertIndex];
        newLat = (Number(curr.lat) + Number(next.lat)) / 2;
        newLon = (Number(curr.lon) + Number(next.lon)) / 2;
      } else {
        const last = prev[prev.length - 1];
        newLat = Number(last.lat) + 0.0001;
        newLon = Number(last.lon) + 0.0001;
      }

      const newPoint = {
        sequence: insertIndex + 1,
        lat: roundCoord6(newLat),
        lon: roundCoord6(newLon),
        dist: 0,
        _isNew: true,
      };

      const updated = [
        ...prev.slice(0, insertIndex),
        newPoint,
        ...prev.slice(insertIndex),
      ];

      const withSequences = updated.map((p, i) => ({ ...p, sequence: i + 1 }));

      // Update modified indices - shift indices after insert point
      setModifiedIndices((prevMod) => {
        const newSet = new Set();
        prevMod.forEach((idx) => {
          if (idx >= insertIndex) {
            newSet.add(idx + 1);
          } else {
            newSet.add(idx);
          }
        });
        newSet.add(insertIndex);
        return newSet;
      });

      return recalculateAllDistances(withSequences);
    });
  }, [selectedPointIndex, stopPositions]);

  // Delete selected point - auto recalculate distances
  const handleDeletePoint = useCallback(() => {
    if (selectedPointIndex === null) return;

    setEditablePoints((prev) => {
      const updated = prev.filter((_, i) => i !== selectedPointIndex);
      const withSequences = updated.map((p, i) => ({ ...p, sequence: i + 1 }));

      // Update modified indices - shift indices after deleted point
      setModifiedIndices((prevMod) => {
        const newSet = new Set();
        prevMod.forEach((idx) => {
          if (idx < selectedPointIndex) {
            newSet.add(idx);
          } else if (idx > selectedPointIndex) {
            newSet.add(idx - 1);
          }
        });
        return newSet;
      });

      return recalculateAllDistances(withSequences);
    });
    setSelectedPointIndex(null);
  }, [selectedPointIndex]);

  // Handle row click to select/highlight AND zoom to point
  const handleRowClick = useCallback((index) => {
    setSelectedPointIndex((prev) => {
      const newIndex = prev === index ? null : index;

      // Set pending zoom flag if selecting (not deselecting)
      // The actual zoom will be triggered by useEffect after a small delay
      // This ensures marker icon update is applied before map animation starts
      if (newIndex !== null) {
        setPendingZoom(true);
      }

      return newIndex;
    });
  }, []);

  // Calculate total distance
  const totalDistance = useMemo(() => {
    if (editablePoints.length === 0) return 0;
    return editablePoints[editablePoints.length - 1].dist;
  }, [editablePoints]);

  // Count modified points
  const modifiedCount = useMemo(() => {
    return modifiedIndices.size;
  }, [modifiedIndices]);

  const buildShapesBulkBody = useCallback(() => {
    const points = Array.isArray(editablePoints) ? editablePoints : [];

    const shapes = points
      .slice()
      .sort((a, b) => Number(a.sequence) - Number(b.sequence))
      .map((point, index) => ({
        shape_id: shapeId,
        shape_pt_sequence: index + 1,
        shape_pt_lat: Number(point.lat),
        shape_pt_lon: Number(point.lon),
        shape_dist_traveled: Number(point.dist || 0),
      }))
      .filter(
        (row) =>
          row.shape_id &&
          Number.isFinite(row.shape_pt_lat) &&
          Number.isFinite(row.shape_pt_lon) &&
          Number.isFinite(row.shape_pt_sequence)
      );

    return {
      upsert: true,
      shapes,
    };
  }, [editablePoints, shapeId]);

  const handleSaveClick = useCallback(() => {
    const body = buildShapesBulkBody();
    onSave?.({
      shapePoints: editablePoints,
      body,
    });
  }, [buildShapesBulkBody, editablePoints, onSave]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: { minHeight: "80vh" },
      }}
    >
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="h6">{LABELS.route.editShapeScreen}</Typography>
          {hasModifications && (
            <Typography variant="caption" sx={{ color: "#EF5350", fontWeight: "bold" }}>
              {LABELS.route.modifiedCount(modifiedCount)}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {initializing ? (
          <Box
            sx={{
              height: "calc(80vh - 120px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
            }}
          >
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              {MESSAGES.route.loadingShapeData}
            </Typography>
          </Box>
        ) : (
          <Box display="flex" gap={3} sx={{ height: "calc(80vh - 120px)" }}>
            {/* Left side - Map and save button */}
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                {LABELS.route.patternMapHint}
              </Typography>

              <Paper sx={{ flex: 1, minHeight: 300, overflow: "hidden", position: "relative" }}>
                <MapContainer
                  center={mapCenter}
                  zoom={14}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {/* Shape polyline - render first (bottom layer) */}
                  {polylinePositions.length > 0 && (
                    <Polyline
                      positions={polylinePositions}
                      pathOptions={{ color: "#4CAF50", weight: 3 }}
                    />
                  )}

                  {/* Stop markers - render second (lower z-index) */}
                  {stopPositions.map((stop, idx) => (
                    <Marker
                      key={`stop-${stop.id}-${idx}`}
                      position={[stop.lat, stop.lon]}
                      icon={stopIcon}
                      title={stop.name}
                      zIndexOffset={0}
                    />
                  ))}

                  {/* Draggable shape point markers - render last (higher z-index, always on top) */}
                  {editablePoints.map((point, idx) => {
                    const selected = selectedPointIndex === idx;
                    const modified = isPointModified(idx);

                    return (
                      <DraggableShapePoint
                        key={`shape-point-${idx}-${selected ? "sel" : "nosel"}-${modified ? "mod" : "nomod"}`}
                        position={point}
                        index={idx}
                        onDragEnd={handleDragEnd}
                        isSelected={selected}
                        isModified={modified}
                        onClick={handlePointClick}
                      />
                    );
                  })}

                  <FitBounds positions={editablePoints} trigger={initialLoadDone} />
                  <ZoomToPoint point={selectedPoint} trigger={zoomTrigger} />
                </MapContainer>

                {/* Legend */}
                <MapLegend />
              </Paper>

              {/* Action buttons */}
              <Box display="flex" gap={1}>
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={handleSaveClick}
                  disabled={loading || !shapeId || editablePoints.length === 0}
                >
                  {BUTTONS.common.save}
                </Button>

                <Tooltip title={LABELS.common.undoAllChanges}>
                  <span>
                    <Button
                      onClick={handleReset}
                      disabled={!hasModifications || loading}
                    >
                      {BUTTONS.common.reset}
                    </Button>
                  </span>
                </Tooltip>
              </Box>
            </Box>

            {/* Right side - Shape points table (editable) */}
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
              {/* Header with description and action buttons */}
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  {LABELS.route.shapePointList}
                </Typography>

                <Box display="flex" gap={1}>
                  <Tooltip title={LABELS.route.autoGenerateShapeTooltip}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={onGenerateShape}
                      disabled={loading}
                    >
                      {BUTTONS.common.autoGenerate}
                    </Button>
                  </Tooltip>

                  <Tooltip title={LABELS.route.addPointTooltip}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleAddPoint}
                    >
                      {BUTTONS.common.add}
                    </Button>
                  </Tooltip>

                  <Tooltip title={LABELS.route.deletePointTooltip}>
                    <span>
                      <Button
                        variant="outlined"
                        size="small"
                        color="error"
                        onClick={handleDeletePoint}
                        disabled={selectedPointIndex === null}
                      >
                        {BUTTONS.common.delete}
                      </Button>
                    </span>
                  </Tooltip>
                </Box>
              </Box>

              <TableContainer component={Paper} sx={{ flex: 1, overflow: "auto" }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell align="center" sx={{ width: 100 }}>
                        <TwoLineHeader jp={LABELS.trip.stopSequence} gtfsField="shape_pt_sequence" />
                      </TableCell>
                      <TableCell align="center">
                        <TwoLineHeader jp={LABELS.stop.latitude} gtfsField="shape_pt_lat" />
                      </TableCell>
                      <TableCell align="center">
                        <TwoLineHeader jp={LABELS.stop.longitude} gtfsField="shape_pt_lon" />
                      </TableCell>
                      <TableCell align="center" sx={{ width: 130 }}>
                        <TwoLineHeader jp={LABELS.route.totalDistanceM} gtfsField="shape_dist_traveled" />
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {editablePoints.length > 0 ? (
                      editablePoints.map((point, index) => {
                        const isModified = isPointModified(index);
                        const isSelected = selectedPointIndex === index;

                        return (
                          <TableRow
                            key={index}
                            hover
                            selected={isSelected}
                            onClick={() => handleRowClick(index)}
                            sx={{
                              cursor: "pointer",
                              backgroundColor: isSelected
                                ? "rgba(25, 118, 210, 0.12)"
                                : isModified
                                  ? "rgba(239, 83, 80, 0.08)"
                                  : "inherit",
                              "&:hover": {
                                backgroundColor: isSelected
                                  ? "rgba(25, 118, 210, 0.2)"
                                  : isModified
                                    ? "rgba(239, 83, 80, 0.15)"
                                    : "rgba(0, 0, 0, 0.04)",
                              },
                            }}
                          >
                            <TableCell align="center">
                              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
                                {isModified && (
                                  <Box
                                    sx={{
                                      width: 8,
                                      height: 8,
                                      backgroundColor: "#EF5350",
                                      borderRadius: "50%",
                                    }}
                                  />
                                )}
                                {point.sequence}
                              </Box>
                            </TableCell>
                            <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                              <TextField
                                value={point.lat}
                                onChange={(e) => handleCellEdit(index, "lat", e.target.value)}
                                size="small"
                                variant="standard"
                                inputProps={{
                                  style: {
                                    textAlign: "center",
                                    color: isModified ? "#EF5350" : "inherit",
                                    fontWeight: isModified ? 600 : 400,
                                  },
                                  step: "0.000001",
                                }}
                                type="number"
                                sx={{ width: "100%" }}
                              />
                            </TableCell>
                            <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                              <TextField
                                value={point.lon}
                                onChange={(e) => handleCellEdit(index, "lon", e.target.value)}
                                size="small"
                                variant="standard"
                                inputProps={{
                                  style: {
                                    textAlign: "center",
                                    color: isModified ? "#EF5350" : "inherit",
                                    fontWeight: isModified ? 600 : 400,
                                  },
                                  step: "0.000001",
                                }}
                                type="number"
                                sx={{ width: "100%" }}
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Typography
                                variant="body2"
                                sx={{
                                  color: isModified ? "#EF5350" : "text.secondary",
                                  fontWeight: isModified ? 600 : 400,
                                }}
                              >
                                {point.dist}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography color="text.secondary">
                            {MESSAGES.common.noData}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Point count info */}
              <Box sx={{ mt: 1, display: "flex", justifyContent: "space-between" }}>
                <Typography variant="caption" color="text.secondary">
                  {LABELS.route.totalPoints(editablePoints.length)}
                  {selectedPointIndex !== null && LABELS.route.selectedPointIndex(selectedPointIndex + 1)}
                  {modifiedCount > 0 && (
                    <Typography component="span" variant="caption" sx={{ color: "#EF5350", ml: 1 }}>
                      {LABELS.route.modifiedCountBrief(modifiedCount)}
                    </Typography>
                  )}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {LABELS.route.totalDistanceKm((totalDistance / 1000).toFixed(2), totalDistance)}
                </Typography>
              </Box>
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ShapeEditModal;
