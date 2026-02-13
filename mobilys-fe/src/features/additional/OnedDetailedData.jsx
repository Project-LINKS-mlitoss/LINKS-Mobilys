// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";

import RidershipUploadModal from "../../components/ridership/RidershipUploadModal";
import RidershipUploadList from "../../components/ridership/RidershipUploadList";
import RidershipUploadDetailDialog from "../../components/ridership/RidershipUploadDetailDialog";
import RidershipRecordList from "../../components/ridership/RidershipRecordList";
import { RIDERSHIP } from "../../strings";
import { useOnedDetailedData } from "./hooks/useOnedDetailedData";

export default function OnedDetailedData({ embedded = false }) {
  const {
    showSnackbar,
    subTab,
    setSubTab,
    scenarioOptions,
    scenarioId,
    setScenarioId,
    scenarioLoading,
    scenarioError,
    uploadOpen,
    setUploadOpen,
    uploadsLoading,
    uploadsError,
    uploads,
    uploadsPagination,
    setUploadsPage,
    searchText,
    setSearchText,
    exportingUpload,
    detailOpen,
    closeDetail,
    detailLoading,
    detailError,
    detailData,
    errorGroupPages,
    handleErrorGroupPageChange,
    openDetail,
    uploadOptions,
    recordFilters,
    setRecordFilters,
    recordsLoading,
    recordsError,
    records,
    recordsPagination,
    setRecordsPage,
    confirmDelete,
    deleteTarget,
    deleteLoading,
    closeDeleteDialog,
    runDelete,
    handleExportUpload,
    handleUploaded,
  } = useOnedDetailedData();

  return (
    <Box
      sx={{
        height: "97%",
        overflow: "hidden",
        p: embedded ? 2 : 0,
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          height: embedded ? "100%" : "auto",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems={{ xs: "stretch", md: "center" }}
          justifyContent="space-between"
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {RIDERSHIP.oneDetailed.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {RIDERSHIP.oneDetailed.description}
            </Typography>
          </Box>

          <FormControl sx={{ minWidth: 280 }} disabled={scenarioLoading}>
            <InputLabel id="ridership-scenario-select">
              {RIDERSHIP.oneDetailed.scenarioSelect.label}
            </InputLabel>
            <Select
              labelId="ridership-scenario-select"
              value={scenarioId}
              label={RIDERSHIP.oneDetailed.scenarioSelect.label}
              onChange={(e) => setScenarioId(e.target.value)}
            >
              {scenarioOptions.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        {scenarioError && <Alert severity="error">{scenarioError}</Alert>}
        {!scenarioLoading && !scenarioId && (
          <Alert severity="warning">{RIDERSHIP.oneDetailed.scenarioSelect.missing}</Alert>
        )}

        <Tabs
          value={subTab}
          onChange={(event, value) => {
            void event;
            setSubTab(value);
          }}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: 42 }}
        >
          <Tab label={RIDERSHIP.oneDetailed.tabs.uploads} value="uploads" disableRipple />
          <Tab label={RIDERSHIP.oneDetailed.tabs.records} value="records" disableRipple />
        </Tabs>

        <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          {subTab === "uploads" && (
            <Box sx={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
              {uploadsError && <Alert severity="error">{uploadsError}</Alert>}
              <RidershipUploadList
                uploads={uploads}
                pagination={uploadsPagination}
                loading={uploadsLoading}
                searchText={searchText}
                onSearchTextChange={setSearchText}
                onPageChange={setUploadsPage}
                onOpenUpload={() => setUploadOpen(true)}
                onOpenDetail={openDetail}
                onDelete={confirmDelete}
                onExportUpload={handleExportUpload}
                exporting={exportingUpload}
              />
            </Box>
          )}

          {subTab === "records" && (
            <Box sx={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
              {recordsError && <Alert severity="error">{recordsError}</Alert>}
              {uploadOptions.length === 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {RIDERSHIP.oneDetailed.alerts.recordsNeedUpload}
                </Alert>
              )}
              <RidershipRecordList
                records={records}
                pagination={recordsPagination}
                loading={recordsLoading}
                uploadOptions={uploadOptions}
                filters={recordFilters}
                onFiltersChange={(next) => {
                  setRecordFilters(next);
                  setRecordsPage(1);
                }}
                onPageChange={setRecordsPage}
              />
            </Box>
          )}
        </Box>
      </Paper>

      <RidershipUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        scenarioId={scenarioId}
        onUploaded={handleUploaded}
        showSnackbar={showSnackbar}
      />

      <RidershipUploadDetailDialog
        open={detailOpen}
        onClose={closeDetail}
        detail={detailData}
        loading={detailLoading}
        error={detailError}
        errorGroupPages={errorGroupPages}
        onErrorGroupPageChange={handleErrorGroupPageChange}
      />

      <Dialog
        open={!!deleteTarget}
        onClose={() => (deleteLoading ? null : closeDeleteDialog())}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{RIDERSHIP.oneDetailed.dialog.deleteTitle}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {RIDERSHIP.oneDetailed.dialog.deleteMessage}
          </Typography>
          {deleteTarget?.ridership_record_name && (
            <Typography sx={{ mt: 1, fontWeight: 700 }}>
              {deleteTarget.ridership_record_name}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDeleteDialog} disabled={deleteLoading}>
            {RIDERSHIP.oneDetailed.dialog.cancel}
          </Button>
          <Button color="error" variant="contained" onClick={runDelete} disabled={deleteLoading}>
            {deleteLoading ? RIDERSHIP.oneDetailed.dialog.deleting : RIDERSHIP.oneDetailed.dialog.delete}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
