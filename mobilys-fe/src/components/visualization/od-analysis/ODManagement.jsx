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
import { hasCsvInIDB, saveCsvToIDB, removeCsvFromIDB } from "../../../utils/indexDb.js";
import GTFSImportDetailErrorModal from "../../gtfs/GTFSImportDetailErrorModal.jsx";
import ScenarioSelect from "../../shared/ScenarioSelect.jsx";
import { VISUALIZATION } from "@/strings";

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function ensureCsvExt(name = "") {
  return /\.csv$/i.test(name) ? name : `${name}.csv`;
}

function ODManagement({
  scenarioOptions = [],
  loadingScenario = false,
  selectedScenario,
  onScenarioChange,
  onUploadCSV,
  forceUpdate,
  setForceUpdate,
  handleDeleteData,
  showSnackbar,
}) {
  const CSV_TEMPLATE_OD = `date,agency_id,route_id,stopid_geton,stopid_getoff,count
2025-09-01,AG001,RT1001,STOP_A01,STOP_B07,18
2025-09-01,AG001,RT1001,STOP_A02,STOP_B05,7
2025-09-02,AG001,RT2003,STOP_C12,STOP_D09,25`;

  // LocalStorage key for small metadata — namespace 'od-<scenarioId>'
  const csvKey = selectedScenario ? `od-${selectedScenario}` : null;
  const metaKey = csvKey ? `${csvKey}:meta` : null;

  const [status, setStatus] = React.useState(FILE_STATUS.IDLE);
  const [errorMessage, setErrorMessage] = React.useState("");
  const [files, setFiles] = React.useState([]);

  const [errorModalOpen, setErrorModalOpen] = React.useState(false);
  const [errorModalData, setErrorModalData] = React.useState([]);

  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE_OD], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const fname = ensureCsvExt("od_template");
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Small metadata in LocalStorage
  const uploadedInfo = React.useMemo(() => {
    if (!metaKey) return null;
    try {
      const raw = localStorage.getItem(metaKey);
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && typeof obj === "object") return obj;
      }
    } catch { }
    // Support legacy: LocalStorage stored the old object.
    try {
      if (!csvKey) return null;
      const legacy = localStorage.getItem(csvKey);
      const obj = legacy ? JSON.parse(legacy) : null;
      if (obj && typeof obj === "object" && ("filename" in obj || "uploadedAt" in obj)) return obj;
    } catch { }
    return null;
  }, [metaKey, csvKey, forceUpdate]);

  const [isUploaded, setIsUploaded] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedScenario) { setIsUploaded(false); return; }
      const hasIDB = await hasCsvInIDB({ prefix: "od", scenarioId: selectedScenario });
      if (!cancelled) setIsUploaded(hasIDB);
    })();
    return () => { cancelled = true; };
  }, [selectedScenario, forceUpdate]);

  const handleRemoveODData = async () => {
    if (!selectedScenario) return;
    try { await removeCsvFromIDB({ prefix: "od", scenarioId: selectedScenario }); } catch { }
    if (metaKey) localStorage.removeItem(metaKey);
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

      if (!selectedScenario) throw new Error(VISUALIZATION.odAnalysis.components.management.errors.scenarioNotSelected);

      await onUploadCSV?.(file, () => {
        setForceUpdate?.((v) => v + 1);
      });

      await saveCsvToIDB({ prefix: "od", scenarioId: selectedScenario }, file);

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
      const msg = e?.response?.data?.message || e?.message;
      setErrorMessage(
        msg
          ? `${VISUALIZATION.odAnalysis.components.management.errors.importFailed}：${msg}`
          : VISUALIZATION.odAnalysis.components.management.errors.importFailed
      );
      let mainMsg = msg;
      let detailMsg = "";

      if (msg && msg.includes(VISUALIZATION.odAnalysis.components.management.errors.requiredColumnsPrefix)) {
        const parts = msg.split(VISUALIZATION.odAnalysis.components.management.errors.requiredColumnsPrefix);
        mainMsg = parts[0].trim();
        detailMsg =
          VISUALIZATION.odAnalysis.components.management.errors.requiredColumnsPrefix +
          (parts[1]?.trim() || "");
      }

      setErrorMessage(`${VISUALIZATION.odAnalysis.components.management.errors.importFailed}：${mainMsg}`);
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

  const selectedScenarioObj = scenarioOptions.find((opt) => opt.id === selectedScenario);
  const showGtfsWarning =
    selectedScenarioObj &&
    selectedScenarioObj.edit_state === "edited" &&
    Array.isArray(selectedScenarioObj.edited_data) &&
    selectedScenarioObj.edited_data.includes("stops_data");

  const displayFilename = ensureCsvExt(
    uploadedInfo?.filename || VISUALIZATION.odAnalysis.components.management.defaults.uploadedFilename
  );
  const displayDateTimeJp = uploadedInfo?.uploadedAt
    ? new Date(uploadedInfo.uploadedAt).toLocaleString("ja-JP", {
      year: "numeric", month: "numeric", day: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    })
    : "";

  return (
    <Paper elevation={0} sx={{ p: 2 }}>
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h6" fontWeight={700}>
          {VISUALIZATION.odAnalysis.components.management.title}
        </Typography>
      </Box>

      <ScenarioSelect
        scenarioOptions={scenarioOptions}
        selectedScenario={selectedScenario}
        onScenarioChange={onScenarioChange}
        formControlSx={{ mb: 2 }}
        sourceLabelRequiresProject={true}
      />

      {showGtfsWarning && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {VISUALIZATION.odAnalysis.components.management.warnings.gtfsEdited}
        </Alert>
      )}

      {!isUploaded ? (
        <Box sx={{ mt: 2 }}>
          {files.length === 0 ? (
            <FileUploader
              status={status}
              filename={files[0]?.name}
              errorMessage={errorMessage}
              onFileUpload={handleSelectFiles}
              disabled={!selectedScenario}
              requiredValue={VISUALIZATION.odAnalysis.components.management.labels.scenarioRequired}
              multiple={false}
              fileExtensionAllowed={[".csv"]}
              emptyText={VISUALIZATION.odAnalysis.components.management.labels.fileDrop}
              acceptLabel={VISUALIZATION.odAnalysis.components.management.labels.fileAccept}
            />
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

              <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleImportClick}
                  disabled={status === FILE_STATUS.UPLOADING}
                  sx={{ textTransform: "none", minWidth: 120 }}
                >
                  {VISUALIZATION.odAnalysis.components.management.actions.import}
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
                {VISUALIZATION.odAnalysis.components.management.messages.importedData}
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
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {VISUALIZATION.odAnalysis.components.management.labels.filename}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {VISUALIZATION.odAnalysis.components.management.labels.importedAt}
                </Typography>

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
                justifyContent: { xs: "flex-start", sm: "flex-end" },
                justifySelf: { xs: "stretch", sm: "end" },
                width: "100%",
                minWidth: 0,
              }}
            >
              <Button
                variant="outlined"
                color="primary"
                size="small"
                onClick={handleRemoveODData}
                sx={{ textTransform: "none", minWidth: 72 }}
              >
                {VISUALIZATION.odAnalysis.components.management.actions.delete}
              </Button>
            </Box>
          </Paper>
        </Box>
      )}

      {!isUploaded && (<Button
        onClick={handleDownloadTemplate}
        size="small"
        variant="outlined"
        startIcon={<span className="material-symbols-outlined outlined">download</span>}
        sx={{ textTransform: "none", mt: 2 }}
      >
        {VISUALIZATION.odAnalysis.components.management.actions.downloadTemplate}
      </Button>)}

      <Backdrop
        open={status === FILE_STATUS.UPLOADING}
        sx={{ color: "primary.main", zIndex: (t) => t.zIndex.drawer + 2, position: "fixed" }}
      >
        <CircularProgress color="inherit" />
        <Typography sx={{ ml: 2, fontWeight: 500, color: "primary.main" }}>
          {VISUALIZATION.odAnalysis.components.management.messages.importingCsv}
        </Typography>
      </Backdrop>

      <GTFSImportDetailErrorModal
        open={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        errors={errorModalData}
      />
    </Paper>
  );
}

export default ODManagement;
