import React from "react";
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Divider,
  IconButton,
  Collapse,
  Dialog,
  DialogContent,
  AppBar,
  Toolbar,
} from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CloseIcon from "@mui/icons-material/Close";

import VisualizationTwoPaneLayout from "../../../components/visualization/VisualizationTwoPaneLayout";
import RouteTimetableFilterPanel from "../../../components/visualization/route-timetable/RouteTimetableFilterPanel";
import RouteTimetableMap from "../../../components/visualization/route-timetable/RouteTimetableMap";

import StopParentTimeTable from "../../../components/visualization/bus-running-visualization/StopParentTimeTable";
import StopChildTimeTable from "../../../components/visualization/bus-running-visualization/StopChildTimeTable";

import { VISUALIZATION_LAYOUT } from "../../../constant/ui";
import { VISUALIZATION } from "@/strings";

import {
  normalizeChildStopDetail,
  normalizeParentStopDetail,
} from "./helper/routeTimetableUtils";
import { useRouteTimetableVisualization } from "./hooks/useRouteTimetableVisualization";

function RouteTimetableVisualization() {
  const {
    scenarioOptions,
    loadingScenario,
    selectedScenario,
    handleScenarioChange,
    allRouteAndStopData,
    loadingRoutes,
    routeGroupsOptions,
    selectedRouteGroups,
    handleRouteGroupsChange,
    groupingOption,
    handleGroupingOptionChange,
    directionId,
    handleDirectionChange,
    serviceIdOptions,
    selectedServiceIds,
    handleServiceIdsChange,
    timeRange,
    handleTimeRangeChange,
    handleApplyFilters,
    handleResetFilters,
    selectedStopMeta,
    selectedStopDetail,
    loadingStopDetail,
    handleStopSelect,
    startTime,
    endTime,
    directionFilter,
    activeServiceNames,
    selectedScenarioName,
    panelOpen,
    setPanelOpen,
    modalOpen,
    setModalOpen,
    panelRef,
    modalRef,
    handleDownload,
  } = useRouteTimetableVisualization();

const TimetableContent = () => {
    if (loadingStopDetail) {
      return (
        <Box sx={{ py: 6, display: "flex", gap: 2, alignItems: "center", justifyContent: "center" }}>
          <CircularProgress size={24} />
          <Typography variant="body2" color="text.secondary">
            {VISUALIZATION.routeTimetable.messages.loadingTimetable}
          </Typography>
        </Box>
      );
    }
    if (!selectedStopDetail) {
      return (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {VISUALIZATION.routeTimetable.messages.clickStopToShow}
        </Typography>
      );
    }

    if (groupingOption === "parent") {
      const normalized = normalizeParentStopDetail(selectedStopDetail);
      if (!normalized || !normalized.stops?.length) {
        return (
          <Typography variant="body2" color="text.secondary">
            {VISUALIZATION.routeTimetable.messages.noData}
          </Typography>
        );
      }

      return (
        <StopParentTimeTable
          data={normalized}
          directionId={directionFilter}
          serviceIds={activeServiceNames}
          startTime={startTime}
          endTime={endTime}
          showTitle={false}
        />
      );
    }

    // child
    const normalized = normalizeChildStopDetail(selectedStopDetail);
    if (!normalized) {
      return (
        <Typography variant="body2" color="text.secondary">
          {VISUALIZATION.routeTimetable.messages.noData}
        </Typography>
      );
    }
    return (
      <StopChildTimeTable
        stopData={normalized}
        directionId={directionFilter}
        serviceIds={activeServiceNames}
        startTime={startTime}
        endTime={endTime}
      />
    );
  };

  const timetablePanel = (
    <Paper sx={{ p: 2, mb: 2, position: "relative" }}>
      {/* header (collapsed view) — follow GraphPanel style */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: panelOpen ? 1 : 0 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom sx={{ mb: 0 }}>
          {(groupingOption == "parent"
            ? VISUALIZATION.routeTimetable.labels.stop
            : VISUALIZATION.routeTimetable.labels.pole) +
            VISUALIZATION.routeTimetable.labels.timetableSuffix}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <IconButton
            size="small"
            onClick={() => setModalOpen(true)}
            title={VISUALIZATION.routeTimetable.actions.expand}
            sx={{ mr: 1 }}
          >
            <span class="material-symbols-outlined outlined">
            fullscreen
            </span>
          </IconButton>
          <IconButton size="small" onClick={() => setPanelOpen((v) => !v)}>
            {panelOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      <Collapse in={panelOpen}>
        <Box ref={panelRef} sx={{ width: "100%" }}>
          {/* optional meta header */}
          {selectedStopMeta ? (
            <>
              <Typography variant="h6" fontWeight={700}>
                {selectedStopMeta.stop_name}
                {groupingOption === "parent" ? VISUALIZATION.routeTimetable.labels.stop : ""}
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </>
          ) : null}
          <TimetableContent />
        </Box>
      </Collapse>

      {/* fullscreen dialog */}
      <Dialog fullScreen open={modalOpen} onClose={() => setModalOpen(false)}>
        <AppBar position="sticky" color="inherit" elevation={1}>
          <Toolbar>
            <IconButton edge="start" onClick={() => setModalOpen(false)}>
              <CloseIcon />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" fontWeight={700}>
              {VISUALIZATION.routeTimetable.labels.stopTimetable}
            </Typography>
            <IconButton
              size="small"
              title={VISUALIZATION.routeTimetable.actions.download}
              onClick={() => handleDownload(true)}
            >
              <span class="material-symbols-outlined outlined" style ={{ fontSize: 45 }}>
              file_png
              </span>
            </IconButton>
          </Toolbar>
        </AppBar>
        <DialogContent sx={{ p: 3 }}>
          <Box
            ref={modalRef}
            sx={{ width: "100%", minWidth: VISUALIZATION_LAYOUT.routeTimetable.detailsModalMinWidthPx }}
          >
            {/* repeat meta header in modal */}
            {selectedStopMeta ? (
              <>
                <Typography variant="h5" fontWeight={700}>
                  {selectedStopMeta.stop_name}
                  {groupingOption === "parent" ? VISUALIZATION.routeTimetable.labels.stop : ""}
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </>
            ) : null}
            <TimetableContent />
          </Box>
        </DialogContent>
      </Dialog>
    </Paper>
  );

  return (
    <Box
      sx={{
        height: VISUALIZATION_LAYOUT.pageHeight,
        boxSizing: "border-box",
        overflow: "visible",
        display: "flex",
        flexDirection: "column",
        mt: VISUALIZATION_LAYOUT.pageMarginTop,
      }}
    >
      <Typography variant="h4" sx={{fontWeight: 600, ml: 1 }}>
        {VISUALIZATION.titles.routeTimetable}
      </Typography>

      <VisualizationTwoPaneLayout
        filterPanel={
          <RouteTimetableFilterPanel
            scenarioOptions={scenarioOptions}
            loadingScenario={loadingScenario}
            selectedScenario={selectedScenario}
            onScenarioChange={handleScenarioChange}
            // route groups
            routeGroupsOptions={routeGroupsOptions}
            selectedRouteGroups={selectedRouteGroups}
            onRouteGroupsChange={handleRouteGroupsChange}
            // grouping
            groupingOption={groupingOption}
            onGroupingOptionChange={handleGroupingOptionChange}
            // direction + services
            directionId={directionId}
            onDirectionChange={handleDirectionChange}
            serviceIdOptions={serviceIdOptions}
            selectedServiceIds={selectedServiceIds}
            onServiceIdsChange={handleServiceIdsChange}
            // time
            timeRange={timeRange}
            onTimeRangeChange={handleTimeRangeChange}
            // actions
            onApply={handleApplyFilters}
            onReset={handleResetFilters}
          />
        }
        graphs={selectedStopDetail ? timetablePanel : (loadingStopDetail ? <CircularProgress /> : 
            <Paper
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 2,
              mb: 2,
              textAlign: "center",
            }}
          >
          {VISUALIZATION.routeTimetable.messages.clickStopToShowOnMap}
          </Paper>
        )}
        right={({ containerWidth }) => (
          <RouteTimetableMap
            allRouteAndStopData={allRouteAndStopData}
            onStopSelect={handleStopSelect}
            selectedStopId={selectedStopMeta?.stop_id}
            containerWidth={containerWidth}
            scenarioName={selectedScenarioName}
            screenName={VISUALIZATION.titles.routeTimetable}
          />
        )}
        rightLoading={loadingRoutes}
      />
    </Box>
  );
}

export default RouteTimetableVisualization;
