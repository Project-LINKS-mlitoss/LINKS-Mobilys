// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
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

import ODManagement from "../../../components/visualization/od-analysis/ODManagement";
import ODUsageDistribution from "../../../components/visualization/od-analysis/ODUsageDistribution";
import ODLastFirstStop from "../../../components/visualization/od-analysis/ODLastFirstStop";
import ODBusStop from "../../../components/visualization/od-analysis/ODBusStop";
import ODMap from "../../../components/visualization/od-analysis/ODMap";

import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import { green, red } from "@mui/material/colors";

import PageBanner from "../PageBanner";
import { VISUALIZATION_LAYOUT, Z_INDEX } from "../../../constant/ui";
import { VISUALIZATION } from "@/strings";
import { useODDataAnalysis } from "./hooks/useODDataAnalysis";

function ODDataAnalysis() {
  const {
    showSnackbar,
    scenarioOptions,
    loadingScenario,
    selectedScenario,
    setSelectedScenario,
    loadingFilter,
    leftRatio,
    handleToggleLeft,
    mapContainerRef,
    mapContainerWidth,
    forceUpdate,
    setForceUpdate,
    selectedVisualization,
    setSelectedVisualization,
    allRoutesData,
    uploadedData,
    showUploadModal,
    setShowUploadModal,
    visualizationOptions,
    canDoDescription,
    currentScenarioName,
    handleUploadCSV,
    handleDeleteData,
    oDUsageDistributionData,
    oDUsageDistributionDateOptions,
    oDUsageDistributionMode,
    setODUsageDistributionMode,
    oDUsageDistributionSelectedDate,
    setODUsageDistributionSelectedDate,
    oDUsageDistributionSelectedPoint,
    setODUsageDistributionSelectedPoint,
    oDLastFirstStopData,
    oDLastFirstStopSelectedPoint,
    setODLastFirstStopSelectedPoint,
    oDLastFirstStopSelectedMode,
    setODLastFirstStopSelectedMode,
    oDLastFirstStopSelectedDate,
    setODLastFirstStopSelectedDate,
    oDLastFirstStopDateOptions,
    oDBusStopData,
    oDBusStopDateOptions,
    oDBusStopSelectedDate,
    setODBusStopSelectedDate,
    oDBusStopSelectedPoint,
    setODBusStopSelectedPoint,
    oDBusStopLayer,
    setODBusStopLayer,
  } = useODDataAnalysis();

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
      <Backdrop open={loadingFilter} sx={{ zIndex: Z_INDEX.visualization.odFilterBackdrop }}>
        <CircularProgress color="primary" />
      </Backdrop>

      <Typography variant="h4" sx={{ mb: 1, fontWeight: 600, ml: 1 }}>
        {VISUALIZATION.titles.odAnalysis}
      </Typography>
      <PageBanner
        text={canDoDescription}
        maxLines={1}
        width={"100%"}
      />

      {/* Main */}
      <Box
        sx={{
          height: `calc(100vh - ${VISUALIZATION_LAYOUT.headerHeight}px)`,
          display: "flex",
          flexDirection: "row",
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        {/* Left */}
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
          <ODManagement
            scenarioOptions={scenarioOptions}
            loadingScenario={loadingScenario}
            selectedScenario={selectedScenario}
            onScenarioChange={setSelectedScenario}
            onUploadCSV={handleUploadCSV}
            forceUpdate={forceUpdate}
            setForceUpdate={setForceUpdate}
            handleDeleteData={handleDeleteData}
            showSnackbar={showSnackbar}
          />

          {selectedVisualization === 0 && (
            <ODUsageDistribution
              oDUsageDistributionData={oDUsageDistributionData}
              oDUsageDistributionDateOptions={oDUsageDistributionDateOptions}
              selectedDate={oDUsageDistributionSelectedDate}
              setSelectedDate={setODUsageDistributionSelectedDate}
              mode={oDUsageDistributionMode}
              setSelectedPoint={setODUsageDistributionSelectedPoint}
              scenarioName={currentScenarioName}
              screenName={VISUALIZATION.titles.odAnalysis}
            />
          )}

          {selectedVisualization === 1 && (
            <ODLastFirstStop
              oDLastFirstStopSelectedPoint={oDLastFirstStopSelectedPoint}
              oDLastFirstStopSelectedMode={oDLastFirstStopSelectedMode}
              dateOptions={oDLastFirstStopDateOptions}
              oDLastFirstStopSelectedDate={oDLastFirstStopSelectedDate}
              setODLastFirstStopSelectedDate={setODLastFirstStopSelectedDate}
              scenarioName={currentScenarioName}
              screenName={VISUALIZATION.titles.odAnalysis}
            />
          )}

          {selectedVisualization === 2 && (
            <ODBusStop
              oDBusStopData={oDBusStopData}
              dateOptions={oDBusStopDateOptions}
              oDBusStopSelectedDate={oDBusStopSelectedDate}
              setODBusStopSelectedDate={setODBusStopSelectedDate}
              oDBusStopSelectedPoint={oDBusStopSelectedPoint}
              setODBusStopSelectedPoint={setODBusStopSelectedPoint}
              oDBusStopLayer={oDBusStopLayer}
              setODBusStopLayer={setODBusStopLayer}
              scenarioName={currentScenarioName}
              screenName={VISUALIZATION.titles.odAnalysis}
            />
          )}
        </Box>

        {/* Right */}
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
          <Box sx={{ mb: 2, display: "flex", justifyContent: "center" }}>
            <ButtonGroup variant="outlined" color="primary">
              {visualizationOptions.map((label, idx) => (
                <Button
                  key={label}
                  variant={selectedVisualization === idx ? "contained" : "outlined"}
                  color={selectedVisualization === idx ? "primary" : "inherit"}
                  onClick={() => setSelectedVisualization(idx)}
                  sx={{ fontWeight: 700, px: 3, py: 1.2, fontSize: 15, borderRadius: 2 }}
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
            <ODMap
              allRoutesData={allRoutesData}
              containerWidth={mapContainerWidth}
              selectedVisualization={selectedVisualization}
              /* vis 0 */
              oDUsageDistributionData={oDUsageDistributionData}
              oDUsageDistributionSelectedPoint={oDUsageDistributionSelectedPoint}
              oDUsageDistributionSelectedMode={oDUsageDistributionMode}
              setODUsageDistributionSelectedMode={setODUsageDistributionMode}
              /* vis 1 */
              oDLastFirstStopData={oDLastFirstStopData}
              oDLastFirstStopSelectedPoint={oDLastFirstStopSelectedPoint}
              setODLastFirstStopSelectedPoint={setODLastFirstStopSelectedPoint}
              oDLastFirstStopSelectedMode={oDLastFirstStopSelectedMode}
              setODLastFirstStopSelectedMode={setODLastFirstStopSelectedMode}
              /* vis 2 */
              oDBusStopData={oDBusStopData}
              oDBusStopSelectedPoint={oDBusStopSelectedPoint}
              setODBusStopSelectedPoint={setODBusStopSelectedPoint}
              oDBusStopLayer={oDBusStopLayer}
              //file name standardization
              scenarioName={currentScenarioName}
              screenName={VISUALIZATION.titles.odAnalysis}
            />
          </Paper>
        </Box>
      </Box>

      {/* Upload summary modal */}
      <Dialog
        open={showUploadModal}
        maxWidth="md"
        fullWidth
        onClose={() => setShowUploadModal(false)}
        sx={{ zIndex: Z_INDEX.visualization.analysisDialog }}
      >
        <DialogTitle>{VISUALIZATION.odAnalysis.upload.resultTitle}</DialogTitle>
        <DialogContent>
          {uploadedData && (
            <>
              <Box sx={{ mb: 3 }}>
                <Typography variant="body1" sx={{ fontWeight: 700 }}>
                  {VISUALIZATION.common.import.summaryTitle}
                </Typography>
                <Box sx={{ display: "flex", gap: 4, mt: 1 }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {VISUALIZATION.odAnalysis.upload.getonStops}
                    </Typography>
                    <Typography variant="body2">
                      <span style={{ color: green[600], fontWeight: 700 }}>
                        {VISUALIZATION.common.labels.valid}: {uploadedData.available_geton_data}
                      </span>
                    </Typography>
                    <Typography variant="body2">
                      <span style={{ color: red[600], fontWeight: 700 }}>
                        {VISUALIZATION.common.labels.invalid}: {uploadedData.not_available_geton_data}
                      </span>
                    </Typography>
                    <Typography variant="body2">
                      {VISUALIZATION.common.labels.total}: {uploadedData.total_data_stopid_geton_uploaded}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {VISUALIZATION.odAnalysis.upload.getoffStops}
                    </Typography>
                    <Typography variant="body2">
                      <span style={{ color: green[600], fontWeight: 700 }}>
                        {VISUALIZATION.common.labels.valid}: {uploadedData.available_getoff_data}
                      </span>
                    </Typography>
                    <Typography variant="body2">
                      <span style={{ color: red[600], fontWeight: 700 }}>
                        {VISUALIZATION.common.labels.invalid}: {uploadedData.not_available_getoff_data}
                      </span>
                    </Typography>
                    <Typography variant="body2">
                      {VISUALIZATION.common.labels.total}: {uploadedData.total_data_stopid_getoff_uploaded}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 700, color: red[700] }}>
                {VISUALIZATION.odAnalysis.upload.invalidRecordsTitle}
              </Typography>
              <Table size="small" sx={{ mb: 2 }}>
                <colgroup>
                  <col style={{ width: VISUALIZATION_LAYOUT.tables.rowIndexColWidthPx }} />
                  <col />
                  <col style={{ width: VISUALIZATION_LAYOUT.tables.statusColWidthPx }} />
                </colgroup>

                <TableHead>
                  <TableRow>
                    <TableCell>{VISUALIZATION.odAnalysis.upload.tableHeaders.row}</TableCell>
                    <TableCell align="left">{VISUALIZATION.odAnalysis.upload.tableHeaders.reason}</TableCell>
                    <TableCell
                      align="right"
                      sx={{ whiteSpace: "nowrap", wordBreak: "keep-all" }}
                    >
                      {VISUALIZATION.common.table.status}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {uploadedData?.invalid_data?.length > 0 ? (
                    uploadedData.invalid_data.map((item, idx) => {
                      const reason = Object.values(item.errors || {}).join(" / ");
                      return (
                        <TableRow key={`invalid-${idx}-${item.row_index}`}>
                          <TableCell>{(item.row_index ?? idx) + 1}</TableCell>
                          <TableCell align="left">{reason}</TableCell>
                          <TableCell
                            align="right"
                            sx={{ whiteSpace: "nowrap", wordBreak: "keep-all" }}
                          >
                            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                              <CancelIcon sx={{ color: red[600], verticalAlign: "middle" }} />
                              <span style={{ color: red[600], fontWeight: 500 }}>
                                {VISUALIZATION.common.labels.invalid}
                              </span>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ color: "#888" }}>
                        {VISUALIZATION.odAnalysis.upload.noInvalidRows}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 700, color: red[700] }}>
                {VISUALIZATION.odAnalysis.upload.gtfsMissingGetonStops}
              </Typography>
              <Table size="small" sx={{ mb: 2 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>stop_id</TableCell>
                    <TableCell align="right">{VISUALIZATION.common.table.status}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {uploadedData.stopid_geton?.filter((row) => !row.is_available).map((row, idx) => (
                    <TableRow key={row.stop_id + idx}>
                      <TableCell>{row.stop_id}</TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                          <CancelIcon sx={{ color: red[600], verticalAlign: "middle" }} />
                          <span style={{ color: red[600], fontWeight: 700 }}>
                            {VISUALIZATION.common.registration.unregistered}
                          </span>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                  {uploadedData.stopid_geton?.filter((row) => !row.is_available).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} align="center" sx={{ color: "#888" }}>
                        {VISUALIZATION.common.registration.allRegistered}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 700, color: red[700] }}>
                {VISUALIZATION.odAnalysis.upload.gtfsMissingGetoffStops}
              </Typography>
              <Table size="small" sx={{ mb: 2 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>stop_id</TableCell>
                    <TableCell align="right">{VISUALIZATION.common.table.status}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {uploadedData.stopid_getoff?.filter((row) => !row.is_available).map((row, idx) => (
                    <TableRow key={row.stop_id + idx}>
                      <TableCell>{row.stop_id}</TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                          <CancelIcon sx={{ color: red[600], verticalAlign: "middle" }} />
                          <span style={{ color: red[600], fontWeight: 700 }}>
                            {VISUALIZATION.common.registration.unregistered}
                          </span>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                  {uploadedData.stopid_getoff?.filter((row) => !row.is_available).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} align="center" sx={{ color: "#888" }}>
                        {VISUALIZATION.common.registration.allRegistered}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 700, color: green[700] }}>
                {VISUALIZATION.odAnalysis.upload.gtfsAvailableGetonStops}
              </Typography>
              <Table size="small" sx={{ mb: 2 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>stop_id</TableCell>
                    <TableCell align="right">{VISUALIZATION.common.table.status}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {uploadedData.stopid_geton?.filter((row) => row.is_available).map((row, idx) => (
                    <TableRow key={row.stop_id + idx}>
                      <TableCell>{row.stop_id}</TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                          <CheckCircleIcon sx={{ color: green[600], verticalAlign: "middle" }} />
                          <span style={{ color: green[600], fontWeight: 700 }}>
                            {VISUALIZATION.common.registration.registered}
                          </span>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                  {uploadedData.stopid_geton?.filter((row) => row.is_available).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} align="center" sx={{ color: "#888" }}>
                        {VISUALIZATION.common.registration.unregisteredOnly}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 700, color: green[700] }}>
                {VISUALIZATION.odAnalysis.upload.gtfsAvailableGetoffStops}
              </Typography>
              <Table size="small" sx={{ mb: 2 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>stop_id</TableCell>
                    <TableCell align="right">{VISUALIZATION.common.table.status}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {uploadedData.stopid_getoff?.filter((row) => row.is_available).map((row, idx) => (
                    <TableRow key={row.stop_id + idx}>
                      <TableCell>{row.stop_id}</TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                          <CheckCircleIcon sx={{ color: green[600], verticalAlign: "middle" }} />
                          <span style={{ color: green[600], fontWeight: 700 }}>
                            {VISUALIZATION.common.registration.registered}
                          </span>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                  {uploadedData.stopid_getoff?.filter((row) => row.is_available).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} align="center" sx={{ color: "#888" }}>
                        {VISUALIZATION.common.registration.unregisteredOnly}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>



            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowUploadModal(false)} variant="contained" color="primary">
            {VISUALIZATION.common.dialog.close}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}

export default ODDataAnalysis;
