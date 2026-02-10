import { Box, Typography } from "@mui/material";

import BufferAnalysisFilterPanel from "../../../components/visualization/buffer-analysis/BufferAnalysisFilterPanel";
import BufferAnalysisMap from "../../../components/visualization/buffer-analysis/BufferAnalysisMap";
import BufferAnalysisGraphContainer from "../../../components/visualization/buffer-analysis/BufferAnalysisGraphContainer";

import VisualizationTwoPaneLayout from "../../../components/visualization/VisualizationTwoPaneLayout";
import PageBanner from "../PageBanner";
import { VISUALIZATION_LAYOUT } from "../../../constant/ui";
import { VISUALIZATION } from "@/strings";
import { useBufferAnalysis } from "./hooks/useBufferAnalysis";

export default function BufferAnalysis() {
  const {
    scenarioOptions,
    selectedScenario,
    setSelectedScenario,
    loadingScenario,
    activeCutoffIdx,
    graphDataByCutoff,
    coords,
    date,
    handleDateChange,
    time,
    setTime,
    speed,
    setSpeed,
    currentScenarioName,
    graphData,
    loadingGraph,
    loadingRes,
    bufferGeojsonLayers,
    routeGeojson,
    stopGeojson,
    mapFocusTrigger,
    populationData,
    bufferVersion,
    poiData,
    populationWithinBuffer,
    handleCalculate,
    handleReset,
    handleCoordsChange,
    handleMapClick,
    handleCutoffIndexChange,
  } = useBufferAnalysis();

  const serviceLevelDescription = VISUALIZATION.bufferAnalysis.description;
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
        {VISUALIZATION.titles.bufferAnalysis}
      </Typography>
      <PageBanner
        text={serviceLevelDescription}
        maxLines={1}
        width={"100%"}
      />
      <VisualizationTwoPaneLayout
        headerHeight={VISUALIZATION_LAYOUT.headerHeight}
        filterPanel={
          <BufferAnalysisFilterPanel
            scenarioOptions={scenarioOptions}
            selectedScenario={selectedScenario}
            onScenarioChange={setSelectedScenario}
            coords={coords}
            onCoordsChange={handleCoordsChange}
            date={date}
            onDateChange={handleDateChange}
            time={time}
            onTimeChange={setTime}
            speed={speed}
            onSpeedChange={setSpeed}
            loadingScenario={loadingScenario}
            onCalculate={handleCalculate}
            onReset={handleReset}
          />
        }
        graphs={
          loadingGraph ? (
            <Typography>{VISUALIZATION.common.loading.graph}</Typography>
          ) : (
            <BufferAnalysisGraphContainer
              data={graphData}
              dataByCutoff={graphDataByCutoff}
              activeCutoffIdx={activeCutoffIdx}
              populationWithinBuffer={populationWithinBuffer}
              onCutoffIndexChange={handleCutoffIndexChange}
              scenarioName={currentScenarioName}
            />
          )
        }
        rightLoading={loadingRes}
        right={() => (
          <BufferAnalysisMap
            bufferVersion={bufferVersion}
            center={coords}
            speed={speed}
            bufferGeojsonLayers={bufferGeojsonLayers}
            routeGeojson={routeGeojson}
            stopGeojson={stopGeojson}
            mapFocusTrigger={mapFocusTrigger}
            onMapClick={handleMapClick}
            pois={poiData}
            onCutoffIndexChange={handleCutoffIndexChange}
            scenarioId={selectedScenario}
            populationData={populationData}
            scenarioName={currentScenarioName}
          />
        )}
      />
    </Box>
  );
}
