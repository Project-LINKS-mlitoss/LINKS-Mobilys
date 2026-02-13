// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { useEffect, useMemo } from "react";
import {
  Box,
  CircularProgress,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import { useAuthStore } from "../../state/authStore";
import { useProjectPrefectureStore } from "../../state/projectPrefectureStore";
import { shallow } from "zustand/shallow";
import { VISUALIZATION } from "@/strings";

const DEFAULT_VALUE = "__default__";

export default function ProjectPrefectureSelect({ dense = false }) {
  const projectId = useAuthStore((s) => s.projectId);
  const {
    prefecture,
    availablePrefectures,
    isDefault,
    loading,
    error,
  } = useProjectPrefectureStore(
    (state) => ({
      prefecture: state.prefecture,
      availablePrefectures: state.availablePrefectures,
      isDefault: state.isDefault,
      loading: state.loading,
      error: state.error,
    }),
    shallow
  );
  const fetchSelection = useProjectPrefectureStore((s) => s.fetchSelection);
  const saveSelection = useProjectPrefectureStore((s) => s.saveSelection);

  // Keep the selection in sync with the current project
  useEffect(() => {
    if (!projectId) return;
    fetchSelection(projectId);
  }, [projectId, fetchSelection]);

  const value = useMemo(
    () => (isDefault || !prefecture ? DEFAULT_VALUE : prefecture),
    [isDefault, prefecture],
  );

  const handleChange = async (event) => {
    const next = event.target.value;
    const normalized = next === DEFAULT_VALUE ? "default" : next;
    try {
      await saveSelection(normalized);
    } catch {
      // error is already stored in the Zustand slice
    }
  };

  const helperText = useMemo(() => {
    if (error) return error;
    if (!projectId) return VISUALIZATION.common.projectPrefecture.helperNoProject;
    return VISUALIZATION.common.projectPrefecture.helperWithProject;
  }, [error, projectId]);

  return (
    <FormControl
      fullWidth
      margin="normal"
      size={dense ? "small" : "medium"}
      disabled={!projectId || loading}
    >
      <InputLabel id="project-prefecture-select-label">{VISUALIZATION.common.projectPrefecture.label}</InputLabel>
      <Select
        labelId="project-prefecture-select-label"
        label={VISUALIZATION.common.projectPrefecture.label}
        value={value}
        onChange={handleChange}
        renderValue={(selected) =>
          selected === DEFAULT_VALUE ? VISUALIZATION.common.projectPrefecture.scenarioDefault : selected
        }
      >
        <MenuItem value={DEFAULT_VALUE}>{VISUALIZATION.common.projectPrefecture.scenarioDefault}</MenuItem>
        {availablePrefectures.map((name) => (
          <MenuItem key={name} value={name}>
            {name}
          </MenuItem>
        ))}
      </Select>
      <FormHelperText error={Boolean(error)}>{helperText}</FormHelperText>
      {loading && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="caption" color="text.secondary">
            {VISUALIZATION.common.projectPrefecture.saving}
          </Typography>
        </Box>
      )}
    </FormControl>
  );
}
