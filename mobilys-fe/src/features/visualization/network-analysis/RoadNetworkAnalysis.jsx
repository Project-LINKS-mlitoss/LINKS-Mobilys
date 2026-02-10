import {
  Box,
  Typography,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Backdrop,
  CircularProgress,
} from "@mui/material";

import RoadNetworkFilterPanel from "../../../components/visualization/road-network-analysis/RoadNetworkFilterPanel";
import RoadNetworkMap from "../../../components/visualization/road-network-analysis/RoadNetworkMap";
import RoadNetworkGraphContainer from "../../../components/visualization/road-network-analysis/RoadNetworkGraphContainer";
import { groupingMethodMap } from "../../../constant/gtfs";
import VisualizationTwoPaneLayout from "../../../components/visualization/VisualizationTwoPaneLayout";
import PageBanner from "../PageBanner";
import { VISUALIZATION_LAYOUT } from "../../../constant/ui";
import { VISUALIZATION } from "@/strings";
import { useRoadNetworkAnalysis } from "./hooks/useRoadNetworkAnalysis";

function RoadNetworkAnalysis() {
  const {
    scenarioOptions,
    selectedScenario,
    setSelectedScenario,
    loadingScenario,
    coords,
    setCoords,
    date,
    handleDateChange,
    time,
    setTime,
    maxwalkingdistance,
    setMaxWalkingDistance,
    speed,
    setSpeed,
    percentile,
    setPercentile,
    loadingRes,
    graphData,
    isochroneData,
    routeGeojson,
    stopGeojson,
    graphStatus,
    graphStatusUpdatedAt,
    confirmOpen,
    setConfirmOpen,
    poiData,
    populationData,
    populationDataWithinIsochrone,
    prefAvail,
    prefAvailLoading,
    maxMinutes,
    setMaxMinutes,
    analysisMessage,
    currentScenarioName,
    onRefreshGraphStatus,
    createandUpdateGraph,
    handleGenerateBuffer,
    handleMapClick,
  } = useRoadNetworkAnalysis({ graphType: "osm" });

  const confirmText =
    graphStatus === "built" || graphStatus === "rebuilt"
      ? VISUALIZATION.roadNetworkAnalysisOsm.confirmText.whenBuilt
      : VISUALIZATION.roadNetworkAnalysisOsm.confirmText.otherwise;

  const scenarioIdForChild =
    typeof selectedScenario === "object" ? selectedScenario.id : selectedScenario;

  const networkDescription = VISUALIZATION.roadNetworkAnalysisOsm.description;
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
      {/* Global loading mask for right pane work (routes/stops/buffer) */}
      <Backdrop open={loadingRes} sx={{ zIndex: (theme) => theme.zIndex.drawer + 2 }}>
        <CircularProgress color="primary" />
      </Backdrop>
      <Typography variant="h4" sx={{ mb: 1, fontWeight: 600, ml: 1 }}>
        {VISUALIZATION.titles.roadNetworkAnalysisOsm}
      </Typography>
      <PageBanner
        text={networkDescription}
        maxLines={1}
        width={"100%"}
      />
      <VisualizationTwoPaneLayout
        headerHeight={VISUALIZATION_LAYOUT.headerHeight}
        filterPanel={
          <RoadNetworkFilterPanel
            scenarioOptions={scenarioOptions}
            selectedScenario={selectedScenario}
            onScenarioChange={setSelectedScenario}
            coords={coords}
            onCoordsChange={setCoords}
            date={date}
            onDateChange={handleDateChange}
            time={time}
            onTimeChange={setTime}
            maxwalkingdistance={maxwalkingdistance}
            onMaxWalkingDistanceChange={setMaxWalkingDistance}
            speed={speed}
            onSpeedChange={setSpeed}
            loadingScenario={loadingScenario}
            percentile={percentile}
            onPercentileChange={setPercentile}
            setConfirmOpen={setConfirmOpen}
            graphStatus={graphStatus}
            graphStatusUpdatedAt={graphStatusUpdatedAt}
            onRefreshGraphStatus={onRefreshGraphStatus}
            onHandleGenerateBuffer={handleGenerateBuffer}
            prefAvail={prefAvail}
            prefAvailLoading={prefAvailLoading}
          />
        }
        graphs={
          graphData ? (
            <RoadNetworkGraphContainer
              data={graphData}
              mergedPois={poiData}
              groupingMethod={groupingMethodMap.GROUPING_BY_NAME}
              populationData={populationDataWithinIsochrone}
              maxMinutes={maxMinutes}
              scenarioName={currentScenarioName}
              screenName={VISUALIZATION.roadNetworkAnalysisOsm.screenName}
            />
          ) : (
            <Paper
              variant="outlined"
              sx={{ p: 2, borderRadius: 2, mb: 2, textAlign: "center" }}
            >
              {analysisMessage || VISUALIZATION.common.emptyState.noResultsRunCalculation}
            </Paper>
          )
        }
        rightLoading={loadingRes}
        right={
          <RoadNetworkMap
            key={scenarioIdForChild}
            scenarioId={scenarioIdForChild}
            center={coords}
            routeGeojson={routeGeojson}
            stopGeojson={stopGeojson}
            visibleLayerIndex={0}
            onMapClick={handleMapClick}
            isochroneGeojson={isochroneData}
            poiData={poiData}
            populationData={populationData}      // keep showing last good mesh
            onIsochroneMinutesChange={setMaxMinutes}
            scenarioName={currentScenarioName}
            screenName={VISUALIZATION.roadNetworkAnalysisOsm.screenName}
          />
        }
      />
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>{VISUALIZATION.common.dialog.confirmTitle}</DialogTitle>
        <DialogContent>
          <Typography sx={{ whiteSpace: "pre-line" }}>{confirmText}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} color="inherit">
            {VISUALIZATION.common.dialog.cancel}
          </Button>
          <Button
            onClick={async () => {
              setConfirmOpen(false);
              await createandUpdateGraph();
            }}
            color="primary"
            variant="contained"
          >
            {VISUALIZATION.common.dialog.execute}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default RoadNetworkAnalysis;
