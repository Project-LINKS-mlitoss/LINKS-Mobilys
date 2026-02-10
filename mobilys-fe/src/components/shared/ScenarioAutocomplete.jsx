import PropTypes from "prop-types";
import { Autocomplete, TextField, Box, Typography } from "@mui/material";

function ScenarioAutocomplete({
  options,
  valueId,
  onChangeId,
  loading = false,

  label,
  placeholder = "シナリオを選択",

  size = "small",
  fullWidth = true,
  textFieldProps = {},

  getOptionLabel,

  showSourceLabel = true,
  sourceLabelRequiresProject = false,
}) {
  const selectedObj =
    options.find((s) => String(s.id) === String(valueId)) || null;

  const handleChange = (_, val) => {
    if (!onChangeId) return;
    onChangeId(val ? String(val.id) : "");
  };

  const defaultGetOptionLabel = (s) =>
    s?.scenario_name || s?.name || (s?.id != null ? `Scenario ${s.id}` : "");

  const resolvedGetOptionLabel = getOptionLabel || defaultGetOptionLabel;

  const getSourceLabel = (source) => {
    const raw = source || "—";
    if (!source) return raw;
    return String(source).toLowerCase() === "owned scenario" ? "自分" : raw;
  };

  return (
    <Autocomplete
      fullWidth={fullWidth}
      options={options}
      loading={loading}
      size={size}
      value={selectedObj}
      onChange={handleChange}
      getOptionLabel={resolvedGetOptionLabel}
      renderOption={(props, option) => {
        const rawSource = option.scenario_source || "—";
        const sourceLabel = getSourceLabel(option.scenario_source);

        const shouldShowSource =
          showSourceLabel &&
          (!sourceLabelRequiresProject || option.project_name != null);

        return (
          <li {...props}>
            <Box sx={{ display: "flex", alignItems: "center", width: "100%" }}>
              <Typography noWrap>
                {resolvedGetOptionLabel(option)}
              </Typography>
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
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          {...(label ? { label } : {})}
          placeholder={placeholder}
          size={size}
          {...textFieldProps}
        />
      )}
    />
  );
}

ScenarioAutocomplete.propTypes = {
  options: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      scenario_name: PropTypes.string,
      name: PropTypes.string,
      scenario_source: PropTypes.string,
      project_name: PropTypes.string,
    })
  ).isRequired,
  valueId: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.oneOf([null]),
  ]),
  onChangeId: PropTypes.func,
  loading: PropTypes.bool,
  label: PropTypes.string,
  placeholder: PropTypes.string,
  size: PropTypes.oneOf(["small", "medium"]),
  fullWidth: PropTypes.bool,
  textFieldProps: PropTypes.object,
  getOptionLabel: PropTypes.func,
  showSourceLabel: PropTypes.bool,
  sourceLabelRequiresProject: PropTypes.bool,
};

export default ScenarioAutocomplete;
