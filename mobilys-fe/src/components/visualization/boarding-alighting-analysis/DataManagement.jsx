// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  Backdrop,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Divider,
  IconButton,
} from "@mui/material";
import Alert from "@mui/material/Alert";
import FileUploader from "../../FileUploader.jsx";
import { FILE_STATUS } from "../../../constant/file.js";
import { hasCsvInIDB, saveCsvToIDB, removeCsvFromIDB, makeKey } from "../../../utils/indexDb.js";
import GTFSImportDetailErrorModal from "../../gtfs/GTFSImportDetailErrorModal"; // import modal
import ScenarioSelect from "../../shared/ScenarioSelect.jsx";
import { VISUALIZATION } from "@/strings";


function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

// helper: make sure name ends with .csv
function ensureCsvExt(name = "") {
  return /\.csv$/i.test(name) ? name : `${name}.csv`;
}

function DataManagement({
  scenarioOptions = [],
  loadingScenario = false,
  selectedScenario,
  onScenarioChange,
  onUploadCSV,
  forceUpdate,
  setForceUpdate,
  handleDeleteData,
  showSnackbar,
  onOpenDashboard,
}) {
  const csvKey  = selectedScenario ? makeKey({ prefix: "joukou", scenarioId: selectedScenario }) : null;        
  const metaKey = csvKey ? `${csvKey}:meta` : null; 

  const [status, setStatus] = React.useState(FILE_STATUS.IDLE);
  const [errorMessage, setErrorMessage] = React.useState("");
  const [files, setFiles] = React.useState([]); 
  const [isUploaded, setIsUploaded] = React.useState(false);

  // Modal state for GTFSImportDetailErrorModal
  const [errorModalOpen, setErrorModalOpen] = React.useState(false);
  const [errorModalData, setErrorModalData] = React.useState([]);

  const uploadedInfo = React.useMemo(() => {
    if (!metaKey) return null;
    const raw = localStorage.getItem(metaKey);
    if (raw) {
      try {
        const obj = JSON.parse(raw);
        return typeof obj === "object" && obj ? obj : null;
      } catch {}
    }
    try {
      const legacy = localStorage.getItem(csvKey);
      const obj = legacy ? JSON.parse(legacy) : null;
      if (obj && typeof obj === "object" && ("filename" in obj || "uploadedAt" in obj)) {
        return obj;
      }
    } catch {}
    return null;
  }, [metaKey, csvKey, forceUpdate]);

  React.useEffect(() => {
      let cancelled = false;
      (async () => {
        if (!selectedScenario) { setIsUploaded(false); return; }
        const hasIDB = await hasCsvInIDB({ prefix: "joukou", scenarioId: selectedScenario });
        if (!cancelled) setIsUploaded(hasIDB);
      })();
      return () => { cancelled = true; };
   }, [selectedScenario, forceUpdate]);

  const handleRemoveODData = async () => {
    if (!csvKey) return;
    try { await removeCsvFromIDB({ prefix: "joukou", scenarioId: selectedScenario }); } catch {}
    if (metaKey) localStorage.removeItem(metaKey); // metadata
    setForceUpdate?.((v) => v + 1);
    handleDeleteData?.();
  };

  const handleSelectFiles = (selected, error) => {
    if (error) {
      setErrorMessage(error);
      return;
    }
    const arr = Array.isArray(selected) ? selected : [selected];
    setFiles(arr.filter(Boolean).slice(0, 1)); // only 1 csv
  };

  const handleRemoveAt = (idx) => {
    const next = files.slice();
    next.splice(idx, 1);
    setFiles(next);
  };

  const handleImportClick = async () => {
    if (!files.length) return;
      const file = files[0];
    try {
      setErrorMessage("");
      setStatus(FILE_STATUS.UPLOADING);
      if (!selectedScenario) {
        throw new Error(
          VISUALIZATION.boardingAlightingAnalysis.components.dataManagement.errors
            .scenarioNotSelected
        );
      }
      await onUploadCSV?.(file, () => {
        setForceUpdate?.((v) => v + 1);
      });

      await saveCsvToIDB({ prefix: "joukou", scenarioId: selectedScenario }, file);
      if (metaKey) {
        const meta = { filename: file.name, uploadedAt: new Date().toISOString() };
        localStorage.setItem(metaKey, JSON.stringify(meta));
      }

      setFiles([]);
      setStatus(FILE_STATUS.SUCCESS);
      setTimeout(() => setStatus(FILE_STATUS.IDLE), 500);
      setForceUpdate?.((v) => v + 1); 
    } catch (e) {
      setStatus(FILE_STATUS.IDLE);

      // Split error message for modal
      const requiredColumnsPrefix =
        VISUALIZATION.boardingAlightingAnalysis.components.dataManagement.errors
          .requiredColumnsPrefix;
      const importFailed =
        VISUALIZATION.boardingAlightingAnalysis.components.dataManagement.errors.importFailed;

      let msg = e?.response?.data?.message || e?.message || importFailed;
      let mainMsg = msg;
      let detailMsg = "";

      // If message contains a required-columns section, split it for the modal.
      if (msg.includes(requiredColumnsPrefix)) {
        const parts = msg.split(requiredColumnsPrefix);
        mainMsg = parts[0].trim();
        detailMsg = requiredColumnsPrefix + (parts[1]?.trim() || "");
      }

      setErrorMessage(
        `${VISUALIZATION.boardingAlightingAnalysis.components.dataManagement.errors.importFailedWithDetailPrefix}${mainMsg}`
      );
      setErrorModalData([
        {
          file: file?.name,
          row: "1",
          message: mainMsg,
          details: detailMsg,
          source: "internal",
        },
      ]);
      setErrorModalOpen(true);
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob(
      [
        VISUALIZATION.boardingAlightingAnalysis.components.dataManagement
          .csvTemplate,
      ],
      { type: "text/csv;charset=utf-8" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ensureCsvExt(
      VISUALIZATION.boardingAlightingAnalysis.components.dataManagement.filenames
        .templateBase
    );
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const selectedScenarioObj = scenarioOptions.find((opt) => opt.id === selectedScenario);
  const showGtfsWarning =
    selectedScenarioObj &&
    selectedScenarioObj.edit_state === "edited" &&
    Array.isArray(selectedScenarioObj.edited_data) &&
    selectedScenarioObj.edited_data.includes("stops_data");

  const displayFilename = ensureCsvExt(
    uploadedInfo?.filename ||
      VISUALIZATION.boardingAlightingAnalysis.components.dataManagement.filenames
        .defaultDisplayFilename
  );

  const displayDateTimeJp = uploadedInfo?.uploadedAt
    ? new Date(uploadedInfo.uploadedAt).toLocaleString("ja-JP", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "";

  return (
    <Box sx={{ width: "100%" }}>
      <Paper elevation={0} sx={{ p: 2 }}>
        {/* Page Title */}
        <Box sx={{ mb: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="h6" fontWeight={700}>
            {VISUALIZATION.boardingAlightingAnalysis.components.dataManagement.title}
          </Typography>
        </Box>

        {/* Scenario Select */}
        <ScenarioSelect
            scenarioOptions={scenarioOptions}
            selectedScenario={selectedScenario}
            onScenarioChange={onScenarioChange}
            formControlSx={{ mb: 2 }}
            sourceLabelRequiresProject={true} 
          />

        {/* GTFS Warning */}
        {showGtfsWarning && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {VISUALIZATION.boardingAlightingAnalysis.components.dataManagement.gtfsWarning}
          </Alert>
        )}

        {/* Upload / Remove Area */}
        {!isUploaded ? (
          <Box sx={{ mt: 2 }}>
            {files.length === 0 ? (
              <>
                <FileUploader
                  status={status}
                  filename={undefined}
                  errorMessage={errorMessage}
                  onFileUpload={handleSelectFiles}
                  disabled={!selectedScenario}
                  requiredValue={
                    VISUALIZATION.boardingAlightingAnalysis.components.dataManagement
                      .requiredScenario
                  }
                  multiple={false}
                  fileExtensionAllowed={[".csv"]}
                  emptyText={
                    VISUALIZATION.boardingAlightingAnalysis.components.dataManagement
                      .uploader.emptyText
                  }
                  acceptLabel={
                    VISUALIZATION.boardingAlightingAnalysis.components.dataManagement
                      .uploader.acceptLabel
                  }
                />
                <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-start" }}>
                  <Button
                    onClick={handleDownloadTemplate}
                    size="small"
                    variant="outlined"
                    startIcon={
                    <span class="material-symbols-outlined outlined">
                    download
                    </span>}
                    sx={{ textTransform: "none" }}
                  >
                    {VISUALIZATION.boardingAlightingAnalysis.components.dataManagement.actions.downloadTemplate}
                  </Button>
                </Box>
              </>
            ) : (
              <>
                <Paper variant="outlined" sx={{ borderRadius: 2, height: 240, p: 1, overflow: "auto" }}>
                  <List dense disablePadding>
                    {files.map((f, idx) => (
                      <Box key={`${f.name}-${f.size}`}>
                        <ListItem>
                          <ListItemText primary={f.name} />
                          <ListItemText primary={formatBytes(f.size)} />
                          <IconButton edge="end" aria-label="remove" onClick={() => handleRemoveAt(idx)}>
                            <Typography sx={{ fontSize: 18, lineHeight: 1 }}>×</Typography>
                          </IconButton>
                        </ListItem>
                        {idx < files.length - 1 && <Divider component="li" />}
                      </Box>
                    ))}
                  </List>
                </Paper>
                <Box sx={{ display: "flex", justifyContent: "space-between", mt: 2 }}>
                  <Button
                    onClick={handleDownloadTemplate}
                    size="small"
                    variant="outlined"
                    startIcon={
                    <span class="material-symbols-outlined outlined">
                    download
                    </span>}
                    sx={{ textTransform: "none" }}
                  >
                    {VISUALIZATION.boardingAlightingAnalysis.components.dataManagement.actions.downloadTemplate}
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleImportClick}
                    disabled={status === FILE_STATUS.UPLOADING}
                    sx={{ textTransform: "none", minWidth: 120 }}
                  >
                    {VISUALIZATION.boardingAlightingAnalysis.components.dataManagement.actions.import}
                  </Button>
                </Box>
              </>
            )}
          </Box>
        ) : (
         <Box sx={{ mt: 3 }}>
          <Paper
            variant="outlined"
            sx={{
              borderRadius: 2,
              p: 2,
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr auto" },
              alignItems: "center",
              columnGap: 2,
              rowGap: 1.5,
              width: "100%",
              maxWidth: "100%",
              overflow: "hidden",       
              boxSizing: "border-box",     
            }}
          >
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                {VISUALIZATION.boardingAlightingAnalysis.components.dataManagement.labels.importedData}
              </Typography>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "minmax(80px,auto) 180px",
                  rowGap: 0.75,
                  columnGap: 4,
                  alignItems: "center",
                  "& > *": { minWidth: 0 },   
                }}
              >
                {/* header */}
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {VISUALIZATION.boardingAlightingAnalysis.components.dataManagement.labels.filename}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {VISUALIZATION.boardingAlightingAnalysis.components.dataManagement.labels.importedAt}
                </Typography>

                {/* values */}
                <Typography
                  variant="body2"
                  sx={{
                    pr: 2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    minWidth: 0,
                  }}
                  title={displayFilename}
                >
                  {displayFilename}
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: "nowrap", minWidth: 0 }}>
                  {displayDateTimeJp}
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: { xs: "flex-start", sm: "flex-end" },
                justifySelf: { xs: "stretch", sm: "end" },
                width: "100%",
                minWidth: 0,
                gap: 1,
              }}
            >
              <Button
                variant="outlined"
                color="primary"
                size="small"
                onClick={handleRemoveODData}
                sx={{ textTransform: "none", minWidth: 72 }}
              >
                {VISUALIZATION.boardingAlightingAnalysis.components.dataManagement.actions.delete}
              </Button>

              <Button
                variant="contained"
                size="small"
                onClick={onOpenDashboard}
                disabled={!onOpenDashboard}
                sx={{ textTransform: "none", minWidth: 72 }}
              >
                {VISUALIZATION.boardingAlightingAnalysis.components.dataManagement.actions.dashboard}
              </Button>
            </Box>

          </Paper>

        </Box>

        )}

        <Backdrop
          open={status === FILE_STATUS.UPLOADING}
          sx={{ color: "#1976d2", zIndex: (t) => t.zIndex.drawer + 2, position: "fixed" }}
        >
          <CircularProgress color="inherit" />
          <Typography sx={{ ml: 2, fontWeight: 500, color: "#1976d2" }}>
            {VISUALIZATION.boardingAlightingAnalysis.components.dataManagement.statuses.readingCsv}
          </Typography>
        </Backdrop>

        {/* Error Modal */}
        <GTFSImportDetailErrorModal
          open={errorModalOpen}
          onClose={() => setErrorModalOpen(false)}
          errors={errorModalData}
        />
      </Paper>
    </Box>
  );
}

export default DataManagement;
