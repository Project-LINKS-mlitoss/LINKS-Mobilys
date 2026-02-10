

import React, { useMemo, useState } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  IconButton,
  Tooltip,
} from "@mui/material";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";

import { useSnackbarStore } from "../../state/snackbarStore";

import { formatJPDateTime } from "../../utils/date";
import PageBanner from "../visualization/PageBanner";
import simulationBannerImg from "../../assets/photos/simulation_banner.png";
import ScenarioSelect from "../../components/shared/ScenarioSelect";
import { SIMULATION } from "@/strings";
import { useSimulationListPage } from "./hooks/useSimulationListPage";

function Simulation() {
  const navigate = useNavigate();
  const strings = SIMULATION.listPage;

  // snackbar
  const showSnackbar = useSnackbarStore((s) => s.showSnackbar);

  // create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [baseScenarioId, setBaseScenarioId] = useState("");
  const [cloneScenarioId, setCloneScenarioId] = useState("");
  const [newSimulationName, setNewSimulationName] = useState("");
  const [creating, setCreating] = useState(false);

  const {
    simulations,
    loadingSimulations,
    errorSimulations,
    allScenarios,
    loadingScenarios,
    errorScenarios,
    refreshScenarios,
    dupCandidates,
    loadingCandidates,
    createSimulation: createSimulationAction,
    renameSimulation: renameSimulationAction,
    deleteSimulation: deleteSimulationAction,
  } = useSimulationListPage(baseScenarioId);

  // inline rename
  const [editingId, setEditingId] = useState(null);
  const [nameDraft, setNameDraft] = useState("");
  const [savingRename, setSavingRename] = useState(false);

  // delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const getSimulationSourceLabel = (source) => {
    const raw = source || strings.table.unknownDash;
    if (!source) return raw;

    const lower = String(source).toLowerCase();

    if (lower === "owned scenario" || lower === "owned simulation") {
      return strings.table.you;
    }

    return raw;
  };

  const shouldShowSimulationSource = (sim) => {
    if (!sim) return false;
    if (!sim.scenario_source) return false;
    return !!sim.project_name;
  };

  // ---------- helpers ----------
  const getScenarioId = (sc) =>
    (typeof sc === "object" && sc?.id) || (typeof sc === "string" && sc) || "";

  const scenarioName = (sc) =>
    (typeof sc === "object" && (sc.scenario_name || sc.name || sc.title)) ||
    (typeof sc === "string" && sc) ||
    "";

  // Names for table (defensive to support older payloads)
  const displayOriginalName = (row) =>
    row.original_scenario_name || scenarioName(row.original_scenario) || "-";

  const displayDuplicatedName = (row) =>
    row.duplicated_scenario_name ||
    scenarioName(row.duplicated_scenario) ||
    row.scenario_name ||
    "-";

  // ---------- actions ----------
  const startEditName = (row) => {
    setEditingId(row.id);
    setNameDraft(row?.name ?? String(row?.id ?? ""));
  };

  const cancelEditName = () => {
    setEditingId(null);
    setNameDraft("");
  };

  const saveEditName = async () => {
    if (editingId == null) return;
    const trimmed = (nameDraft || "").trim();
    if (!trimmed) {
      cancelEditName();
      return;
    }
    const current = simulations.find((x) => x.id === editingId);
    if (current && (current.name ?? "") === trimmed) {
      cancelEditName();
      return;
    }
    try {
      setSavingRename(true);
      await renameSimulationAction(editingId, trimmed);
      showSnackbar({ title: strings.messages.renameSuccess, severity: "success" });
    } catch (err) {
      showSnackbar({
        title: err?.message || strings.messages.renameFailed,
        severity: "error",
      });
    } finally {
      setSavingRename(false);
      cancelEditName();
    }
  };

  const handleOpenDelete = (simulation) => {
    setDeleteTarget(simulation);
    setDeleteOpen(true);
  };

  const deleteSimulation = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSimulationAction(deleteTarget.id);
      showSnackbar({ title: strings.messages.deleteSuccess, severity: "success" });
      setDeleteOpen(false);
      setDeleteTarget(null);
    } catch (err) {
      showSnackbar({
        title: err?.message || strings.messages.deleteFailed,
        severity: "error",
      });
    }
  };

  // ---------- modal open/close ----------
  const handleOpenCreate = () => {
    setBaseScenarioId("");
    setCloneScenarioId("");
    setNewSimulationName("");
    if (allScenarios.length === 0) {
      void refreshScenarios();
    }
    setCreateOpen(true);
  };

  const handleCloseCreate = () => {
    if (creating) return;
    setCreateOpen(false);
  };

  // ---------- derived lists ----------
  const baseScenarioOptions = useMemo(() => allScenarios, [allScenarios]);

  // ---------- create simulation ----------
  const handleCreateSimulation = async () => {
    if (!baseScenarioId || !cloneScenarioId || !newSimulationName.trim())
      return;
    setCreating(true);
    try {
      const payload = {
        original_scenario: baseScenarioId,
        duplicated_scenario: cloneScenarioId,
        name: newSimulationName.trim(),
      };
      const created = await createSimulationAction(payload);
      const createdId = created?.id ?? created?.data?.id ?? created?.simulation_id;
      if (createdId != null) navigate(`/simulation/${createdId}`);
      showSnackbar({
        title: strings.messages.createSuccess,
        severity: "success",
      });
      setCreateOpen(false);
    } catch (err) {
      showSnackbar({
        title: err?.message || strings.messages.createFailed,
        severity: "error",
      });
    } finally {
      setCreating(false);
    }
  };

  const baseScenarioSelectOptions = baseScenarioOptions.map((sc) => ({
    id: getScenarioId(sc),
    scenario_name: scenarioName(sc),
    scenario_source: typeof sc === "object" ? sc?.scenario_source : undefined,
    project_name: typeof sc === "object" ? sc?.project_name : undefined,
  }));

  const cloneScenarioSelectOptions = dupCandidates.map((sc) => ({
    id: getScenarioId(sc),
    scenario_name: scenarioName(sc),
    scenario_source: typeof sc === "object" ? sc?.scenario_source : undefined,
    project_name: typeof sc === "object" ? sc?.project_name : undefined,
  }));

  const isCreateDisabled =
    !baseScenarioId || !cloneScenarioId || !newSimulationName.trim() || creating;

  const SimulationContent = (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography sx={{ whiteSpace: "pre-wrap" }}>
        {strings.banner.modalText}
      </Typography>

      <Box sx={{ mt: 1, textAlign: "center" }}>
        <Box
          component="img"
          src={simulationBannerImg}
          alt={strings.banner.imageAlt}
          sx={{ maxWidth: "100%", height: "auto", borderRadius: 1, boxShadow: 1 }}
        />
      </Box>
    </Box>
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
      <Typography variant="h4" sx={{ fontWeight: 600, ml: 1, mb: 1 }}>
        {strings.title}
      </Typography>
      <PageBanner
        text={strings.banner.description}
        modalContent={SimulationContent}
        maxLines={strings.banner.maxLines}
        width={"100%"}
      />

      <Box sx={{ mb: 2, mt: 2 }}>
        <Button variant="contained" color="primary" onClick={handleOpenCreate}>
          {strings.createButton}
        </Button>
      </Box>

      {errorSimulations && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorSimulations}
        </Alert>
      )}

      {/* === Table styling mengikuti ScenarioTable === */}
      <Paper sx={{ width: "100%", overflowX: "auto", mx: "auto" }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{strings.table.name}</TableCell>
              <TableCell>{strings.table.before}</TableCell>
              <TableCell>{strings.table.after}</TableCell>
              <TableCell>{strings.table.createdAt}</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {loadingSimulations ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : simulations.length > 0 ? (
              simulations.map((s) => {
                const duplicatedId =
                  s.duplicated_scenario_id ||
                  getScenarioId(s.duplicated_scenario) ||
                  s.scenario || // legacy
                  undefined;

                return (
                  <TableRow key={s.id}>
                    {/* Name + inline edit (match ScenarioTable behavior) */}
                    <TableCell sx={{ minWidth: 280 }}>
                      {editingId === s.id ? (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <TextField
                            size="small"
                            value={nameDraft}
                            autoFocus
                            disabled={savingRename}
                            onChange={(e) => setNameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEditName();
                              if (e.key === "Escape") cancelEditName();
                            }}
                            sx={{ maxWidth: 320 }}
                          />
                          <IconButton
                            aria-label={strings.actions.save}
                            onClick={saveEditName}
                            disabled={savingRename}
                          >
                            <CheckIcon />
                          </IconButton>
                          <IconButton
                            aria-label={strings.actions.cancel}
                            onClick={cancelEditName}
                            disabled={savingRename}
                          >
                            <CloseIcon />
                          </IconButton>
                        </Box>
                      ) : (
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            minWidth: 0,
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              flexGrow: 1,
                              minWidth: 0,
                            }}
                          >
                            <Typography noWrap sx={{ maxWidth: "100%" }}>
                              {s.name ?? s.id}
                            </Typography>

                            {shouldShowSimulationSource(s) && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                noWrap
                                sx={{ maxWidth: "100%" }}
                                title={s.scenario_source}
                              >
                                {getSimulationSourceLabel(s.scenario_source)}
                              </Typography>
                            )}
                          </Box>

                          <Tooltip title={strings.actions.editName}>
                            <IconButton
                              size="small"
                              aria-label={strings.actions.editName}
                              onClick={() => startEditName(s)}
                              sx={{ minWidth: 32, p: 0.5 }}
                              color="primary"
                            >
                              <span className="material-symbols-outlined outlined">
                                edit
                              </span>
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )}
                    </TableCell>

                    <TableCell>{displayOriginalName(s)}</TableCell>
                    <TableCell>{displayDuplicatedName(s)}</TableCell>

                    {/* Format tanggal ngikutin ScenarioTable */}
                    <TableCell>
                      {formatJPDateTime(s.created_at)}
                    </TableCell>

                    <TableCell>
                      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                        <Button
                          component={RouterLink}
                          to={`/simulation/${s.id}`}
                          state={duplicatedId ? { scenarioId: duplicatedId } : undefined}
                          variant="outlined"
                          size="small"
                        >
                          {strings.actions.detail}
                        </Button>
                        <Button
                          onClick={() => handleOpenDelete(s)}
                          variant="outlined"
                          size="small"
                        >
                          <span className="material-symbols-outlined outlined">
                            delete
                          </span>
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary">
                    {strings.empty}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>{strings.deleteDialog.title}</DialogTitle>
        <DialogContent>
          <Box mt={1}>
            <Typography>
              {strings.deleteDialog.bodyTemplate(
                deleteTarget?.name ?? deleteTarget?.id
              )}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Box sx={{ flexGrow: 1, display: "flex", justifyContent: "flex-end", gap: 1 }}>
            <Button onClick={() => setDeleteOpen(false)}>
              {strings.actions.cancel}
            </Button>
            <Button variant="contained" color="primary" onClick={deleteSimulation}>
              {strings.actions.delete}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Create Simulation Modal */}
      <Dialog open={createOpen} onClose={handleCloseCreate} fullWidth maxWidth="sm">
        <DialogTitle>{strings.createDialog.title}</DialogTitle>
        <DialogContent dividers>
          {errorScenarios && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorScenarios}
            </Alert>
          )}

          {/* Base (original) scenario */}
          <ScenarioSelect
            scenarioOptions={baseScenarioSelectOptions}
            selectedScenario={baseScenarioId}
            onScenarioChange={(value) => {
              setBaseScenarioId(value);
              setCloneScenarioId("");
            }}
            loadingScenario={loadingScenarios}
            label={strings.createDialog.baseScenario.label}
            labelId="base-scenario-label"
            formControlSx={{ mt: 1.5 }}
            noOptionsText={strings.createDialog.baseScenario.noOptions}
            sourceLabelRequiresProject={true}
          />


          {/* Duplicated (clone) scenario filtered by source_scenario_name */}
          <ScenarioSelect
            scenarioOptions={cloneScenarioSelectOptions}
            selectedScenario={cloneScenarioId}
            onScenarioChange={setCloneScenarioId}
            loadingScenario={loadingCandidates}
            disabled={!baseScenarioId}
            // layout / label
            label={strings.createDialog.cloneScenario.label}
            labelId="clone-scenario-label"
            formControlSx={{ mt: 2 }}
            noOptionsText={strings.createDialog.cloneScenario.noOptions}
            sourceLabelRequiresProject={true}
          />

          <TextField
            fullWidth
            sx={{ mt: 2 }}
            label={strings.createDialog.name.label}
            value={newSimulationName}
            onChange={(e) => setNewSimulationName(e.target.value)}
            placeholder={strings.createDialog.name.placeholder}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreate} disabled={creating}>
            {strings.actions.cancel}
          </Button>
          <Button variant="contained" onClick={handleCreateSimulation} disabled={isCreateDisabled}>
            {creating ? strings.actions.creating : strings.actions.create}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Simulation;
