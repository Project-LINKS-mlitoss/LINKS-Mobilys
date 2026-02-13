// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import {
  Box,
  Typography,
  Paper,
  Divider,
  Backdrop,
  CircularProgress,
} from "@mui/material";

import StopRadiusFilterPanel from "../../../components/visualization/stop-radius-analysis/StopRadiusFilterPanel";
import StopRadiusMap from "../../../components/visualization/stop-radius-analysis/StopRadiusMap";
import StopRadiusGraphContainer from "../../../components/visualization/stop-radius-analysis/StopRadiusGraphContainer";

import VisualizationTwoPaneLayout from "../../../components/visualization/VisualizationTwoPaneLayout";
import PageBanner from "../PageBanner";
import { VISUALIZATION_LAYOUT } from "../../../constant/ui";
import { VISUALIZATION } from "@/strings";
import { useStopRadiusAnalysis } from "./hooks/useStopRadiusAnalysis";

export default function StopRadiusAnalysis() {
  const {
    scenarioOptions,
    selectedScenario,
    setSelectedScenario,
    loadingScenario,
    radius,
    setRadius,
    radiusFeatureCollection,
    radiusKey,
    allRouteAndStopData,
    populationData,
    loadingRes,
    loadingGraph,
    graphData,
    handleCalculate,
    handleReset,
    currentScenarioName,
  } = useStopRadiusAnalysis();

const coverageAreaDescription = VISUALIZATION.stopRadiusAnalysis.description;
return (
    <Box
      sx={{
        height: VISUALIZATION_LAYOUT.pageHeight,
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        mt: VISUALIZATION_LAYOUT.pageMarginTop,
      }}
    >
      <Typography variant="h4" sx={{ mb: 1, fontWeight: 600, ml: 1 }}>
        {VISUALIZATION.titles.stopRadiusAnalysis}
      </Typography>
      <PageBanner
          text={coverageAreaDescription}
maxLines={1}
          width={"100%"}
      />
      <VisualizationTwoPaneLayout
        headerHeight={VISUALIZATION_LAYOUT.headerHeight}
        filterPanel={
          <StopRadiusFilterPanel
            scenarioOptions={scenarioOptions}
            selectedScenario={selectedScenario}
            onScenarioChange={setSelectedScenario}
            radius={radius}
            onRadiusChange={setRadius}
            loadingScenario={loadingScenario}
            onCalculate={handleCalculate}
            onReset={handleReset}
          />
        }
        graphs={
          loadingGraph ? (
            <Typography>{VISUALIZATION.common.loading.graph}</Typography>
          ) : (
            <StopRadiusGraphContainer
              data={graphData}
              radius={radius}
              scenarioName={currentScenarioName}
              screenName={VISUALIZATION.titles.stopRadiusAnalysis}
            />
          )
        }
        rightLoading={loadingRes}
        right={
          <StopRadiusMap
            radiusKey={radiusKey}
            radiusFeatureCollection={radiusFeatureCollection}
            populationData={populationData}
            allRouteAndStopData={allRouteAndStopData}
            pois={Array.isArray(graphData?.poi_for_map) ? graphData.poi_for_map : []}
            scenarioName={currentScenarioName}
            screenName={VISUALIZATION.titles.stopRadiusAnalysis}
          />
        }
      />
    </Box>
  );
}
