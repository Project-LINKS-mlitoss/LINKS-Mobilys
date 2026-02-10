import React from "react";
import { Tabs, Tab } from "@mui/material";
import { SCENARIO } from "../../strings";
import { StopGroupingTab } from "./StopsFeatureTabs";
import { RouteGroupingTab, RoutePatternTab } from "./RouteFeatureTabs";

function GroupingTab({ scenarioId, groupSubTab, onSubTabChange }) {
  return (
    <>
      <Tabs
        value={groupSubTab}
        onChange={(event, value) => {
          void event;
          onSubTabChange(value);
        }}
        sx={{ mb: 2 }}
      >
        <Tab label={SCENARIO.groupingTab.tabs.stopGrouping} value={0} />
        <Tab label={SCENARIO.groupingTab.tabs.routeGrouping} value={1} />
        <Tab label={SCENARIO.groupingTab.tabs.patternEdit} value={2} />
      </Tabs>

      {groupSubTab === 0 && <StopGroupingTab scenarioId={scenarioId} />}
      {groupSubTab === 1 && <RouteGroupingTab scenarioId={scenarioId} />}
      {groupSubTab >= 2 && (
        <RoutePatternTab
          scenarioId={scenarioId}
          tabIndex={groupSubTab === 2 ? 0 : 1}
          setTabIndex={(value) => {
            if (value === 0) onSubTabChange(2);
            else if (value === 1) onSubTabChange(3);
            else onSubTabChange(2);
          }}
        />
      )}
    </>
  );
}

export default GroupingTab;

