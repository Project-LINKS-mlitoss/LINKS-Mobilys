import React from "react";
import { Alert, Box, CircularProgress, Snackbar, Typography } from "@mui/material";
import OperatingEconomics from "../../components/simulation/operating-economics/OperatingEconomics";
import { useOperatingEconomicsDefaults } from "./hooks/useOperatingEconomicsDefaults";

export default function OperatingEconomicsTab({ simulationId }) {
  const { routes, loading, error, clearError } =
    useOperatingEconomicsDefaults(simulationId);

  if (loading) {
    return (
      <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", maxWidth: "none" }}>
      {error && routes.length === 0 ? (
        <Typography color="text.secondary">{error}</Typography>
      ) : (
        <OperatingEconomics routes={routes} />
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
