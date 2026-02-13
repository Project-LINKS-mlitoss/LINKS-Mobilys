// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import { Stack, CircularProgress } from "@mui/material";
import RouteEditTabs from "../../components/edit/RouteEdit/RouteEdit";
import RouteGroupTab from "../../components/gtfs/ImportDetailRouteGroupTab";
import { useRouteGroupingTab, useRoutePatternTab } from "./hooks/useRouteFeatureTabs";

export function RouteGroupingTab({ scenarioId }) {
  const {
    loading,
    routeGroups,
    stopGroupsGeojson,
    routeFilterOption,
    routeData,
    handleSave,
    handleColorSave,
    handleCreateGroup,
    handleDeleteGroup,
    handleRenameGroup,
  } = useRouteGroupingTab({ scenarioId });

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  return (
    <RouteGroupTab
      routeGroups={routeGroups}
      stopGroupsGeojson={stopGroupsGeojson}
      routeData={routeData}
      onSave={handleSave}
      onSaveColor={handleColorSave}
      filterOptions={routeFilterOption}
      onCreateGroup={handleCreateGroup}
      onDeleteGroup={handleDeleteGroup}
      onRenameGroup={handleRenameGroup}
    />
  );
}

export function RoutePatternTab({
  scenarioId,
  tabIndex = 0,
  setTabIndex = () => {},
  forceTabIndex = null,
}) {
  const {
    routeData,
    routeGroups,
    loadingRoutes,
    loadingRouteActions,
    shapeData,
    refetchRoutes,
    handleSaveRoute,
    handleSaveExistingRoute,
    handleUpdateRoute,
    handleDeleteRoute,
    previewShapeData,
    handleUpdateShapesBulk,
  } = useRoutePatternTab({ scenarioId });

  if (loadingRoutes) {
    return (
      <Stack alignItems="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  const effectiveTabIndex =
    forceTabIndex !== null && forceTabIndex !== undefined
      ? forceTabIndex
      : tabIndex;

  return (
    <RouteEditTabs
      routeGroups={routeGroups}
      routeData={routeData}
      onSave={handleSaveRoute}
      onSaveExisting={handleSaveExistingRoute}
      onDelete={handleDeleteRoute}
      onUpdate={handleUpdateRoute}
      onUpdateShapesBulk={handleUpdateShapesBulk}
      scenarioId={scenarioId}
      tabIndex={effectiveTabIndex}
      setTabIndex={
        forceTabIndex !== null && forceTabIndex !== undefined
          ? () => {}
          : setTabIndex
      }
      loadingRoutes={loadingRoutes}
      loadingRouteActions={loadingRouteActions}
      shapeData={shapeData}
      previewShapeData={previewShapeData}
      onRefetchRoutes={refetchRoutes}
      showTabs={false}
    />
  );
}

// Wrapper for route cut tab to lock tabIndex
export function RouteCutTab({ scenarioId }) {
  return <RoutePatternTab scenarioId={scenarioId} forceTabIndex={2} />;
}

export default RoutePatternTab;
