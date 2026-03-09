// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import { useSearchParams } from "react-router-dom";
import { getEditScenarioContextSvc } from "../../../services/scenarioService";
import { SCENARIO } from "../../../strings";

const TOP_TABS = {
  grouping: 0,
  gtfsData: 1,
};

const GROUPING_SUBTABS = {
  routePattern: 2,
};

const GTFS_DATA_TABS = {
  feedInfo: 0,
  stops: 2,
  trips: 4,
};

const FLOW_TARGETS = {
  timetable: [
    { tab: TOP_TABS.gtfsData, gtfsFlatTab: GTFS_DATA_TABS.trips },
    { tab: TOP_TABS.gtfsData, gtfsFlatTab: GTFS_DATA_TABS.feedInfo },
  ],
  route: [
    { tab: TOP_TABS.grouping, groupSubTab: GROUPING_SUBTABS.routePattern },
    { tab: TOP_TABS.gtfsData, gtfsFlatTab: GTFS_DATA_TABS.trips },
    { tab: TOP_TABS.gtfsData, gtfsFlatTab: GTFS_DATA_TABS.feedInfo },
  ],
  stops: [
    { tab: TOP_TABS.gtfsData, gtfsFlatTab: GTFS_DATA_TABS.stops },
    { tab: TOP_TABS.grouping, groupSubTab: GROUPING_SUBTABS.routePattern },
    { tab: TOP_TABS.gtfsData, gtfsFlatTab: GTFS_DATA_TABS.trips },
    { tab: TOP_TABS.gtfsData, gtfsFlatTab: GTFS_DATA_TABS.feedInfo },
  ],
};

export function useGtfsEdit({ scenarioId }) {
  const [searchParams] = useSearchParams();
  const flow = searchParams.get("flow");
  const [flowInitDone, setFlowInitDone] = React.useState(false);

  const [tab, setTab] = React.useState(TOP_TABS.grouping);
  const [groupSubTab, setGroupSubTab] = React.useState(0);
  const [gtfsFlatTab, setGtfsFlatTab] = React.useState(0);
  const [scenarioName, setScenarioName] = React.useState("");

  React.useEffect(() => {
    if (!scenarioId) return;

    let cancelled = false;
    const run = async () => {
      try {
        const ctx = await getEditScenarioContextSvc(scenarioId);
        if (!cancelled) setScenarioName(ctx?.scenario_name || "");
      } catch {
        if (!cancelled) setScenarioName("");
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [scenarioId]);

  React.useEffect(() => {
    if (!flow || flowInitDone) return;

    const targets = FLOW_TARGETS[flow];
    if (Array.isArray(targets) && targets[0]) {
      const t = targets[0];
      if (typeof t.tab === "number") setTab(t.tab);
      if (typeof t.groupSubTab === "number") setGroupSubTab(t.groupSubTab);
      if (typeof t.gtfsFlatTab === "number") setGtfsFlatTab(t.gtfsFlatTab);
    }

    setFlowInitDone(true);
  }, [flow, flowInitDone]);

  const flowSteps = React.useMemo(() => {
    if (!flow) return null;
    return SCENARIO.editPage.flowSteps?.[flow] || null;
  }, [flow]);

  const flowTitle = React.useMemo(() => {
    if (!flow) return "";
    return SCENARIO.editPage.flowTitles?.[flow] || "";
  }, [flow]);

  const activeFlowIndex = React.useMemo(() => {
    if (!flow) return -1;

    if (flow === "timetable") {
      if (tab === TOP_TABS.gtfsData && gtfsFlatTab === GTFS_DATA_TABS.trips) return 0;
      if (tab === TOP_TABS.gtfsData && gtfsFlatTab === GTFS_DATA_TABS.feedInfo) return 1;
      return -1;
    }

    if (flow === "route") {
      if (tab === TOP_TABS.grouping && groupSubTab === GROUPING_SUBTABS.routePattern) return 0;
      if (tab === TOP_TABS.gtfsData && gtfsFlatTab === GTFS_DATA_TABS.trips) return 1;
      if (tab === TOP_TABS.gtfsData && gtfsFlatTab === GTFS_DATA_TABS.feedInfo) return 2;
      return -1;
    }

    if (flow === "stops") {
      if (tab === TOP_TABS.gtfsData && gtfsFlatTab === GTFS_DATA_TABS.stops) return 0;
      if (tab === TOP_TABS.grouping && groupSubTab === GROUPING_SUBTABS.routePattern) return 1;
      if (tab === TOP_TABS.gtfsData && gtfsFlatTab === GTFS_DATA_TABS.trips) return 2;
      if (tab === TOP_TABS.gtfsData && gtfsFlatTab === GTFS_DATA_TABS.feedInfo) return 3;
      return -1;
    }

    return -1;
  }, [flow, groupSubTab, gtfsFlatTab, tab]);

  const selectFlowStep = React.useCallback((index) => {
    if (!flow) return;

    const targets = FLOW_TARGETS[flow];
    const t = Array.isArray(targets) ? targets[index] : null;
    if (!t) return;

    if (typeof t.tab === "number") setTab(t.tab);
    if (typeof t.groupSubTab === "number") setGroupSubTab(t.groupSubTab);
    if (typeof t.gtfsFlatTab === "number") setGtfsFlatTab(t.gtfsFlatTab);
  }, [flow]);

  const tabList = React.useMemo(
    () => [
      { label: SCENARIO.editPage.tabs.groupingFix },
      { label: SCENARIO.editPage.tabs.gtfsDataEdit },
    ],
    []
  );

  return {
    flow,
    tabList,
    tab,
    setTab,
    groupSubTab,
    setGroupSubTab,
    gtfsFlatTab,
    setGtfsFlatTab,
    scenarioName,
    setScenarioName,
    flowSteps,
    flowTitle,
    activeFlowIndex,
    selectFlowStep,
  };
}
