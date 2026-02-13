// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { Box } from "@mui/material";
import { VISUALIZATION } from "@/strings";
import POIRoadNetworkGraph from "./graph/POIRoadNetworkGraph";
import StopRoadNetworkGraph from "./graph/StopRoadNetworkGraph";
import PopulationIsochroneGraph from "../PopulationIsochroneGraph";

export default function RoadNetworkGraphContainer({
  data,
  mergedPois,
  groupingMethod,
  populationData,
  maxMinutes = null,
  scenarioName = VISUALIZATION.common.scenarioFallbackName,
  screenName = VISUALIZATION.roadNetworkAnalysisOsm.screenName,
}) {
  return (
    <Box elevation={1} sx={{ p: 2, borderRadius: 2, mb: 2 }}>
      <StopRoadNetworkGraph
        data={data?.stopData}
        groupingMethod={groupingMethod}
        maxMinutes={maxMinutes}
        scenarioName={scenarioName}
        screenName={screenName}
      />

      <POIRoadNetworkGraph
        data={data?.POIGraphData}
        maxMinutes={maxMinutes}
        scenarioName={scenarioName}
        screenName={screenName}
      />

      <PopulationIsochroneGraph
        data={populationData}
        maxMinutes={maxMinutes}
        scenarioName={scenarioName}
        screenName={screenName}
      />
    </Box>
  );
}
