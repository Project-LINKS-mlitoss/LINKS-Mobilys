// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React, { useMemo, useCallback } from "react";
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  IconButton,
  Collapse,
  Button,
} from "@mui/material";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import ScenarioSelect from "../../shared/ScenarioSelect";
import { VISUALIZATION } from "@/strings";

export default function BufferAnalysisFilterPanel({
  scenarioOptions = [],
  selectedScenario,
  onScenarioChange,

  coords = { lat: "", lng: "" },
  onCoordsChange,

  date = "",
  onDateChange,

  time = "",
  onTimeChange,


  speed = "",
  onSpeedChange,

  //fp004
  onCalculate,
  onReset,
}) {
  const [open, setOpen] = React.useState(true);

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
      if (scenarioStartDate && nextValue < scenarioStartDate) {
        nextValue = scenarioStartDate;
      }
      if (scenarioEndDate && nextValue > scenarioEndDate) {
        nextValue = scenarioEndDate;
      }
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

  return (
    <Box elevation={1} sx={{ p: 2, borderRadius: 2, mb: 2 }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: open ? 2 : 0,
        }}>
        <Typography variant="subtitle1" fontWeight={600}>
          {VISUALIZATION.bufferAnalysis.components.filterPanel.title}
        </Typography>
        <IconButton size="small" onClick={() => setOpen((o) => !o)}>
          {open ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Box>

      <Collapse in={open}>
        {/* Scenario */}
        <ScenarioSelect
          scenarioOptions={scenarioOptions}
          selectedScenario={selectedScenario}
          onScenarioChange={onScenarioChange}
          formControlSx={{ mb: 2 }}
          sourceLabelRequiresProject={true} 
        />
        {/* Origin */}
        <Typography variant="body2" sx={{ mb: 1, color: "text.secondary" }}>
          {VISUALIZATION.bufferAnalysis.components.filterPanel.origin.title}
        </Typography>
        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
          <TextField
            label={VISUALIZATION.bufferAnalysis.components.filterPanel.origin.latitude}
            type="number"
            fullWidth
            value={coords.lat}
            onChange={(e) => onCoordsChange({ ...coords, lat: e.target.value })}
            placeholder="ex: 36.754306"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label={VISUALIZATION.bufferAnalysis.components.filterPanel.origin.longitude}
            type="number"
            fullWidth
            value={coords.lng}
            onChange={(e) => onCoordsChange({ ...coords, lng: e.target.value })}
            placeholder="ex: 139.728255"
            InputLabelProps={{ shrink: true }}
          />
        </Box>

        {/* Date & departure time */}
        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
          <TextField
            label={VISUALIZATION.bufferAnalysis.components.filterPanel.date}
            type="date"
            fullWidth
            InputLabelProps={{ shrink: true }}
            value={date}
            inputProps={dateInputProps}
            onChange={(e) => handleDateChange(e.target.value)}
          />
          <TextField
            label={VISUALIZATION.bufferAnalysis.components.filterPanel.departureTime}
            type="time"
            fullWidth
            InputLabelProps={{ shrink: true }}
            value={time}
            onChange={(e) => onTimeChange(e.target.value)}
          />
        </Box>

				{/* Walking speed */}
				<Box sx={{ display: "flex", gap: 1 }}>
					<TextField
            label={VISUALIZATION.bufferAnalysis.components.filterPanel.walkingSpeed}
            type='text'       
            inputMode='decimal'
            fullWidth
            value={String(speed)}               
            onChange={(e) => {
              const v = e.target.value.replace(',', '.');
              onSpeedChange(v);
            }}
            InputLabelProps={{ shrink: true }}
          />
				</Box>

        {/* Actions */}
        <Box sx={{ mt: 3, display: "flex", gap: 2 }}>
          <Button
            variant="outlined"
            fullWidth
            size="large"
            sx={{ py: 1.5 }}
            onClick={onReset}
          >
            {VISUALIZATION.bufferAnalysis.components.filterPanel.actions.reset}
          </Button>
          <Button
            variant="contained"
            fullWidth
            size="large"
            sx={{ py: 1.5 }}
            onClick={onCalculate}
            disabled={
                isNaN(parseFloat(coords.lat)) ||
                isNaN(parseFloat(coords.lng)) ||
                !date ||
                !time ||
                !speed
            }
          >
            {VISUALIZATION.bufferAnalysis.components.filterPanel.actions.calculate}
          </Button>
        </Box>
      </Collapse>
    </Box>
  );
}
