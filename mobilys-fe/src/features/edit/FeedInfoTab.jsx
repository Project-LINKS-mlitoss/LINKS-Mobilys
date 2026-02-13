// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import { Stack, CircularProgress, Typography } from "@mui/material";
import ScenarioFeedInfoForm from "../../components/edit/FeedEdit/ScenarioFeedInfoForm";
import { useFeedInfoTab } from "./hooks/useFeedInfoTab";

function FeedInfoTab({ scenarioId, onScenarioNameChange }) {
  const { loading, error, submitting, initialValues, submitLabel, onSubmit } = useFeedInfoTab({
    scenarioId,
    onScenarioNameChange,
  });

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
    <ScenarioFeedInfoForm
      initialValues={initialValues}
      submitting={submitting}
      submitLabel={submitLabel}
      onSubmit={onSubmit}
    />
  );
}

export default FeedInfoTab;

