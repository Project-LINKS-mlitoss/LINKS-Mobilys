// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React, { useState } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { blue, red } from "@mui/material/colors";
import { SIMULATION } from "@/strings";

const legendStrings = SIMULATION.carRouting.legend;

function LegendDot({ color }) {
  return (
    <span
      style={{
        display: "inline-block",
        background: color,
        border: "2px solid #f8fafd",
        borderRadius: "50%",
        width: 10,
        height: 10,
      }}
    />
  );
}

export default function MapLegendEndpoints({
  visible = true,
  startLabel = legendStrings.start,
  endLabel = legendStrings.end,
}) {
  const [open, setOpen] = useState(false);

  if (!visible) {
    return null;
  }

  return (
    <>
      <Box
        sx={{
         position: "absolute",
          bottom: 33,
          right: 95,
          zIndex: 1100,
          width: 48,
          height: 48,
          minWidth: 0,
          minHeight: 0,
          background: "rgba(255,255,255,0.98)",
          borderRadius: 3,
          boxShadow: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          p: 0,
        }}
      >
        <IconButton
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          size="large"
          sx={{
            width: 48,
            height: 48,
            backgroundColor: "rgba(255,255,255,0.98)",
            border: "1px solid #ddd",
            borderRadius: 3,
            boxShadow: 3,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: 0,
            cursor: "pointer",
            "&:hover": {
              backgroundColor: "rgba(255,255,255,1)",
            },
          }}
          aria-label={legendStrings.title}
        >
          <span className="material-symbols-outlined outlined">info</span>
        </IconButton>
      </Box>

      {open && (
        <Box
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          sx={{
            position: "absolute",
            right: 12,
            bottom: 84, 
            zIndex: 5000,
            width: 260,
            borderRadius: 3,
            boxShadow: "0 18px 36px rgba(0,0,0,.22)",
            bgcolor: "rgba(255,255,255,.96)",
            backdropFilter: "blur(6px)",
            p: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
            <Typography sx={{ fontSize: 20, fontWeight: 900, flex: 1 }}>
              {legendStrings.title}
            </Typography>
            <IconButton
              size="small"
              onClick={() => setOpen(false)}
              aria-label={legendStrings.closeAriaLabel}
            >
              <CloseRoundedIcon />
            </IconButton>
          </Box>

          <Box sx={{ display: "grid", rowGap: 1.25 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <LegendDot color={blue[600]} />
              <Typography sx={{ fontSize: 14 }}>{startLabel}</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <LegendDot color={red[600]} />
              <Typography sx={{ fontSize: 14 }}>{endLabel}</Typography>
            </Box>
          </Box>
        </Box>
      )}
    </>
  );
}
