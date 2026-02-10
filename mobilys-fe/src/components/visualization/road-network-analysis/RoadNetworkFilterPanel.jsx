import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Collapse,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import { useLocation } from "react-router-dom";
import ScenarioSelect from "../../shared/ScenarioSelect";
import { VISUALIZATION } from "@/strings";
import { VALIDATION } from "@/constant/validation";

const DEFAULTS = VALIDATION.VISUALIZATION_DEFAULTS;

export default function RoadNetworkFilterPanel({
  scenarioOptions = [],
  selectedScenario,
  onScenarioChange,

  coords = { lat: "", lng: "" },
  onCoordsChange,

  date = "",
  onDateChange,

  time = "",
  onTimeChange,

  maxwalkingdistance = 0,
  onMaxWalkingDistanceChange,

  speed = "",
  onSpeedChange,

  setConfirmOpen,
  graphStatus,
  graphStatusUpdatedAt,
  onRefreshGraphStatus,
  onHandleGenerateBuffer,
  onReset,
  prefAvail = { ok: true, missing: [], needed: [], available: [], graphType: "drm" },
  prefAvailLoading = false,
}) {
  const strings = VISUALIZATION.roadNetworkAnalysisOsm.components.filterPanel;
  const [open, setOpen] = useState(true);

  const disabledByStatus = graphStatus === "rebuilding" || graphStatus === "building";
  const disabledByPref = !prefAvail?.ok;
  const buildDisabled = disabledByStatus || disabledByPref || prefAvailLoading;

  const isBuiltOrRebuilt =
    graphStatus === "built" ||
    graphStatus === "rebuilt" ||
    graphStatus === "rebuilding";

  const buildLabel = isBuiltOrRebuilt ? strings.actions.rebuild : strings.actions.build;
  const buildVariant = isBuiltOrRebuilt ? "outlined" : "contained";

  const location = useLocation();
  const scenarioIdFromUrl = useMemo(() => {
    return location.search ? location.search.substring(1) : "";
  }, [location.search]);

  const selectedScenarioObj = useMemo(() => {
    if (!selectedScenario) return null;
    if (typeof selectedScenario === "object") return selectedScenario;
    return scenarioOptions.find((option) => option.id === selectedScenario) || null;
  }, [selectedScenario, scenarioOptions]);

  const scenarioStartDate = selectedScenarioObj?.start_date || "";
  const scenarioEndDate = selectedScenarioObj?.end_date || "";

  const dateInputProps = useMemo(() => {
    const props = {};
    if (scenarioStartDate) props.min = scenarioStartDate;
    if (scenarioEndDate) props.max = scenarioEndDate;
    return props;
  }, [scenarioStartDate, scenarioEndDate]);

  const enforceDateBounds = useCallback(
    (rawValue) => {
      if (!rawValue) return rawValue;
      let nextValue = rawValue;
      if (scenarioStartDate && nextValue < scenarioStartDate) nextValue = scenarioStartDate;
      if (scenarioEndDate && nextValue > scenarioEndDate) nextValue = scenarioEndDate;
      return nextValue;
    },
    [scenarioStartDate, scenarioEndDate],
  );

  const handleDateChange = useCallback(
    (value) => {
      const boundedValue = enforceDateBounds(value);
      onDateChange(boundedValue);
    },
    [enforceDateBounds, onDateChange],
  );

  useEffect(() => {
    if (scenarioIdFromUrl) onScenarioChange(scenarioIdFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioIdFromUrl]);

  const isBuilding = graphStatus === "building" || graphStatus === "rebuilding";
  const updatedAt = graphStatusUpdatedAt ?? 0;
  const isStale =
    isBuilding &&
    Date.now() - updatedAt > (DEFAULTS.roadNetwork.graphBuildStatusStaleMs ?? 120_000);

  const maxWalkingDistanceOptions =
    DEFAULTS.roadNetwork.maxWalkingDistanceOptionsM ?? [300, 500, 800, 1000, 1500, 2000];

  const maxWalkingDistanceValue =
    maxwalkingdistance || DEFAULTS.roadNetwork.maxWalkingDistanceM || 800;

  const speedValue = String(speed || DEFAULTS.walkingSpeedKmh || "");

  const prefMissing = Array.isArray(prefAvail?.missing) ? prefAvail.missing : [];

  return (
    <Box elevation={1} sx={{ p: 2, borderRadius: 2, mb: 2 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: open ? 2 : 0,
        }}
      >
        <Typography variant="subtitle1" fontWeight={600}>
          {strings.title}
        </Typography>
        <IconButton size="small" onClick={() => setOpen((o) => !o)}>
          {open ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Box>

      <Collapse in={open}>
        <ScenarioSelect
          scenarioOptions={scenarioOptions}
          selectedScenario={selectedScenario}
          onScenarioChange={onScenarioChange}
          formControlSx={{ mb: 2 }}
          sourceLabelRequiresProject={true}
        />

        <Button
          variant={buildVariant}
          color="primary"
          onClick={() => setConfirmOpen(true)}
          disabled={buildDisabled}
          fullWidth
          sx={{ mb: 1 }}
        >
          {buildLabel}
        </Button>

        {prefAvailLoading ? (
          <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
            {strings.messages.checkingBaseData}
          </Typography>
        ) : disabledByPref && prefMissing.length ? (
          <Typography variant="body2" sx={{ mb: 2 }} color="error">
            {strings.messages.prefectureMissingPrefix}
            {prefMissing.join(", ")}
            {strings.messages.prefectureMissingSuffix}
          </Typography>
        ) : null}

        <Typography variant="body2" sx={{ mb: 1, color: "text.secondary" }}>
          {strings.labels.origin}
        </Typography>
        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
          <TextField
            label={strings.labels.lat}
            type="number"
            fullWidth
            value={coords.lat}
            onChange={(e) => onCoordsChange({ ...coords, lat: e.target.value })}
            placeholder="ex: 36.754306"
            InputLabelProps={{ shrink: true }}
            inputProps={{ step: "any" }}
          />
          <TextField
            label={strings.labels.lng}
            type="number"
            fullWidth
            value={coords.lng}
            onChange={(e) => onCoordsChange({ ...coords, lng: e.target.value })}
            placeholder="ex: 139.728255"
            InputLabelProps={{ shrink: true }}
            inputProps={{ step: "any" }}
          />
        </Box>

        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
          <TextField
            label={strings.labels.date}
            type="date"
            fullWidth
            InputLabelProps={{ shrink: true }}
            value={date}
            inputProps={dateInputProps}
            onChange={(e) => handleDateChange(e.target.value)}
          />
          <TextField
            label={strings.labels.departureTime}
            type="time"
            fullWidth
            InputLabelProps={{ shrink: true }}
            value={time}
            onChange={(e) => onTimeChange(e.target.value)}
          />
        </Box>

        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField
            label={strings.labels.maxWalkingDistanceM}
            select
            fullWidth
            value={maxWalkingDistanceValue}
            onChange={(e) => onMaxWalkingDistanceChange(e.target.value)}
          >
            {maxWalkingDistanceOptions.map((distance) => (
              <MenuItem key={distance} value={distance}>
                {distance}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label={strings.labels.walkingSpeedKmh}
            type="text"
            inputMode="decimal"
            fullWidth
            value={speedValue}
            onChange={(e) => {
              const v = e.target.value.replace(",", ".");
              onSpeedChange(v);
            }}
            InputLabelProps={{ shrink: true }}
          />
        </Box>

        <Box sx={{ mt: 3, display: "flex", gap: 2 }}>
          {onReset && (
            <Button
              variant="outlined"
              fullWidth
              size="large"
              sx={{ py: 1.5 }}
              onClick={onReset}
            >
              {strings.actions.reset}
            </Button>
          )}
          {onHandleGenerateBuffer && (
            <Button
              sx={{ py: 1.5 }}
              variant="contained"
              color="primary"
              size="large"
              onClick={onHandleGenerateBuffer}
              fullWidth
              disabled={
                graphStatus === "pending" ||
                graphStatus === "building" ||
                graphStatus === "rebuilding" ||
                graphStatus === "failed" ||
                graphStatus === "rebuild_failed"
              }
            >
              {strings.actions.calculate}
            </Button>
          )}
        </Box>

        {(graphStatus === "building" || graphStatus === "rebuilding") && !isStale && (
          <Box sx={{ width: "100%", pt: 2 }}>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
              {strings.messages.building}
            </Typography>
            <CircularProgress size={20} />
          </Box>
        )}

        {isStale && (
          <Box sx={{ width: "100%", pt: 2 }}>
            <Typography
              variant="body2"
              sx={{ mb: 1, fontWeight: 500 }}
              color="warning.main"
            >
              {strings.messages.statusStale}
            </Typography>
            <Button variant="outlined" onClick={onRefreshGraphStatus}>
              {strings.actions.refreshStatus}
            </Button>
          </Box>
        )}
      </Collapse>
    </Box>
  );
}

