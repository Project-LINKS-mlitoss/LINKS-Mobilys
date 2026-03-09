// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { useMemo } from "react";

import { getUserScenarios } from "../../../services/scenarioService";
import {
    buildGraph,
    fetchFP004MapFeaturesData,
    fetchFP004RouteGroupsAndStopsData,
    getAllRouteAndStopsData,
    getBufferAnalysisGraphData,
    getGraphBuildingStatus,
    getNumberOfBusRunningVisualizationData,
    getNumberOfBusRunningVisualizationDetailData,
    getODBusStopData,
    getODLastFirstStopData,
    getODUploadData,
    getODUsageDistributionData,
    getPopulationData,
    checkPrefectureAvailability,
    getRoadNetworkAnalysisGraphData,
    getRoadNetworkIsochroneData,
    getStopRadiusAnalysisMap,
    getStopRadiusAnalysisMapGraph,
} from "../../../services/visualizationService";
import { getServicePerScenarioData } from "../../../services/calendarService";
import { getPoiData } from "../../../services/poiService";

export function useVisualizationServices() {
    return useMemo(
        () => ({
            // scenarios
            getUserScenarios,

            // shared viz
            fetchFP004MapFeaturesData,
            fetchFP004RouteGroupsAndStopsData,
            getPopulationData,
            getAllRouteAndStopsData,

            // buffer analysis
            getBufferAnalysisGraphData,

            // stop radius analysis
            getStopRadiusAnalysisMap,
            getStopRadiusAnalysisMapGraph,

            // road network analysis
            getGraphBuildingStatus,
            buildGraph,
            checkPrefectureAvailability,
            getRoadNetworkIsochroneData,
            getRoadNetworkAnalysisGraphData,

            // bus running viz
            getNumberOfBusRunningVisualizationData,
            getNumberOfBusRunningVisualizationDetailData,
            getServicePerScenarioData,
            getPoiData,

            // OD analysis
            getODUsageDistributionData,
            getODLastFirstStopData,
            getODBusStopData,
            getODUploadData,

            // route timetable
            // (uses getAllRouteAndStopsData + getServicePerScenarioData + getNumberOfBusRunningVisualizationDetailData)
        }),
        [],
    );
}
