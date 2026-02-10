import {
    Box,
    Backdrop,
    CircularProgress,
    Dialog,
    DialogContent,
    DialogActions,
    Button,
    Typography,
} from "@mui/material";
import FilterPanel from "../../../components/visualization/bus-running-visualization/FilterPanel";
import MapVisualization from "../../../components/visualization/bus-running-visualization/MapVisualization";
import GraphPanel from "../../../components/visualization/bus-running-visualization/GraphPanel";
import RouteGroupGraph from "../../../components/visualization/bus-running-visualization/RouteGroupGraph";
import StopGraph from "../../../components/visualization/bus-running-visualization/StopGraph";
import StopChildTimeTable from "../../../components/visualization/bus-running-visualization/StopChildTimeTable";
import { directionMap } from "../../../constant/gtfs";
import StopParentTimeTable from "../../../components/visualization/bus-running-visualization/StopParentTimeTable";
import VisualizationTwoPaneLayout from "../../../components/visualization/VisualizationTwoPaneLayout";
import PageBanner from "../PageBanner";
import { VISUALIZATION_LAYOUT, Z_INDEX } from "../../../constant/ui";
import { VISUALIZATION } from "@/strings";
import { useBusRunningVisualization } from "./hooks/useBusRunningVisualization";

function NumberOfBusRunningVisualization() {
    const {
        scenarioOptions,
        loadingScenario,
        selectedScenario,
        setSelectedScenario,
        routesGroupOption,
        selectedRouteGroups,
        setSelectedRouteGroups,
        directionId,
        serviceIdOptions,
        selectedServiceId,
        setSelectedServiceId,
        groupingoption,
        setGroupingOption,
        activeFilter,
        groupedData,
        routeGroupGraphData,
        stopGraphData,
        stopGraphGrouping,
        edgesData,
        stops,
        poiData,
        populationData,
        loadingFilter,
        showTripNumbersFlag,
        countHitApi,
        mapContainerWidth,
        visibleRouteKeys,
        currentScenarioName,
        serviceLevelDescription,
        selectedStop,
        isStopOpen,
        handleStopDetailClose,
        handleApplyFilter,
        handleResetFilter,
        handleMapRouteGroupsChange,
        handleMapRouteSelect,
        handleStopSelect,
    } = useBusRunningVisualization();

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
            <Backdrop
                open={loadingFilter}
                sx={{ zIndex: Z_INDEX.visualization.busRunningBackdrop }}
            >
                <CircularProgress color="primary" />
            </Backdrop>

            {/* Stop Timetable Dialog */}
            <Dialog
                fullWidth
                maxWidth="xl"
                open={isStopOpen}
                sx={{ zIndex: Z_INDEX.visualization.busRunningDialog }}
                onClose={handleStopDetailClose}
            >
                <DialogContent
                    dividers
                    sx={{ p: 0, zIndex: Z_INDEX.visualization.busRunningDialogContent }}
                >
                    <Box sx={{ height: "60vh", overflow: "auto" }}>
                        {groupingoption === "parent" && selectedStop ? (
                            <StopParentTimeTable
                                data={selectedStop}
                                directionId={directionMap[directionId] || ""}
                                serviceIds={
                                    selectedServiceId.length > 0
                                        ? selectedServiceId
                                        : serviceIdOptions
                                }
                                startTime={activeFilter.startTime}
                                endTime={activeFilter.endTime}
                            />
                        ) : (
                            selectedStop && (
                                <StopChildTimeTable
                                    stopData={selectedStop}
                                    directionId={
                                        directionMap[directionId] || ""
                                    }
                                    serviceIds={
                                        selectedServiceId.length > 0
                                            ? selectedServiceId
                                            : serviceIdOptions
                                    }
                                    startTime={activeFilter.startTime}
                                    endTime={activeFilter.endTime}
                                />
                            )
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button variant="contained" onClick={handleStopDetailClose}>
                        {VISUALIZATION.common.dialog.close}
                    </Button>
                </DialogActions>
            </Dialog>
            <Typography variant="h4" sx={{ mb: 1, fontWeight: 600, ml: 1 }}>
                {VISUALIZATION.titles.busRunningVisualization}
            </Typography>
            <PageBanner
                text={serviceLevelDescription} maxLines={1}
                width={"100%"}
            />
            <VisualizationTwoPaneLayout
                headerHeight={VISUALIZATION_LAYOUT.headerHeight}
                filterPanel={
                    <FilterPanel
                        scenarioOptions={scenarioOptions}
                        loadingScenario={loadingScenario}
                        selectedScenario={selectedScenario}
                        onScenarioChange={setSelectedScenario}
                        routeGroupsOptions={routesGroupOption}
                        selectedRouteGroups={selectedRouteGroups}
                        onRouteGroupsChange={setSelectedRouteGroups}
                        onApplyFilter={handleApplyFilter}
                        serviceIdOptions={serviceIdOptions}
                        selectedServiceId={selectedServiceId}
                        onServiceIdChange={setSelectedServiceId}
                        groupingOption={groupingoption}
                        onGroupingOptionChange={setGroupingOption}
                        onResetFilter={handleResetFilter}
                    />
                }
                graphs={
                    groupedData?.length ||
                        routeGroupGraphData?.length ||
                        (stopGraphData?.group_data || [])?.length ? (
                        <>
                            <GraphPanel
                                groupedData={groupedData}
                                visibleRoutes={visibleRouteKeys}
                                hideZeroSeries
                                scenarioName={currentScenarioName || VISUALIZATION.common.scenarioFallbackName}
                                screenName={VISUALIZATION.titles.busRunningTripCountAnalysis}
                            />
                            <RouteGroupGraph
                                data={routeGroupGraphData}
                                scenarioName={currentScenarioName || VISUALIZATION.common.scenarioFallbackName}
                                screenName={VISUALIZATION.titles.busRunningVisualization}
                            />
                            <StopGraph
                                data={stopGraphData.group_data}
                                stopGroupingMethod={stopGraphGrouping}
                                scenarioName={currentScenarioName || VISUALIZATION.common.scenarioFallbackName}
                                screenName={VISUALIZATION.titles.busRunningVisualization}
                            />
                        </>
                    ) : null
                }
                right={({ containerWidth }) => (
                    <MapVisualization
                        edges={edgesData}
                        stops={stops}
                        routeGroupsOptions={routesGroupOption}
                        selectedRouteGroups={selectedRouteGroups}
                        onRouteGroupsChange={handleMapRouteGroupsChange}
                        containerWidth={mapContainerWidth}
                        onRouteSelect={handleMapRouteSelect}
                        onStopSelect={handleStopSelect}
                        pois={poiData}
                        populationData={populationData}
                        showTripNumbers={showTripNumbersFlag}
                        countHitApi={countHitApi}
                        isUsingStopParent={groupingoption === "parent"}
                        scenarioName={currentScenarioName || VISUALIZATION.common.scenarioFallbackName}
                        screenName={VISUALIZATION.titles.busRunningVisualization}
                    />
                )}
            />
        </Box>
    );
}

export default NumberOfBusRunningVisualization;
