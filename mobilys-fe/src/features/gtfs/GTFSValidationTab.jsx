// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import {
  Box,
  Button,
  Alert,
  CircularProgress,
  Typography,
  Paper,
  Backdrop,
} from "@mui/material";
import GTFSValidationSummary from "../../components/gtfs/validator/GTFSValidationSummary";
import GTFSValidationNotices from "../../components/gtfs/validator/GTFSValidationNotices";
import { UI } from "../../constant";
import { GTFS } from "../../strings";
import { useGtfsValidation } from "./hooks/useGtfsValidation";


export default function GTFSValidationTab({
  scenarioId,
  scenarioName,
  showSnackbar,
  autoRunValidationToken = null,
  onAutoRunConsumed = null,
  autoRunFromExport = false,
}) {
  const {
    report,
    isPosting,
    errorMsg,
    initialLoaded,
    loadingNow,
    hasData,
    runValidation,
  } = useGtfsValidation({ scenarioId, autoRunValidationToken, onAutoRunConsumed });

  const handleRunValidation = async () => {
    if (!scenarioId) return;

    try {
      const res = await runValidation();

      if (showSnackbar) {
        showSnackbar({
          title:
            res?.message ||
            GTFS.validationTab.snackbar.validationTriggered,
          severity: "success",
        });

        if (autoRunFromExport) {
          setTimeout(() => {
            showSnackbar({
              title: GTFS.validationTab.snackbar.exportCompleted,
              severity: "success",
            });
          }, UI.timing.exportCompleteSnackbarDelayMs);
        }
      }
    } catch (err) {
      const msg = err?.message || GTFS.validationTab.errors.runFailed;
      if (showSnackbar) {
        showSnackbar({ title: msg, severity: "error" });
      }
    }
  };

  if (!scenarioId) {
    return (
      <Alert severity="warning">
        {GTFS.validationTab.errors.missingScenarioId}
      </Alert>
    );
  }

  return (
    <>
      <Backdrop
        open={loadingNow}
        sx={{
          color: "#fff",
          zIndex: (theme) => theme.zIndex.modal + 1,
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          <CircularProgress color="primary" />
          <Typography variant="body2" color="primary">
            {GTFS.validationTab.loading.fetchingReport}
          </Typography>
        </Box>
      </Backdrop>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {/* Action buttons */}
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Button
            variant="outlined"
            color="primary"
            onClick={handleRunValidation}
            disabled={loadingNow}
          >
            {isPosting
              ? GTFS.validationTab.actions.running
              : GTFS.validationTab.actions.refresh}
          </Button>
        </Box>

        {errorMsg && <Alert severity="error">{errorMsg}</Alert>}

        {/* EMPTY STATE: no data yet */}
        {!loadingNow && !hasData && !initialLoaded && !errorMsg && (
          <Box
            sx={{
              mt: 4,
              mb: 4,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
              minHeight: 180,
            }}
          >
            <Typography variant="h6" color="text.secondary">
              {GTFS.validationTab.empty.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {GTFS.validationTab.empty.description}
            </Typography>
          </Box>
        )}

        {/* DATA STATE: report available and not loading */}
        {!loadingNow && hasData && (
          <>
            <GTFSValidationSummary
              report={report}
              overrideScenarioName={scenarioName}
            />

            <Paper variant="outlined" sx={{ p: 2 }}>
              <GTFSValidationNotices report={report} />
            </Paper>
          </>
        )}
      </Box>
    </>
  );

}
