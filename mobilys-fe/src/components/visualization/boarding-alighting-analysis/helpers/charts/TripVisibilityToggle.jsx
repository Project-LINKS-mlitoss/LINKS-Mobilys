import React from "react";
import { Box, Checkbox, FormControlLabel, Typography } from "@mui/material";

export default function TripVisibilityToggle({
  enabled,
  showAllTrips,
  onShowTop10,
  onShowAll,
  labels,
  sx = {},
}) {
  if (!enabled) return null;

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "flex-start",
        gap: 2,
        ...sx,
      }}
    >
      <FormControlLabel
        sx={{ m: 0 }}
        control={
          <Checkbox
            size="small"
            checked={!showAllTrips}
            onChange={onShowTop10}
          />
        }
        label={
          <Typography sx={{ fontSize: 12, color: "#111827" }}>
            {labels?.showTop10}
          </Typography>
        }
      />
      <FormControlLabel
        sx={{ m: 0 }}
        control={
          <Checkbox size="small" checked={showAllTrips} onChange={onShowAll} />
        }
        label={
          <Typography sx={{ fontSize: 12, color: "#111827" }}>
            {labels?.showAllTrips}
          </Typography>
        }
      />
    </Box>
  );
}

