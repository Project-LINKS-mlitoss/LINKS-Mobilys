// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import { Stack, CircularProgress } from "@mui/material";
import StopGroupTab from "../../components/gtfs/ImportDetailStopGroupTab";
import StopEdit from "../../components/edit/StopEdit/StopEdit";
import { useStopGroupingTab, useStopsTab } from "./hooks/useStopsFeatureTabs";

export function StopGroupingTab({ scenarioId }) {
  const {
    loading,
    stopGroupsByName,
    stopGroupsById,
    stopGroupingMethod,
    handleSave,
    handleGroupTypeChange,
    handlePatchName,
    handlePatchId,
  } = useStopGroupingTab({ scenarioId });

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  return (
    <StopGroupTab
      stopGroupsByName={stopGroupsByName}
      stopGroupsById={stopGroupsById}
      onSave={handleSave}
      onGroupTypeChange={handleGroupTypeChange}
      stopGroupingMethod={stopGroupingMethod}
      onPatchGroupName={handlePatchName}
      onPatchGroupId={handlePatchId}
    />
  );
}

export function StopsTab({ scenarioId }) {
  const {
    loadingStop,
    stopGroups,
    stopAction,
    setStopAction,
    stopGroupingMethod,
    handleStopFormSubmit,
    handleStopDeleteInline,
    handleGroupTypeChange,
    onCreate,
    onCreateChild,
    onEdit,
  } = useStopsTab({ scenarioId });

  if (loadingStop) {
    return (
      <Stack alignItems="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  return (
    <StopEdit
      stopGroups={stopGroups}
      action={stopAction}
      setAction={setStopAction}
      onFormSubmit={handleStopFormSubmit}
      groupingMethod={stopGroupingMethod}
      onGroupTypeChange={handleGroupTypeChange}
      onCreate={onCreate}
      onCreateChild={onCreateChild}
      onEdit={onEdit}
      onDelete={handleStopDeleteInline}
    />
  );
}

export default StopsTab;
