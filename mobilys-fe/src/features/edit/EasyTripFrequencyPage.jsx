// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
// src/features/edit/EasyTripFrequencyPage.jsx
import React from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Backdrop,
} from "@mui/material";
import FrequencyEditorPage from "../../components/edit/TripFrequencyEdit/FrequencyEditorPage";
import { useSnackbarStore } from "../../state/snackbarStore";
import ScenarioAutocomplete from "../../components/shared/ScenarioAutocomplete";
import { ROUTE, SCENARIO } from "../../strings";
import { useEasyTripFrequency } from "./hooks/useEasyTripFrequency";

const EasyTripFrequencyPage = () => {
  const showSnackbar = useSnackbarStore((s) => s.showSnackbar);

  const {
    loadError,
    scenarioOptions,
    loadingScenarios,
    selectedScenarioId,
    setSelectedScenarioId,

    routeGroups,
    setTripResult,
    initialLoading,
    refreshing,
    saving,
    resetSignal,

    dialogOpen,
    openDialog,
    closeDialog,
    baseScenarioId,
    setBaseScenarioId,
    newScenarioName,
    setNewScenarioName,
    newScenarioNameError,
    setNewScenarioNameError,
    creating,
    validateScenarioName,
    createScenario,
    save,
  } = useEasyTripFrequency();

  const handleSave = async () => {
    try {
      await save();
      showSnackbar({ title: ROUTE.easyTripFrequency.snackbar.saved, severity: "success" });
    } catch (e) {
      showSnackbar({
        title: e?.message || ROUTE.easyTripFrequency.snackbar.saveFailed,
        severity: "error",
      });
    }
  };

  const handleCreateScenario = async () => {
    try {
      const newId = await createScenario();
      if (newId) {
        showSnackbar({
          title: ROUTE.easyTripFrequency.snackbar.scenarioCreated,
          severity: "success",
        });
      }
    } catch (e) {
      showSnackbar({
        title: e?.message || ROUTE.easyTripFrequency.snackbar.scenarioCreateFailed,
        severity: "error",
      });
    }
  };

  // --------- render ----------
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
      {/* ========== STICKY HEADER AREA ========== */}
      <Box
        sx={{
          flexShrink: 0,
          bgcolor: "background.paper",
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
          pb: 2,
          zIndex: 10,
        }}
      >
        {/* Title */}
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 600, ml: 1 }}>
          {ROUTE.easyTripFrequency.title}
        </Typography>

        {loadError && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="error">
              {loadError}
            </Typography>
          </Box>
        )}

        {/* Top bar: scenario picker + clone button */}
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "stretch", sm: "flex-end" },
            gap: 2,
            mb: 2,
            width: "100%",
          }}
        >
          <Box
            sx={{
              minWidth: { xs: "100%", sm: 260 },
              maxWidth: { xs: "100%", sm: 400 },
              flexShrink: 1,
            }}
          >
            <ScenarioAutocomplete
              options={scenarioOptions}
              loading={loadingScenarios}
              valueId={selectedScenarioId}
              onChangeId={setSelectedScenarioId}
              label={ROUTE.easyTripFrequency.scenarioPicker.label}
              placeholder={ROUTE.easyTripFrequency.scenarioPicker.placeholder}
              size="small"
              sourceLabelRequiresProject={true}
            />
          </Box>

          <Button
            variant="contained"
            onClick={openDialog}
            disabled={loadingScenarios || scenarioOptions.length === 0}
            sx={{
              height: 40,
              textTransform: "none",
              whiteSpace: "nowrap",
              flexShrink: 0,
              alignSelf: { xs: "flex-start", sm: "flex-end" },
            }}
          >
            {ROUTE.easyTripFrequency.actions.createScenarioFromClone}
          </Button>
        </Box>

        {/* Save button */}
        {selectedScenarioId && !initialLoading && (
          <Button
            variant="outlined"
            onClick={handleSave}
            disabled={saving || refreshing}
          >
            {ROUTE.easyTripFrequency.actions.save}
          </Button>
        )}
      </Box>

      {/* ========== SCROLLABLE CONTENT AREA ========== */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          width: "100%",
          maxWidth: "100%",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {!selectedScenarioId && !loadingScenarios && (
          <Box sx={{ pt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {ROUTE.easyTripFrequency.helper.selectScenario}
            </Typography>
          </Box>
        )}

        {selectedScenarioId &&
          (initialLoading ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100%",
              }}
            >
              <CircularProgress />
            </Box>
          ) : (
            <FrequencyEditorPage
              scenarioId={selectedScenarioId}
              routeGroups={routeGroups}
              onChange={(updated) => setTripResult(updated)}
              resetSignal={resetSignal}
              refreshing={saving || refreshing}
            />
          ))}
      </Box>

      {/* New scenario dialog */}
      <Dialog
        open={dialogOpen}
        onClose={creating ? undefined : closeDialog}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            m: { xs: 2, sm: 3 },
            maxWidth: { xs: "calc(100% - 32px)", sm: "600px" },
          },
        }}
      >
        <DialogTitle>{SCENARIO.pickerTile.cloneDialog.title}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, display: "grid", gap: 2 }}>
            <ScenarioAutocomplete
              options={scenarioOptions}
              valueId={baseScenarioId}
              onChangeId={setBaseScenarioId}
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
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog} disabled={creating}>
            {SCENARIO.pickerTile.cloneDialog.cancel}
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateScenario}
            disabled={
              !baseScenarioId ||
              !newScenarioName.trim() ||
              Boolean(newScenarioNameError) ||
              creating
            }
          >
            {SCENARIO.pickerTile.cloneDialog.submit}
          </Button>
        </DialogActions>
        <Backdrop
          open={creating}
          sx={{
            position: "absolute",
            zIndex: (theme) => theme.zIndex.modal + 1,
          }}
        >
          <CircularProgress />
        </Backdrop>

      </Dialog>
    </Box>
  );
};

export default EasyTripFrequencyPage;
