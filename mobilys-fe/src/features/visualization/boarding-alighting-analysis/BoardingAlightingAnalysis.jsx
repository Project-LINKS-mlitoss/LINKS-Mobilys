import React from "react";
import {
  Box,
  Paper,
  Backdrop,
  CircularProgress,
  Typography,
  Button,
  ButtonGroup,
  TableCell,
  TableRow,
  TableBody,
  TableHead,
  Table,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import { green, red } from "@mui/material/colors";
import ChevronLeft from "@mui/icons-material/ChevronLeft";

import { useBoardingAlightingAnalysis } from "./hooks/useBoardingAlightingAnalysis";

import DataManagement from "../../../components/visualization/boarding-alighting-analysis/DataManagement";
import RoutesVisualization from "../../../components/visualization/boarding-alighting-analysis/RoutesVisualization";
import RouteSegmentVisualization from "../../../components/visualization/boarding-alighting-analysis/RouteSegmentVisualization";
import RouteStopVisualization from "../../../components/visualization/boarding-alighting-analysis/RouteStopVisualization";
import BoardingAlightingMap from "../../../components/visualization/boarding-alighting-analysis/BoardingAlightingMap";
import RouteSegmentMap from "../../../components/visualization/boarding-alighting-analysis/RouteSegmentMap";
import RouteStopMap from "../../../components/visualization/boarding-alighting-analysis/RouteStopMap";
import ClickDetailDialog from "../../../components/visualization/boarding-alighting-analysis/ClickDetailDialog";
import PageBanner from "../PageBanner";
import { VISUALIZATION_LAYOUT, Z_INDEX } from "../../../constant/ui";
import { VISUALIZATION } from "@/strings";

// full-screen dashboard component
import BoardingAlightingDashboard from "../../../components/visualization/boarding-alighting-analysis/BoardingAlightingDashboard";

function BoardingAlightingAnalysis() {
  const {
    showSnackbar,
    scenarioOptions,
    loadingScenario,
    selectedScenario,
    setSelectedScenario,
    activeScenarioName,
    loadingFilter,
    leftRatio,
    mapContainerRef,
    forceUpdate,
    setForceUpdate,
    selectedVisualization,
    setSelectedVisualization,
    visualizationOptions,
    showDashboard,
    setShowDashboard,
    boardingAlightingData,
    allRoutesData,
    routesFilter,
    metric,
    boardingAlightingResult,
    availableRouteGroups,
    keywordRoutesMap,
    routeTripsMap,
    routeSegmentData,
    routeSegmentFilterData,
    routeSegmentGraphData,
    selectedModeSegment,
    setSelectedModeSegment,
    selectedDate,
    setSelectedDate,
    selectedRouteGroup,
    setSelectedRouteGroup,
    selectedRoute,
    setSelectedRoute,
    selectedTrip,
    setSelectedTrip,
    selectedSegment,
    setSelectedSegment,
    selectedTimeRange,
    setSelectedTimeRange,
    selectedStop,
    setSelectedStop,
    routeStopFilterData,
    routeStopGraphData,
    selectedDateStop,
    setSelectedDateStop,
    selectedRouteGroupStop,
    setSelectedRouteGroupStop,
    selectedRouteStop,
    setSelectedRouteStop,
    selectedTripStop,
    setSelectedTripStop,
    selectedModeStop,
    setSelectedModeStop,
    uploadedData,
    showUploadModal,
    setShowUploadModal,
    globalLoading,
    clickDialog,
    handleUploadCSV,
    handleDeleteData,
    handleRoutesFilter,
    handleMetricChange,
    handleMapSegmentClick,
    handleMapStopClick,
    closeClickDialog,
  } = useBoardingAlightingAnalysis();


  const canDoDescription = VISUALIZATION.boardingAlightingAnalysis.canDoDescription;

  // ========= UI =========
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
      <ClickDetailDialog
        open={clickDialog.open}
        mode={clickDialog.mode}
        loading={clickDialog.loading}
        error={clickDialog.error}
        summary={clickDialog.summary}
        onClose={closeClickDialog}
      />

      <Backdrop
        open={loadingFilter || globalLoading}
        sx={{ zIndex: Z_INDEX.visualization.globalLoadingBackdrop }}
      >
        <CircularProgress color="primary" />
      </Backdrop>

      {/* Page heading + banner (only for normal analysis view) */}
      {!showDashboard && (
        <>
          <Typography variant="h4" sx={{ mb: 1, fontWeight: 600, ml: 1 }}>
            {VISUALIZATION.titles.boardingAlightingAnalysis}
          </Typography>
          <PageBanner text={canDoDescription} maxLines={1} width={"100%"} />
        </>
      )}

      {/* ==== MAIN CONTENT: normal analysis vs full-screen dashboard ==== */}
      {showDashboard ? (
        <>
          {/* Back link + dashboard title */}
          <Box sx={{ mt: 1, mb: 1, ml: 1 }}>
            <Button
              variant="text"
              color="primary"
              size="small"
              onClick={() => setShowDashboard(false)}
              startIcon={<ChevronLeft fontSize="small" />}
              sx={{
                px: 0,
                textTransform: "none",
                "&:hover": { backgroundColor: "transparent" },
              }}
            >
              {VISUALIZATION.boardingAlightingAnalysis.backToPage}
            </Button>
          </Box>


          <Typography
            variant="h4"
            sx={{ mb: 1, fontWeight: 600, ml: 1 }}
          >
            {VISUALIZATION.titles.boardingAlightingAnalysis}
          </Typography>

          {/* ---------------- FULL-SCREEN DASHBOARD VIEW ---------------- */}
          <Box
            sx={{
              flex: 1,
              p: 2,
              pt: 1,
              overflow: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <Paper
              sx={{
                flex: 1,
                p: 3,
                boxSizing: "border-box",
                overflow: "auto",
              }}
            >
              <BoardingAlightingDashboard
                scenarioName={activeScenarioName}
                boardingAlightingData={boardingAlightingData}
              />
            </Paper>
          </Box>
        </>
      ) : (
        // ---------------- NORMAL MAP / ANALYSIS VIEW ----------------
        <Box
          sx={{
            height: `calc(100vh - ${VISUALIZATION_LAYOUT.headerHeight}px)`,
            display: "flex",
            flexDirection: "row",
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          {/* Left panel */}
          <Box
            sx={{
              width: `${leftRatio * 100}%`,
              minWidth: VISUALIZATION_LAYOUT.leftPanel.minWidthPx,
              maxWidth: VISUALIZATION_LAYOUT.leftPanel.maxWidthPx,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              gap: 2,
              p: 2,
              overflowY: "auto",
              overflowX: "hidden",
              height: "95%",
              transition: "width 0.3s",
              bgcolor: "#f7f8fa",
            }}
          >
            <DataManagement
              scenarioOptions={scenarioOptions}
              loadingScenario={loadingScenario}
              selectedScenario={selectedScenario}
              onScenarioChange={setSelectedScenario}
              onUploadCSV={handleUploadCSV}
              forceUpdate={forceUpdate}
              setForceUpdate={setForceUpdate}
              handleDeleteData={handleDeleteData}
              showSnackbar={showSnackbar}
              onOpenDashboard={() => setShowDashboard(true)}
            />

            {selectedVisualization === 0 && (
              <RoutesVisualization
                metric={metric}
                boardingAlightingData={boardingAlightingData}
                onChange={handleRoutesFilter}
                disabled={loadingFilter}
                boardingAlightingResult={boardingAlightingResult}
                routeGroupOptions={availableRouteGroups}
                keywordRoutesMap={keywordRoutesMap}
                routeTripsMap={routeTripsMap}
                scenarioName={activeScenarioName}
              />
            )}

            {selectedVisualization === 1 && (
              <RouteSegmentVisualization
                disabled={loadingFilter}
                boardingAlightingData={boardingAlightingData}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                selectedRouteGroup={selectedRouteGroup}
                setSelectedRouteGroup={setSelectedRouteGroup}
                selectedRoute={selectedRoute}
                setSelectedRoute={setSelectedRoute}
                selectedTrip={selectedTrip}
                setSelectedTrip={setSelectedTrip}
                selectedTimeRange={selectedTimeRange}
                setSelectedTimeRange={setSelectedTimeRange}
                selectedMode={selectedModeSegment}
                routeSegmentFilterData={routeSegmentFilterData}
                routeSegmentGraphData={routeSegmentGraphData}
                scenarioName={activeScenarioName}
              />
            )}

            {selectedVisualization === 2 && (
              <RouteStopVisualization
                disabled={loadingFilter}
                boardingAlightingData={boardingAlightingData}
                selectedDate={selectedDateStop}
                setSelectedDate={setSelectedDateStop}
                selectedRouteGroup={selectedRouteGroupStop}
                setSelectedRouteGroup={setSelectedRouteGroupStop}
                selectedRoute={selectedRouteStop}
                setSelectedRoute={setSelectedRouteStop}
                selectedTrip={selectedTripStop}
                setSelectedTrip={setSelectedTripStop}
                selectedTimeRange={selectedTimeRange}
                setSelectedTimeRange={setSelectedTimeRange}
                selectedMode={selectedModeStop}
                routeStopFilterData={routeStopFilterData}
                routeStopGraphData={routeStopGraphData}
                scenarioName={activeScenarioName}
              />
            )}
          </Box>

          {/* Right panel (maps) */}
          <Box
            ref={mapContainerRef}
            sx={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              justifyContent: "flex-start",
              overflow: "hidden",
              p: 2,
              height: "97.5%",
              transition: "width 0.3s",
            }}
          >
            <Box
              sx={{ mb: 2, display: "flex", justifyContent: "center" }}
            >
              <ButtonGroup variant="outlined" color="primary">
                {visualizationOptions.map((label, idx) => (
                  <Button
                    key={label}
                    variant={
                      selectedVisualization === idx
                        ? "contained"
                        : "outlined"
                    }
                    color={
                      selectedVisualization === idx
                        ? "primary"
                        : "inherit"
                    }
                    onClick={() => setSelectedVisualization(idx)}
                    sx={{
                      fontWeight: 700,
                      px: 3,
                      py: 1.2,
                      fontSize: 15,
                      borderRadius: 2,
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </ButtonGroup>
            </Box>

            <Paper
              sx={{
                flex: 1,
                display: "flex",
                alignItems: "stretch",
                justifyContent: "stretch",
                p: 0,
                boxSizing: "border-box",
                overflow: "hidden",
                minHeight: 0,
                height: "100%",
              }}
            >
              {selectedVisualization === 0 && (
                <BoardingAlightingMap
                  selectedVisualization={selectedVisualization}
                  allRoutesData={allRoutesData}
                  boardingAlightingResult={boardingAlightingResult}
                  metric={metric}
                  onMetricChange={handleMetricChange}
                  onSegmentClick={handleMapSegmentClick}
                  onStopClick={handleMapStopClick}
                  scenarioName={activeScenarioName}
                />
              )}

              {selectedVisualization === 1 && (
                <RouteSegmentMap
                  RouteSegmentData={routeSegmentData}
                  selectedMode={selectedModeSegment}
                  setSelectedMode={setSelectedModeSegment}
                  selectedSegment={selectedSegment}
                  setSelectedSegment={setSelectedSegment}
                  allRoutesData={allRoutesData}
                  scenarioName={activeScenarioName}
                />
              )}

              {selectedVisualization === 2 && (
                <RouteStopMap
                  RouteSegmentData={routeSegmentData}
                  selectedMode={selectedModeStop}
                  setSelectedMode={setSelectedModeStop}
                  selectedStop={selectedStop}
                  setSelectedStop={setSelectedStop}
                  allRoutesData={allRoutesData}
                  scenarioName={activeScenarioName}
                />
              )}
            </Paper>
          </Box>
        </Box>
      )}

      {/* Upload summary modal */}
      <Dialog
        open={showUploadModal}
        maxWidth="md"
        fullWidth
        onClose={() => setShowUploadModal(false)}
        sx={{ zIndex: Z_INDEX.visualization.analysisDialog }}
      >
        <DialogTitle>{VISUALIZATION.boardingAlightingAnalysis.upload.resultTitle}</DialogTitle>
        <DialogContent>
          {uploadedData && (
            <>
              {/* 1. Summary */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="body1" sx={{ fontWeight: 700 }}>
                  {VISUALIZATION.common.import.summaryTitle}
                </Typography>

                {(() => {
                  const data = uploadedData.data ?? {};
                  const routes = data.routes ?? [];
                  const trips = data.trips ?? [];
                  const stops = data.stops ?? [];

                  const countValid = (items) =>
                    items.filter((x) => x.is_available).length;
                  const countInvalid = (items) =>
                    items.filter((x) => !x.is_available).length;

                  const summaryItems = [
                    {
                      label: VISUALIZATION.boardingAlightingAnalysis.labels.route,
                      items: routes,
                    },
                    { label: VISUALIZATION.boardingAlightingAnalysis.upload.summary.trip, items: trips },
                    { label: VISUALIZATION.boardingAlightingAnalysis.upload.summary.stop, items: stops },
                  ];

                  return (
                    <Box sx={{ display: "flex", gap: 4, mt: 1 }}>
                      {summaryItems.map(({ label, items }) => (
                        <Box key={label}>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 600 }}
                          >
                            {label}
                          </Typography>
                          <Typography variant="body2">
                            <span
                              style={{
                                color: green[600],
                                fontWeight: 700,
                              }}
                            >
                              {VISUALIZATION.common.labels.valid}: {countValid(items)}
                            </span>
                          </Typography>
                          <Typography variant="body2">
                            <span
                              style={{
                                color: red[600],
                                fontWeight: 700,
                              }}
                            >
                              {VISUALIZATION.common.labels.invalid}: {countInvalid(items)}
                            </span>
                          </Typography>
                          <Typography variant="body2">
                            {VISUALIZATION.common.labels.total}: {items.length}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  );
                })()}
              </Box>

              {(() => {
                const data = uploadedData.data ?? {};
                const routes = data.routes ?? [];
                const trips = data.trips ?? [];
                const stops = data.stops ?? [];

                const renderUnavailableTable = (title, rows, keyField) => (
                  <>
                    <Typography
                      variant="subtitle1"
                      sx={{ mb: 1, fontWeight: 700, color: red[700] }}
                    >
                      {title}
                    </Typography>
                    <Table size="small" sx={{ mb: 2 }}>
                      <TableHead>
                        <TableRow>
                          <TableCell>{keyField}</TableCell>
                          <TableCell align="right">{VISUALIZATION.common.table.status}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rows
                          .filter((row) => !row.is_available)
                          .map((row, idx) => (
                            <TableRow key={row[keyField] ?? idx}>
                              <TableCell>{row[keyField]}</TableCell>
                              <TableCell align="right">
                                <CancelIcon
                                  sx={{
                                    color: red[600],
                                    verticalAlign: "middle",
                                  }}
                                />{" "}
                                <span
                                  style={{
                                    color: red[600],
                                    fontWeight: 700,
                                  }}
                                >
                                  {VISUALIZATION.common.registration.unregistered}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        {rows.filter((row) => !row.is_available).length ===
                          0 && (
                            <TableRow>
                              <TableCell
                                colSpan={2}
                                align="center"
                                sx={{ color: "#888" }}
                              >
                                {VISUALIZATION.common.registration.allRegistered}
                              </TableCell>
                            </TableRow>
                          )}
                      </TableBody>
                    </Table>
                  </>
                );

                const renderAvailableTable = (title, rows, keyField) => (
                  <>
                    <Typography
                      variant="subtitle1"
                      sx={{ mb: 1, fontWeight: 700 }}
                    >
                      {title}
                    </Typography>
                    <Table size="small" sx={{ mb: 2 }}>
                      <TableHead>
                        <TableRow>
                          <TableCell>{keyField}</TableCell>
                          <TableCell align="right">{VISUALIZATION.common.table.status}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rows
                          .filter((row) => row.is_available)
                          .map((row, idx) => (
                            <TableRow key={row[keyField] ?? idx}>
                              <TableCell>{row[keyField]}</TableCell>
                              <TableCell align="right">
                                <CheckCircleIcon
                                  sx={{
                                    color: green[600],
                                    verticalAlign: "middle",
                                  }}
                                />{" "}
                                <span
                                  style={{
                                    color: green[600],
                                    fontWeight: 700,
                                  }}
                                >
                                  {VISUALIZATION.common.registration.registered}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        {rows.filter((row) => row.is_available).length ===
                          0 && (
                            <TableRow>
                              <TableCell
                                colSpan={2}
                                align="center"
                                sx={{ color: "#888" }}
                              >
                                {VISUALIZATION.common.registration.unregisteredOnly}
                              </TableCell>
                            </TableRow>
                          )}
                      </TableBody>
                    </Table>
                  </>
                );

                return (
                  <>
                    {/* 2. Not available */}
                    {renderUnavailableTable(
                      VISUALIZATION.boardingAlightingAnalysis.tables.routesNotInGtfs,
                      routes,
                      "route_id"
                    )}
                    {renderUnavailableTable(
                      VISUALIZATION.boardingAlightingAnalysis.tables.tripsNotInGtfs,
                      trips,
                      "trip_id"
                    )}
                    {renderUnavailableTable(
                      VISUALIZATION.boardingAlightingAnalysis.tables.stopsNotInGtfs,
                      stops,
                      "stop_id"
                    )}

                    {/* 3. Available */}
                    {renderAvailableTable(
                      VISUALIZATION.boardingAlightingAnalysis.tables.validRoutes,
                      routes,
                      "route_id"
                    )}
                    {renderAvailableTable(
                      VISUALIZATION.boardingAlightingAnalysis.tables.validTrips,
                      trips,
                      "trip_id"
                    )}
                    {renderAvailableTable(
                      VISUALIZATION.boardingAlightingAnalysis.tables.validStops,
                      stops,
                      "stop_id"
                    )}
                  </>
                );
              })()}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowUploadModal(false)}
            variant="contained"
            color="primary"
          >
            {VISUALIZATION.common.dialog.close}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default BoardingAlightingAnalysis;
