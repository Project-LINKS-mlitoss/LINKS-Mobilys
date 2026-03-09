// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
// src/features/simulation/CO2ReductionTab.jsx
import React from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { useParams } from "react-router-dom";
import CO2Reduction from "../../components/simulation/CO2Reduction/CO2Reduction";
import { SIMULATION } from "@/strings";
import { useCo2Reduction } from "./hooks/useCo2Reduction";

export default function Co2ReductionTab() {
  const { simulationId } = useParams();
  const { routes, loading, error, clearError } = useCo2Reduction(simulationId);
  const strings = SIMULATION.co2Reduction;

  return (
    <Box sx={{ width: "100%" }}>
      {loading ? (
        <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <>
          <CO2Reduction routes={routes} unit={strings.unit} />
          <MetricExplanation />
        </>
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

function RowDef({ label, body }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "240px 1fr" },
        gap: 6,
        alignItems: "start",
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography fontWeight="bold" fontSize={14} noWrap>
          {label}
        </Typography>
      </Box>
      <Typography component="div" sx={{ whiteSpace: "pre-line" }}>
        {body}
      </Typography>
    </Box>
  );
}

function MetricExplanation() {
  const strings = SIMULATION.co2Reduction;

  return (
    <Paper variant="outlined" sx={{ mt: 2, p: 2, borderRadius: 1.5 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        {strings.glossary.title}
      </Typography>
      <Stack
        spacing={2}
        divider={
          <Box sx={{ borderBottom: (t) => `1px solid ${t.palette.divider}` }} />
        }
      >
        {strings.glossary.items.map((item) => (
          <RowDef key={item.label} label={item.label} body={item.body} />
        ))}
      </Stack>
    </Paper>
  );
}

