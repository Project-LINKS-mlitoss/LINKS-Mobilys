import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Backdrop,
} from "@mui/material";
import GTFSExportModal from "../../components/gtfs/GTFSExportModal";
import ScenarioTable from "../../components/gtfs/ScenarioTable";
import { useSnackbarStore } from "../../state/snackbarStore";
import ScenarioAutocomplete from "../../components/shared/ScenarioAutocomplete";
import { SCENARIO } from "../../strings";
import { useGtfsEditEntry } from "./hooks/useGtfsEditEntry";

export default function GTFSEditEntryPage() {
  const navigate = useNavigate();
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const {
    scenarios,
    cloneScenarioOptions,
    existingScenarioNames,
    loading,
    error,
    renameScenario,
    deleteScenario,
    cloneScenario,
    getExportFileTypes,
    exportScenario,
  } = useGtfsEditEntry();

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState(null);
  const [exportModalOpen, setExportModalOpen] = React.useState(false);
  const [exportTarget, setExportTarget] = React.useState(null);
  const [exportFileTypes, setExportFileTypes] = React.useState([]);
  const [cloning, setCloning] = React.useState(false);
  const [cloneOpen, setCloneOpen] = React.useState(false);
  const [newScenarioName, setNewScenarioName] = React.useState("");
  const [cloneScenarioId, setCloneScenarioId] = React.useState("");
  const [newScenarioNameError, setNewScenarioNameError] = React.useState("");

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleDelete = (scenario) => {
    setDeleteTarget(scenario);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deleteScenario(deleteTarget.id);
      showSnackbar({ title: SCENARIO.editEntry.snackbar.deleted, severity: "success" });
      setDeleteOpen(false);
      setDeleteTarget(null);
    } catch (err) {
      showSnackbar({
        title: err?.message || SCENARIO.editEntry.snackbar.deleteFailed,
        severity: "error",
      });
    }
  };

  const buildGtfsExportFilename = (scenario) => {
    return `${SCENARIO.detail.export.exportFilenamePrefix}${scenario.scenario_name}.zip`;
  };

  const handleClose = () => {
    setCloneOpen(false);
    setNewScenarioName("");
    setCloneScenarioId("");
    setNewScenarioNameError("");
  };

  const handleRenameScenario = async (id, newName) => {
    try {
      await renameScenario(id, newName);
      showSnackbar({
        title: SCENARIO.editEntry.snackbar.renamed,
        severity: "success",
      });
    } catch (error) {
      showSnackbar({
        title:
          error?.message || SCENARIO.editEntry.snackbar.renameFailed,
        severity: "error",
      });
    }
  };

  const onExportScenario = async (sc) => {
    setExportTarget(sc);
    setExportFileTypes([]);
    setExportModalOpen(true);
    try {
      const fileTypes = await getExportFileTypes(sc.id);
      setExportFileTypes(fileTypes);
    } catch (err) {
      console.error("Failed to load scenario detail for export", err);
      showSnackbar({
        title: err?.message || SCENARIO.editEntry.snackbar.exportFilesLoadFailed,
        severity: "error",
      });
    }
  };

  const exportWithOptions = async ({
    scenarioId,
    scenario,
    startDate,
    endDate,
    fileTypes,
    onProgress,
  }) => {
    try {
      const blob = await exportScenario({
        scenarioId,
        startDate,
        endDate,
        fileTypes,
        onProgress,
      });

      if (!(blob instanceof Blob)) throw new Error("Export returned invalid data");

      const filename = buildGtfsExportFilename(scenario);
      downloadBlob(blob, filename);

      const sid = scenarioId || scenario?.id;
      if (sid) {
        navigate(`/scenario/${sid}?tab=validation&runValidation=1&exportDone=1`);
      }
    } catch (err) {
      console.error("Export failed:", err);
      showSnackbar({
        title: err?.message || SCENARIO.editEntry.snackbar.exportFailed,
        severity: "error",
      });
    }
  };



    const handleCloneScenario = async () => {
    const errorMsg = validateScenarioName(newScenarioName);
    if (errorMsg) {
      setNewScenarioNameError(errorMsg);
      return;
    }

    setCloning(true);
    try {
      const newId = await cloneScenario({
        sourceScenarioId: cloneScenarioId,
        scenarioName: newScenarioName.trim(),
      });
      if (newId) {
        // no-op: scenario list refresh is handled by the hook
      }

      showSnackbar({ title: SCENARIO.pickerTile.snackbar.cloneSuccess, severity: "success" });
      handleClose();
    } catch (error) {
      showSnackbar({
        title: SCENARIO.pickerTile.snackbar.internalError,
        detail: error?.message || "",
        severity: "error",
      });
    } finally {
      setCloning(false);
    }
  };

  const validateScenarioName = React.useCallback(
    (name) => {
      const v = (name || "").trim();
      if (!v) return SCENARIO.pickerTile.validation.requiredScenarioName;
      if (existingScenarioNames.has(v.toLowerCase())) {
        return SCENARIO.pickerTile.validation.duplicateScenarioName;
      }
      return null;
    },
    [existingScenarioNames]
  );

  return (
		<Box
			sx={{
				height: "86vh",
				boxSizing: "border-box",
				overflow: "visible",
				display: "flex",
				flexDirection: "column",
				mt: -4,
			}}
		>
      {loading && (
        <Backdrop
          open={loading}
          sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}></Backdrop>
      )}
      <Typography variant="h4" sx={{ mb: 1, fontWeight: 600, ml: 1 }}>
        {SCENARIO.editEntry.title}
      </Typography>
      <Button
        variant="contained"
        color="primary"
        onClick={() => setCloneOpen(true)}
        sx={{
          height: 40,
          textTransform: "none",
          whiteSpace: "nowrap",
          flexShrink: 0,
          alignSelf: { xs: "flex-start" },
          mb:2,
        }}>
        {SCENARIO.editEntry.actions.createFromClone}
      </Button>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : (
        <ScenarioTable
          scenarios={scenarios}
          onRenameScenario={handleRenameScenario}
          showDetailScenario
          showDeleteScenario
          onDelete={handleDelete}
          showExportScenario
          showEditGTFSData={true}
          onExportScenario={onExportScenario}
          
        />
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>{SCENARIO.editEntry.deleteDialog.title}</DialogTitle>
        <DialogContent>
          <Box mt={1}>
            <Typography>
              {SCENARIO.editEntry.deleteDialog.messageTemplate.replace(
                "{name}",
                deleteTarget?.scenario_name || ""
              )}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>
            {SCENARIO.editEntry.deleteDialog.cancel}
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleConfirmDelete}
            disabled={loading}
          >
            {SCENARIO.editEntry.deleteDialog.confirm}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog 
        open={cloneOpen} 
        onClose={cloning ? undefined : handleClose}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{SCENARIO.pickerTile.cloneDialog.title}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, display: "grid", gap: 2 }}>
            <ScenarioAutocomplete
                options={cloneScenarioOptions}
                valueId={cloneScenarioId}
                onChangeId={setCloneScenarioId}
                label={SCENARIO.pickerTile.cloneDialog.sourceLabel}
                placeholder={SCENARIO.pickerTile.cloneDialog.sourcePlaceholder}
                size="large"
                sourceLabelRequiresProject={true}
              />

            <TextField
              fullWidth
              variant="outlined"
              label={SCENARIO.pickerTile.cloneDialog.nameLabel}
              placeholder={SCENARIO.pickerTile.cloneDialog.namePlaceholder}
              value={newScenarioName}
              onChange={(e) => {
                const value = e.target.value;
                setNewScenarioName(value);
                setNewScenarioNameError(validateScenarioName(value));
              }}
              error={Boolean(newScenarioNameError)}
              helperText={newScenarioNameError || " "}
            />
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} disabled={cloning}>
            {SCENARIO.pickerTile.cloneDialog.cancel}
          </Button>
          <Button
            variant="contained"
            onClick={handleCloneScenario}
            disabled={
              cloning ||
              !newScenarioName.trim() ||
              !cloneScenarioId ||
              Boolean(newScenarioNameError)
            }
          >
            {SCENARIO.pickerTile.cloneDialog.submit}
          </Button>
        </DialogActions>
        <Backdrop
          open={cloning}
          sx={{
            position: "absolute",
            zIndex: (theme) => theme.zIndex.modal + 1,
          }}
        >
          <CircularProgress />
        </Backdrop>
      </Dialog>

      <GTFSExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        scenario={exportTarget}
        fileTypes={exportFileTypes}
        onConfirm={exportWithOptions}
      />
    </Box>
  );
}
