// components/visualization/route_timetable/RouteTimetableFilterPanel.jsx
import React from "react";
import {
  Box,
  Button,
  Chip,
  Collapse,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
  Checkbox,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TimeRangeSlider, { minutesToHHmmss } from "../../TimeRangeSlider";
import { directionMap } from "../../../constant/gtfs";
import ScenarioSelect from "../../shared/ScenarioSelect";
import { VISUALIZATION } from "@/strings";

// Helper to render scenario name consistently
const formLabel = (scenario) =>
  scenario?.scenario_name ||
  scenario?.name ||
  scenario?.label ||
  scenario?.id ||
  "";

// For service-id equality checks when value objects vary in shape
const resolveServiceValue = (option) => {
  if (typeof option === "string") return option;
  return option?.value || option?.id || option?.label || option?.service_id || "";
};

export default function RouteTimetableFilterPanel({
  // scenario
  scenarioOptions = [],
  loadingScenario = false,
  selectedScenario = "",
  onScenarioChange,

  // route groups
  routeGroupsOptions = [],
  selectedRouteGroups = [],
  onRouteGroupsChange,

  // grouping option: 'parent' | 'child'
  groupingOption = "parent",
  onGroupingOptionChange,

  // direction + services
  directionId = "",
  onDirectionChange,
  serviceIdOptions = [],
  selectedServiceIds = [],
  onServiceIdsChange,

  // time range in minutes [start,end]
  timeRange = [0, 24 * 60],
  onTimeRangeChange,

  // actions
  onApply, // ({..., grouping_option }) => void
  onReset, // () => void
}) {
  const [open, setOpen] = React.useState(true);

  // === validations ===
  const routeGroupError =
    Array.isArray(routeGroupsOptions) &&
    routeGroupsOptions.length > 0 &&
    (!selectedRouteGroups || selectedRouteGroups.length === 0);

  const serviceError =
    Array.isArray(serviceIdOptions) &&
    serviceIdOptions.length > 0 &&
    (!selectedServiceIds || selectedServiceIds.length === 0);

  const allLabel = VISUALIZATION.common.filters.all;
  const selectAtLeastOneText = VISUALIZATION.common.validation.selectAtLeastOne;

  const groupingLabel = `${VISUALIZATION.routeTimetable.components.filterPanel.stopChild}/${VISUALIZATION.routeTimetable.components.filterPanel.stopParent}`;

  // === "All" option handling for Route Groups ===
  const ALL_OPTION = React.useMemo(
    () => ({ route_group_id: "__ALL__", route_group_name: allLabel, __all: true }),
    [allLabel]
  );
  const routeOptionsWithAll = React.useMemo(
    () => [ALL_OPTION, ...(routeGroupsOptions || [])],
    [routeGroupsOptions, ALL_OPTION]
  );
  const allRouteSelected =
    (selectedRouteGroups?.length || 0) > 0 &&
    (routeGroupsOptions?.length || 0) > 0 &&
    selectedRouteGroups.length === routeGroupsOptions.length;

  // === handlers ===
  const handleServiceChange = (_, values) => onServiceIdsChange?.(values);

  const handleApply = () => {
    if (routeGroupError || serviceError) return;
    const startTime = minutesToHHmmss(timeRange[0]);
    const endTime = minutesToHHmmss(timeRange[1], { isEnd: true });
    onApply?.({
      scenario_id: selectedScenario,
      start_time: startTime,
      end_time: endTime,
      direction_id: directionId,
      // pass raw arrays; parent can serialize to CSV
      service_ids: selectedServiceIds,
      route_groups: selectedRouteGroups,
      // NEW: expose grouping option so parent can set is_using_parent_stop
      grouping_option: groupingOption, // 'parent' => is_using_parent_stop=true ; 'child' => false
    });
  };

  const handleReset = () => {
    onReset?.();
  };

  return (
    <Paper elevation={0} sx={{ p: 2, bgcolor: "transparent" }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: open ? 2 : 0,
        }}
      >
        <Typography variant="h6" fontWeight={700}>
          {VISUALIZATION.routeTimetable.components.filterPanel.title}
        </Typography>
        <IconButton size="small" onClick={() => setOpen((prev) => !prev)}>
          {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      <Collapse in={open}>
        <Stack spacing={2}>
          {/* Scenario */}
          <ScenarioSelect
            scenarioOptions={scenarioOptions}
            selectedScenario={selectedScenario}
            onScenarioChange={onScenarioChange}
            loadingScenario={loadingScenario}
            fullWidth
            size="small"
            labelId="route-timetable-scenario-label"
            shrinkLabel
            displayEmpty
            placeholderWhenEmpty={VISUALIZATION.routeTimetable.components.filterPanel.scenarioPlaceholder}
            renderValueOverride={(value, options) => {
              if (value === "") return VISUALIZATION.routeTimetable.components.filterPanel.scenarioPlaceholder;
              const opt = options.find((item) => String(item.id) === String(value));
              if (!opt) return VISUALIZATION.routeTimetable.components.filterPanel.scenarioPlaceholder;
              return formLabel(opt) || VISUALIZATION.routeTimetable.components.filterPanel.scenarioPlaceholder;
            }}
            sourceLabelRequiresProject={true}
          />


          {/* Grouping Option */}
          <FormControl fullWidth size="small">
            <InputLabel shrink>{groupingLabel}</InputLabel>
            <Select
              label={groupingLabel}
              value={groupingOption}
              onChange={(e) => onGroupingOptionChange?.(e.target.value)}
            >
              <MenuItem value="child">{VISUALIZATION.routeTimetable.components.filterPanel.stopChild}</MenuItem>
              <MenuItem value="parent">{VISUALIZATION.routeTimetable.components.filterPanel.stopParent}</MenuItem>
            </Select>
          </FormControl>


          {/* Route Groups (multi, with "All") */}
          <Autocomplete
            multiple
            disableCloseOnSelect
            options={routeOptionsWithAll}
            value={selectedRouteGroups}
            onChange={(_, nv) => {
              const pickedAll = nv?.some((o) => o?.__all || o?.route_group_id === "__ALL__");
              if (pickedAll) {
                if (allRouteSelected) {
                  onRouteGroupsChange?.([]);
                } else {
                  onRouteGroupsChange?.(routeGroupsOptions || []);
                }
                return;
              }
              onRouteGroupsChange?.(nv || []);
            }}
            getOptionLabel={(opt) => (opt?.__all ? allLabel : opt?.route_group_name || "")}
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
                    <Box
                      sx={{
                        bgcolor: opt.color || "#ccc",
                        width: 16,
                        height: 16,
                        borderRadius: 1,
                        display: "inline-block",
                        mr: 1,
                        border: "1px solid #ccc",
                      }}
                    />
                  )}
                  {isAll ? allLabel : opt.route_group_name}
                </li>
              );
            }}
            renderTags={(value, getTagProps) => {
              if (allRouteSelected) {
                return [
                  <Box
                    key="rg-all"
                    sx={{
                      fontSize: "0.9rem",
                      fontWeight: 500,
                      color: "text.primary",
                      display: "inline-flex",
                      alignItems: "center",
                      height: 28,
                      px: 1,
                    }}
                  >
                    {allLabel}
                  </Box>,
                ];
              }
              return value.map((opt, index) => (
                <Chip
                  {...getTagProps({ index })}
                  label={opt?.route_group_name || ""}
                  size="small"
                />
              ));
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label={VISUALIZATION.busRunningVisualization.components.filterPanel.routeLabel}
                error={routeGroupError}
                helperText={routeGroupError ? selectAtLeastOneText : ""}
              />
            )}
          />

      
          {/* Time Range */}
          <TimeRangeSlider value={timeRange} onChange={onTimeRangeChange} />

          {/* Direction + Service */}
          <Stack direction="row" spacing={2}>
            <FormControl fullWidth size="small">
              {/* Force-shrink to prevent label overlapping the placeholder */}
              <InputLabel id="route-timetable-direction-label" shrink>
                {VISUALIZATION.routeTimetable.components.filterPanel.direction}
              </InputLabel>
              <Select
                labelId="route-timetable-direction-label"
                label={VISUALIZATION.routeTimetable.components.filterPanel.direction}
                value={directionId}
                onChange={(e) => onDirectionChange?.(e.target.value)}
                displayEmpty
                renderValue={(value) => {
                  if (value === "") return allLabel;
                  if (value === "1") return directionMap.inbound;
                  if (value === "0") return directionMap.outbound;
                  return allLabel;
                }}
              >
                <MenuItem value="">
                  <em>{allLabel}</em>
                </MenuItem>
                <MenuItem value="1">{directionMap.inbound}</MenuItem>
                <MenuItem value="0">{directionMap.outbound}</MenuItem>
              </Select>
            </FormControl>

            <Autocomplete
              multiple
              disableCloseOnSelect
              size="small"
              options={serviceIdOptions}
              value={selectedServiceIds}
              onChange={handleServiceChange}
              fullWidth
              getOptionLabel={(opt) =>
                typeof opt === "string" ? opt : opt?.label || opt?.value || ""
              }
              isOptionEqualToValue={(opt, val) => resolveServiceValue(opt) === resolveServiceValue(val)}
              renderOption={(props, option, { selected }) => (
                <li {...props}>
                  <Checkbox sx={{ mr: 1 }} checked={selected} size="small" />
                  {typeof option === "string" ? option : option?.label || option?.value}
                </li>
              )}
              renderTags={(value, getTagProps) => {
                const showAll = value.length === serviceIdOptions.length && value.length > 0;
                if (showAll) {
                  return [
                    <Box
                      key="service-all"
                      sx={{
                        fontSize: "0.9rem",
                        fontWeight: 500,
                        color: "text.primary",
                        display: "inline-flex",
                        alignItems: "center",
                        height: 28,
                      px: 1,
                    }}
                  >
                      {allLabel}
                    </Box>,
                  ];
                }
                return value.map((opt, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    label={typeof opt === "string" ? opt : opt?.label || opt?.value || ""}
                    size="small"
                  />
                ));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={VISUALIZATION.busRunningVisualization.components.filterPanel.travelDayLabel}
                  error={serviceError}
                  helperText={serviceError ? selectAtLeastOneText : ""}
                />
              )}
            />
          </Stack>

          {/* Buttons */}
          <Stack direction="row" spacing={2} sx={{ pt: 1 }}>
            <Button variant="outlined" color="primary" onClick={handleReset} sx={{ flex: 1 }}>
              {VISUALIZATION.busRunningVisualization.components.filterPanel.buttons.reset}
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleApply}
              sx={{ flex: 1 }}
              disabled={routeGroupError || serviceError}
            >
              {VISUALIZATION.busRunningVisualization.components.filterPanel.buttons.calculate}
            </Button>
          </Stack>
        </Stack>
      </Collapse>
    </Paper>
  );
}
