import React from "react";
import { Paper, Stack, Typography, Box, CircularProgress, Alert } from "@mui/material";
import SpeedChange from "../../components/simulation/speed-change/SpeedChange";
import { SIMULATION } from "@/strings";
import { useSpeedChangeTab } from "./hooks/useSpeedChangeTab";

function RowDef({ label, body }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "240px 1fr" }, gap: 6, alignItems: "start" }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography fontWeight="bold" fontSize={14} noWrap>{label}</Typography>
      </Box>
      <Box sx={{ "& p": { my: 0 } }}>{body}</Box>
    </Box>
  );
}

function MetricExplanation() {
  const strings = SIMULATION.speedChangeTab;
  return (
    <Paper variant="outlined" sx={{ mt: 2, p: 2, borderRadius: 1.5 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        {strings.glossary.title}
      </Typography>
      <Stack spacing={2} divider={<Box sx={{ borderBottom: (t) => `1px solid ${t.palette.divider}` }} />}>
        {strings.glossary.items.map((it) => (
          <RowDef key={it.label} label={it.label} body={<p>{it.body}</p>} />
        ))}
      </Stack>
    </Paper>
  );
}

export default function SpeedChangeTab({ simulationId }) {
  const { loading, error, data, economicsByRoute } = useSpeedChangeTab(simulationId);

  if (loading) {
    return (
      <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", maxWidth: "none" }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <SpeedChange data={data} economicsByRoute={economicsByRoute} />
      <MetricExplanation />
    </Box>
  );
}
