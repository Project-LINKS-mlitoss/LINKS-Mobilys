// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import { Alert, Box, CircularProgress, Snackbar, Typography } from "@mui/material";
import RidershipChange from "../../components/simulation/ridership-change/RidershipChange";
import { SIMULATION } from "@/strings";
import { useRidershipChange } from "./hooks/useRidershipChange";

export default function RidershipChangeTab({ simulationId }) {
  const {
    routes,
    sensitivityUp,
    sensitivityDown,
    loading,
    error,
    clearError,
  } = useRidershipChange(simulationId);

  if (loading) {
    return (
      <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", maxWidth: "none" }}>
      {routes && routes.length === 0 ? (
        <Typography color="text.secondary">
          {SIMULATION.ridershipChange.empty}
        </Typography>
      ) : (
        <RidershipChange
          routes={routes}
          sensitivityUp={sensitivityUp}
          sensitivityDown={sensitivityDown}
        />
      )}

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={clearError}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" variant="filled">
          {String(error)}
        </Alert>
      </Snackbar>
    </Box>
  );
}
