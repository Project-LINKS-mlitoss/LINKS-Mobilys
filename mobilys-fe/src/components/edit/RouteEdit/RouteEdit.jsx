import { useState } from "react";
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Paper,
} from "@mui/material";
import CreateRoutePatternTab from "./CreateRoutePatternTab";
import DeleteRoutePatternTab from "./DeleteRoutePatternTab";
import EditRoutePatternTab from "./EditRoutePatternTab";
import { LABELS } from "../../../strings";


const RouteEditTabs = ({
  routeGroups,
  routeData,
  onSave,
  scenarioId,
  onDelete,
  onSaveExisting,
  onUpdate,
  tabIndex,
  setTabIndex,
  loadingRouteActions,
  loadingRoutes,
  shapeData,
  previewShapeData,
  showTabs = true,
  onRefetchRoutes,

  // shape editing props
  onUpdateShapesBulk,


}) => {

  const handleChange = (event, newValue) => {
    setTabIndex(newValue);
  };

  return (
    <Box>
      {showTabs && (
        <Tabs
          value={tabIndex}
          onChange={handleChange}
          textColor="primary"
          indicatorColor="primary"
          sx={{ mb: 2 }}
        >
          <Tab label={LABELS.route.createNewPatternTab} />
          <Tab label={LABELS.route.deletePatternTab} />
          <Tab label={LABELS.route.shortenRouteTab} />
        </Tabs>
      )}

      <Paper sx={{ p: 2 }}>
        {tabIndex === 0 && (
          <CreateRoutePatternTab
            routeGroups={routeGroups}
            routeData={routeData}
            onSave={onSave}
            onSaveExisting={onSaveExisting}
            scenarioId={scenarioId}
            loadingRouteActions={loadingRouteActions}
            onDelete={onDelete}
            loadingRoutes={loadingRoutes}
            previewShapeData={previewShapeData}
            shapeData={shapeData}
            onRefetchRoutes={onRefetchRoutes}
            onUpdateShapesBulk={onUpdateShapesBulk}
          />
        )}
        {tabIndex === 1 && (
          <DeleteRoutePatternTab
            routeData={routeData}
            scenarioId={scenarioId}
            onDelete={onDelete}
            loadingRouteActions={loadingRouteActions}
          />
        )}
        {tabIndex === 2 && (
          <EditRoutePatternTab
            routeData={routeData}
            scenarioId={scenarioId}
            onUpdate={onUpdate}
            loadingRouteActions={loadingRouteActions}
          />
        )}
      </Paper>
    </Box>
  );
};

export default RouteEditTabs;
