// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import PropTypes from "prop-types";
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";

function ScenarioSelect({
  scenarioOptions,
  selectedScenario,
  onScenarioChange,
  loadingScenario = false,

  // Label related
  label = "シナリオ",
  labelId = "scenario-label",
  shrinkLabel = false,

  // FormControl layout
  fullWidth = true,
  margin = "normal",
  formControlSx,
  size = "medium",

  // Behavior
  // If true, selected value only shows scenario_name (or custom label)
  showOnlyNameInValue = true,
  // If false, hide the right-side source label entirely
  showSourceLabel = true,
  // If true, show source label only when project_name is not null
  sourceLabelRequiresProject = false,

  // Placeholder / empty value behavior
  displayEmpty = false,
  placeholderWhenEmpty = "",

  // Advanced customization
  // Custom renderValue: (value, scenarioOptions) => ReactNode
  renderValueOverride,
  // Custom option label builder: (opt) => string
  getOptionLabel,

  // Extra flags
  disabled = false,
  // Message when scenarioOptions is empty
  noOptionsText,

  onOpen,
  onClose,
  placeholderMenuItem,
}) {
  const getSourceLabel = (source) => {
    const raw = source || "—";
    if (!source) return raw;
    return String(source).toLowerCase() === "owned scenario" ? "自分" : raw;
  };

  const findOptionById = (id) => {
    return scenarioOptions.find((x) => String(x.id) === String(id));
  };

  const defaultGetOptionLabel = (opt) => (opt ? opt.scenario_name : "");

  const handleRenderValue = (selectedId) => {
    // Highest priority: custom renderValue from parent
    if (typeof renderValueOverride === "function") {
      return renderValueOverride(selectedId, scenarioOptions);
    }

    // Placeholder when empty
    if (
      displayEmpty &&
      (selectedId === "" || selectedId === null || typeof selectedId === "undefined")
    ) {
      return placeholderWhenEmpty || "";
    }

    const opt = findOptionById(selectedId);
    if (!opt) return "";

    const labelText =
      typeof getOptionLabel === "function"
        ? getOptionLabel(opt)
        : defaultGetOptionLabel(opt);

    return labelText;
  };

  const shouldUseRenderValue =
    showOnlyNameInValue || renderValueOverride || displayEmpty;

  const formControlDisabled = disabled || loadingScenario;

  return (
    <FormControl
      fullWidth={fullWidth}
      margin={margin}
      disabled={formControlDisabled}
      sx={formControlSx}
      size={size}
    >
      <InputLabel id={labelId} shrink={shrinkLabel ? true : undefined} >
        {label}
      </InputLabel>
      <Select
        labelId={labelId}
        label={label}
        value={selectedScenario ?? ""}
        onChange={(e) => onScenarioChange && onScenarioChange(e.target.value)}
        displayEmpty={displayEmpty}
        renderValue={
          shouldUseRenderValue
            ? (selected) => handleRenderValue(selected)
            : undefined
        }
        onOpen={onOpen}
        onClose={onClose}
      >

        {displayEmpty && placeholderMenuItem && (
          <MenuItem disabled value="">
            {placeholderMenuItem}
          </MenuItem>
        )}
        
        {scenarioOptions.length === 0 && noOptionsText ? (
          <MenuItem value="" disabled>
            {noOptionsText}
          </MenuItem>
        ) : (
          scenarioOptions.map((opt) => {
            const rawSource = opt.scenario_source || "—";
            const sourceLabel = getSourceLabel(opt.scenario_source);

            const shouldShowSource =
              showSourceLabel &&
              (!sourceLabelRequiresProject || opt.project_name != null);

            return (
              <MenuItem key={opt.id} value={opt.id}>
                <Box sx={{ display: "flex", alignItems: "center", width: "100%" }}>
                  <Typography noWrap>{opt.scenario_name}</Typography>
                  {shouldShowSource && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ ml: "auto" }}
                      noWrap
                      title={rawSource}
                    >
                      {sourceLabel}
                    </Typography>
                  )}
                </Box>
              </MenuItem>
            );
          })
        )}
      </Select>
    </FormControl>
  );
}

ScenarioSelect.propTypes = {
  scenarioOptions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      scenario_name: PropTypes.string.isRequired,
      scenario_source: PropTypes.string,
      project_name: PropTypes.string,
    })
  ).isRequired,
  selectedScenario: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.oneOf([null]),
  ]),
  onScenarioChange: PropTypes.func,
  loadingScenario: PropTypes.bool,
  label: PropTypes.string,
  labelId: PropTypes.string,
  shrinkLabel: PropTypes.bool,
  fullWidth: PropTypes.bool,
  margin: PropTypes.oneOf(["none", "dense", "normal"]),
  formControlSx: PropTypes.object,
  size: PropTypes.oneOf(["small", "medium"]),
  showOnlyNameInValue: PropTypes.bool,
  showSourceLabel: PropTypes.bool,
  sourceLabelRequiresProject: PropTypes.bool,
  displayEmpty: PropTypes.bool,
  placeholderWhenEmpty: PropTypes.string,
  renderValueOverride: PropTypes.func,
  getOptionLabel: PropTypes.func,
  disabled: PropTypes.bool,
  noOptionsText: PropTypes.string,
  onOpen: PropTypes.func,
  onClose: PropTypes.func,
  placeholderMenuItem: PropTypes.node,
};

export default ScenarioSelect;
