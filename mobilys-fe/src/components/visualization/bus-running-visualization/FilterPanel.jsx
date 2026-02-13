// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import {
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Collapse,
  Paper,
  Stack,
  Checkbox,
  Button,
  Chip,
} from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Autocomplete from "@mui/material/Autocomplete";
import { directionMap } from "../../../constant/gtfs";
import TimeRangeSlider, { minutesToHHmmss } from "../../TimeRangeSlider";
import ScenarioSelect from "../../shared/ScenarioSelect";
import { VISUALIZATION } from "@/strings";

function FilterPanel({
  scenarioOptions = [],
  routeGroupsOptions = [],
  loadingScenario = false,
  selectedScenario,
  onScenarioChange,
  selectedRouteGroups = [],
  onRouteGroupsChange,
  onApplyFilter,
  serviceIdOptions = [],
  selectedServiceId = [],
  onServiceIdChange = () => {},
  groupingOption = "",
  onGroupingOptionChange = () => {},
  onResetFilter,
}) {
  const [open, setOpen] = React.useState(true);

  const [timeRange, setTimeRange] = React.useState([0, 24 * 60]);
  const [directionId, setDirectionId] = React.useState(""); // Empty string means "all"

  React.useEffect(() => {
    if (scenarioOptions.length > 0 && !selectedScenario) {
      onScenarioChange(scenarioOptions[0].id);
    }
    // eslint-disable-next-line
  }, [scenarioOptions]);

  React.useEffect(() => {
    if (routeGroupsOptions?.length) {
      onRouteGroupsChange(routeGroupsOptions);
    }
    // eslint-disable-next-line
  }, [routeGroupsOptions]);

  // Default: select the first service
  React.useEffect(() => {
    if (serviceIdOptions?.length && (!selectedServiceId || selectedServiceId.length === 0)) {
      onServiceIdChange([serviceIdOptions[0]]);
    }
    // eslint-disable-next-line
  }, [serviceIdOptions]);

  // === Validation: must select at least 1 ===
  const routeGroupError =
    Array.isArray(selectedRouteGroups) &&
    selectedRouteGroups.length === 0 &&
    (routeGroupsOptions?.length ?? 0) > 0;

  const serviceError =
    Array.isArray(selectedServiceId) &&
    selectedServiceId.length === 0 &&
    (serviceIdOptions?.length ?? 0) > 0;

  const handleApplyFilter = () => {
    if (routeGroupError || serviceError) return; 
    onApplyFilter({
      startTime: minutesToHHmmss(timeRange[0]),
      endTime: minutesToHHmmss(timeRange[1], { isEnd: true }),
      directionId: directionId,
      serviceId: selectedServiceId,
      scenarioId: selectedScenario,
      selectedRouteGroups,
      groupingOption,
    });
  };

  const handleLocalReset = () => {
    setTimeRange([0, 24 * 60]);
    setDirectionId("");
    onServiceIdChange([]);     
    onRouteGroupsChange([]);   
    if (onResetFilter) onResetFilter();
  };

  const ALL_OPTION = React.useMemo(
    () => ({
      route_group_id: "__ALL__",
      route_group_name: VISUALIZATION.common.filters.all,
      __all: true,
    }),
    []
  );
  const routeOptionsWithAll = React.useMemo(
    () => [ALL_OPTION, ...(routeGroupsOptions || [])],
    [routeGroupsOptions]
  );
  const allRouteSelected =
    (selectedRouteGroups?.length || 0) > 0 &&
    (routeGroupsOptions?.length || 0) > 0 &&
    selectedRouteGroups.length === routeGroupsOptions.length;


  return (
    <Paper elevation={0} sx={{ p: 2, bgcolor: "transparent" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: open ? 2 : 0 }}>
        <Typography variant="h6" fontWeight={700}>
          {VISUALIZATION.busRunningVisualization.components.filterPanel.title}
        </Typography>
        <IconButton size="small" onClick={() => setOpen(v => !v)}>
          {open ? <ExpandLessIcon/> : <ExpandMoreIcon/>}
        </IconButton>
      </Box>

      <Collapse in={open}>
        {/* Scenario */}
        <ScenarioSelect
          scenarioOptions={scenarioOptions}
          selectedScenario={selectedScenario}
          onScenarioChange={onScenarioChange}
          sourceLabelRequiresProject={true} 
        />

        {/* Grouping Option */}
        <FormControl fullWidth margin="normal">
          <InputLabel>
            {VISUALIZATION.busRunningVisualization.components.filterPanel.stopType}
          </InputLabel>
          <Select
            label={VISUALIZATION.busRunningVisualization.components.filterPanel.stopType}
            value={groupingOption}
            onChange={(e) => onGroupingOptionChange(e.target.value)}
          >
            <MenuItem value="child">
              {VISUALIZATION.busRunningVisualization.components.filterPanel.stopTypeOptions.child}
            </MenuItem>
            <MenuItem value="parent">
              {VISUALIZATION.busRunningVisualization.components.filterPanel.stopTypeOptions.parent}
            </MenuItem>
          </Select>
        </FormControl>

      {/* Route Groups */}
      <Autocomplete
        multiple
        disableCloseOnSelect
        options={routeOptionsWithAll}
        value={selectedRouteGroups}
        onChange={(_, nv) => {
          const pickedAll = nv?.some(o => o?.__all || o?.route_group_id === "__ALL__");
          if (pickedAll) {
            if (allRouteSelected) {
              onRouteGroupsChange([]);
            } else {
              onRouteGroupsChange(routeGroupsOptions || []);
            }
            return;
          }
          onRouteGroupsChange(nv || []);
        }}
        getOptionLabel={(opt) =>
          opt?.__all ? VISUALIZATION.common.filters.all : opt?.route_group_name
        }
        isOptionEqualToValue={(opt, val) =>
          (opt?.__all || val?.__all) ? false : opt.route_group_id === val.route_group_id
        }
        renderOption={(props, opt, { selected }) => {
          const isAll = !!opt?.__all;
          const checked = isAll ? allRouteSelected : selected;
          return (
            <li {...props}>
              <Checkbox checked={checked} sx={{ mr: 1 }} />
              {!isAll && (
                <Box sx={{
                  bgcolor: opt.color || "#ccc",
                  width: 16, height: 16, borderRadius: 1,
                  display: "inline-block", mr: 1, border: "1px solid #ccc",
                }}/>
              )}
              {isAll ? VISUALIZATION.common.filters.all : opt.route_group_name}
            </li>
          );
        }}
        renderTags={(value, getTagProps) => {
          if (allRouteSelected) {
            return [
              <Box
                key="rg-all"
                sx={{
                  fontSize: "1rem",
                  fontWeight: 400,
                  color: "text.primary",
                  display: "inline-flex",
                  alignItems: "center",
                  height: 32,
                  px: 0.75,
                }}
              >
                {VISUALIZATION.common.filters.all}
              </Box>,
            ];
          }
          return value.map((opt, i) => (
            <Chip {...getTagProps({ index: i })} label={opt.route_group_name} size="small" />
          ));
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={VISUALIZATION.busRunningVisualization.components.filterPanel.routeLabel}
            margin="normal"
            fullWidth
            error={routeGroupError}
            helperText={
              routeGroupError
                ? (VISUALIZATION.busRunningVisualization.components.filterPanel.errors
                    ?.routeGroupsRequired ??
                    VISUALIZATION.busRunningVisualization.components.filterPanel.travelDayHelper)
                : ""
            }
          />
        )}
      />

        {/* Time range */}
        <TimeRangeSlider value={timeRange} onChange={setTimeRange} />

        {/* Direction & Service */}
        <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mt: 2 }}>
          <FormControl fullWidth>
            <InputLabel id="direction-select-label" shrink>
              {VISUALIZATION.busRunningVisualization.components.filterPanel.direction}
            </InputLabel>
            <Select
              labelId="direction-select-label"
              id="direction-select"
              label={VISUALIZATION.busRunningVisualization.components.filterPanel.direction}
              value={directionId}
              onChange={(e) => setDirectionId(e.target.value)}
              displayEmpty
              renderValue={(selected) => {
                if (selected === "") return VISUALIZATION.common.filters.all;
                if (selected === "1") return directionMap.inbound;
                if (selected === "0") return directionMap.outbound;
                return VISUALIZATION.common.filters.all;
              }}
            >
              <MenuItem value="">
                {/* ALL */}
                {VISUALIZATION.common.filters.all}
              </MenuItem>
              <MenuItem value="1">{directionMap.inbound}</MenuItem>
              <MenuItem value="0">{directionMap.outbound}</MenuItem>
            </Select>
          </FormControl>

          <Autocomplete
            multiple
            disableCloseOnSelect
            fullWidth
            options={serviceIdOptions}
            value={selectedServiceId}
            onChange={(_, nv) => onServiceIdChange(nv)}
            getOptionLabel={(opt) =>
              typeof opt === "string" ? opt : opt.label || opt.value || ""
            }
            isOptionEqualToValue={(opt, val) => opt === val}
            renderOption={(props, opt, { selected }) => (
              <li {...props}>
                <Checkbox checked={selected} sx={{ mr: 1 }} />
                {typeof opt === "string" ? opt : opt.label || opt.value}
              </li>
            )}
            renderTags={(value, getTagProps) => {
              const allSelected = value.length === serviceIdOptions.length && value.length > 0;
              if (allSelected) {
                return [
                  <Box
                    key="svc-all"
                    sx={{
                      fontSize: "1rem",
                      fontWeight: 400,
                      color: "text.primary",
                      display: "inline-flex",
                      alignItems: "center",
                      height: 32,
                      px: 0.75,
                    }}
                  >
                    {VISUALIZATION.common.filters.all}
                  </Box>,
                ];
              }
              return value.map((opt, i) => (
                <Chip
                  {...getTagProps({ index: i })}
                  label={typeof opt === "string" ? opt : opt.label || opt.value}
                  size="small"
                />
              ));
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label={VISUALIZATION.busRunningVisualization.components.filterPanel.travelDayLabel}
                margin="none"
                fullWidth
                error={serviceError}
                helperText={
                  serviceError
                    ? (VISUALIZATION.busRunningVisualization.components.filterPanel.errors
                        ?.serviceRequired ??
                        VISUALIZATION.busRunningVisualization.components.filterPanel.travelDayHelper)
                    : ""
                }
              />
            )}
          />
        </Stack>

        {/* Buttons */}
        <Box sx={{ mt: 3, display: "flex", gap: 2 }}>
          <Button
            variant="outlined"
            fullWidth
            size="large"
            sx={{ py: 1.5 }}
            onClick={handleLocalReset}
          >
            {VISUALIZATION.busRunningVisualization.components.filterPanel.buttons.reset}
          </Button>
          <Button
            variant="contained"
            fullWidth
            size="large"
            sx={{ py: 1.5 }}
            onClick={handleApplyFilter}
            disabled={routeGroupError || serviceError}
          >
            {VISUALIZATION.busRunningVisualization.components.filterPanel.buttons.calculate}
          </Button>
        </Box>
      </Collapse>
    </Paper>
  );
}

export default FilterPanel;
