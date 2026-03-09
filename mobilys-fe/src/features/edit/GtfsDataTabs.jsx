// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import { Tabs, Tab } from "@mui/material";
import FeedInfoTab from "./FeedInfoTab";
import CalendarTab from "./CalendarTab";
import TripsTab from "./TripsTab";
import { StopsTab } from "./StopsFeatureTabs";
import { RouteCutTab } from "./RouteFeatureTabs";
import { SCENARIO } from "../../strings";

function GtfsDataTabs({ scenarioId, gtfsFlatTab, setGtfsFlatTab, onScenarioNameChange }) {
  return (
    <>
      <Tabs
        value={gtfsFlatTab}
        onChange={(event, value) => {
          void event;
          setGtfsFlatTab(value);
        }}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2 }}
      >
        <Tab label={SCENARIO.gtfsDataTabs.tabs.feedInfo} value={0} />
        <Tab label={SCENARIO.gtfsDataTabs.tabs.calendar} value={1} />
        <Tab label={SCENARIO.gtfsDataTabs.tabs.stops} value={2} />
        <Tab label={SCENARIO.gtfsDataTabs.tabs.routeCut} value={3} />
        <Tab label={SCENARIO.gtfsDataTabs.tabs.trips} value={4} />
      </Tabs>

      {gtfsFlatTab === 0 && (
        <FeedInfoTab scenarioId={scenarioId} onScenarioNameChange={onScenarioNameChange} />
      )}
      {gtfsFlatTab === 1 && (
        <CalendarTab scenarioId={scenarioId} onScenarioNameChange={onScenarioNameChange} />
      )}
      {gtfsFlatTab === 2 && <StopsTab scenarioId={scenarioId} />}
      {gtfsFlatTab === 3 && <RouteCutTab scenarioId={scenarioId} />}
      {gtfsFlatTab === 4 && <TripsTab scenarioId={scenarioId} />}
    </>
  );
}

export default GtfsDataTabs;

