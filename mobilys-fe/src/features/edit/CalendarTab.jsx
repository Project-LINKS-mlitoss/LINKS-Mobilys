// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import { Stack, CircularProgress, Typography } from "@mui/material";
import ScenarioCalendarEditor from "../../components/edit/CalendarEdit/ScenarioCalendarEditor";
import { useCalendarTab } from "./hooks/useCalendarTab";

function CalendarTab({ scenarioId, onScenarioNameChange }) {
  const {
    loading,
    error,
    scenarioStart,
    scenarioEnd,
    initialCalendar,
    initialCalendarDates,
    onSaveCalendar,
    onSaveCalendarDates,
  } = useCalendarTab({ scenarioId, onScenarioNameChange });

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  return (
    <ScenarioCalendarEditor
      scenarioStart={scenarioStart}
      scenarioEnd={scenarioEnd}
      initialCalendar={initialCalendar}
      initialCalendarDates={initialCalendarDates}
      onSaveCalendar={onSaveCalendar}
      onSaveCalendarDates={onSaveCalendarDates}
    />
  );
}

export default CalendarTab;

