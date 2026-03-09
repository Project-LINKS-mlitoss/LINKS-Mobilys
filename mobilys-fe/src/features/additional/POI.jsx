// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import { Box, Divider, Paper, Backdrop, CircularProgress } from "@mui/material";
import "leaflet/dist/leaflet.css";
import { POICsvUploader } from "../../components/poi/POICSVUploader";
import POICheckModal from "../../components/poi/POICheckModal";
import { PoiTable } from "../../components/poi/POITable";
import { PoiMap } from "../../components/poi/POIMap";
import { useAdditionalPoi } from "./hooks/useAdditionalPoi";

export default function POI() {
  const {
    apiData,
    mapData,
    loadingRes,
    files,
    status,
    csvErrors,
    type,
    setType,
    batch,
    setBatch,
    activeBatchId,
    checkOpen,
    setCheckOpen,
    checkData,
    remarksByFile,
    setRemarksByFile,
    committing,
    view,
    setView,
    prefecture,
    availablePrefectures,
    isDefault,
    prefectureLoading,
    prefectureError,
    onFilesSelected,
    onRemoveFile,
    handleRetry,
    handleCheck,
    handleCommit,
    handleDeleteBatch,
    handleSetActiveBatch,
    handleDefaultPrefectureChange,
    handleDownloadTemplate,
  } = useAdditionalPoi();

  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box sx={{ flex: 1, display: "flex", minHeight: 0 }}>
        <Box
          sx={{
            width: 520,
            minWidth: 320,
            p: 2,
            bgcolor: "#fafafa",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          <POICsvUploader
            files={files}
            onFilesSelected={onFilesSelected}
            onRemoveFile={onRemoveFile}
            onCheck={handleCheck}
            onDownload={handleDownloadTemplate}
            errors={csvErrors}
            status={status}
            handleRetry={handleRetry}
            disabled={checkOpen || committing}
            view={view}
            onChangeView={setView}
          />
        </Box>

        <Divider orientation="vertical" flexItem />

        <Box sx={{ flex: 1, p: 2, display: "flex", minWidth: 0 }}>
          {view === "map" ? (
            <Paper sx={{ flex: 1, position: "relative", overflow: "visible" }}>
              {loadingRes && (
                <Backdrop open sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
                  <CircularProgress />
                </Backdrop>
              )}
              {!loadingRes && <PoiMap data={mapData} />}
            </Paper>
          ) : (
            <Paper
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              <PoiTable
                groups={apiData.groups}
                total={apiData.total}
                type={type}
                onChangeType={setType}
                batch={batch}
                onChangeBatch={setBatch}
                onDeleteBatch={handleDeleteBatch}
                activeBatchId={activeBatchId}
                onSetActiveBatch={handleSetActiveBatch}
                prefectureOptions={availablePrefectures}
                selectedPrefecture={prefecture}
                prefectureIsDefault={isDefault}
                prefectureLoading={prefectureLoading}
                prefectureError={prefectureError}
                onChangeDefaultPrefecture={handleDefaultPrefectureChange}
                inlineMaxHeight="fill"
                enableFullscreenToggle
              />
            </Paper>
          )}
        </Box>
      </Box>

      <POICheckModal
        open={checkOpen}
        onClose={() => setCheckOpen(false)}
        checkData={checkData}
        remarksByFile={remarksByFile}
        onChangeRemark={(file, value) =>
          setRemarksByFile((state) => ({ ...state, [file]: value }))
        }
        onCommit={handleCommit}
        committing={committing}
      />

      {committing && (
        <Backdrop open sx={{ zIndex: (t) => t.zIndex.modal + 10 }}>
          <CircularProgress />
        </Backdrop>
      )}
    </Box>
  );
}

