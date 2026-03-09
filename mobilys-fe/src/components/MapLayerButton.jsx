// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
// MapLayerButton.jsx  — ultra-compact
import React from "react";
import { Box, IconButton, Popover, Typography } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

import { MAP_BASE_LAYER_ITEMS } from "../constant/map.js";
import { UI } from "../constant/ui.js";
import { BUTTONS, MAP as MAP_STRINGS } from "../strings/index.js";

export default function MapLayerButton({ value, onChange }) {
  const [anchorEl, setAnchorEl] = React.useState(null);

  const baseLabels = MAP_STRINGS.baseLayers.labels;
  const { fab, popover, selected: selectedStyle, unselected: unselectedStyle } =
    UI.mapLayerButton;

  return (
    <>
      {/* fixed bottom-right FAB */}
      <Box
        sx={{
          position: "absolute",
          right: fab.rightPx,
          bottom: fab.bottomPx,
          zIndex: fab.zIndex,
        }}
      >
        <IconButton
          onClick={(e) => setAnchorEl(e.currentTarget)}
          size="small"
          sx={{
            width: fab.sizePx,
            height: fab.sizePx,
            bgcolor: fab.bgColor,
            borderRadius: fab.borderRadius,
            boxShadow: fab.shadow,
            "&:hover": { bgcolor: fab.bgColor },
          }}
          aria-label={MAP_STRINGS.baseLayers.aria.open}
        >
          <span className="material-symbols-outlined outlined">layers</span>
        </IconButton>
      </Box>

      <Popover
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorEl={anchorEl}
        // open upward/right-aligned from the button
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "right" }}
        PaperProps={{
          sx: {
            width: `min(${popover.panelWidthPx}px, calc(100vw - 32px))`,
            borderRadius: 2,
            boxShadow: popover.shadow,
            bgcolor: popover.bgColor,
            backdropFilter: "blur(4px)",
            p: 1.25,
          },
        }}
      >
        {/* header row */}
        <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 800, flex: 1 }}>
            {MAP_STRINGS.baseLayers.title}
          </Typography>
          <IconButton
            size="small"
            onClick={() => setAnchorEl(null)}
            aria-label={BUTTONS.common.close}
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* cards grid (4-up) */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: `repeat(4, ${popover.cardWidthPx}px)`,
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          {MAP_BASE_LAYER_ITEMS.map((item) => {
            const selected = item.key === value;
            const label = baseLabels?.[item.key] ?? item.key;
            return (
              <Box
                key={item.key}
                role="button"
                tabIndex={0}
                onClick={() => { onChange?.(item.key); setAnchorEl(null); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    onChange?.(item.key); setAnchorEl(null);
                  }
                }}
                sx={{
                  p: 0.75,
                  width: popover.cardWidthPx,
                  borderRadius: 3,
                  border: selected
                    ? `2px solid ${selectedStyle.borderColor}`
                    : `2px solid ${unselectedStyle.borderColor}`,
                  background: fab.bgColor,
                  boxShadow: selected ? selectedStyle.shadow : "none",
                  cursor: "pointer",
                  userSelect: "none",
                  transition: "transform .08s, box-shadow .18s, border .15s",
                  "&:hover": {
                    transform: "translateY(-1px)",
                    boxShadow: unselectedStyle.hoverShadow,
                  },
                }}
              >
                <img
                  src={item.thumb}
                  alt={label}
                  style={{
                    width: "100%",
                    height: popover.thumbnailHeightPx,
                    objectFit: "cover",
                    borderRadius: 8,
                    display: "block",
                    marginBottom: 6,
                    filter: selected ? "none" : "grayscale(100%) opacity(.75)",
                  }}
                />
                <Typography
                  sx={{
                    fontSize: 13,
                    fontWeight: 800,
                    textAlign: "center",
                    color: selected ? selectedStyle.borderColor : unselectedStyle.labelColor,
                    lineHeight: 1.15,
                  }}
                >
                  {label}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Popover>
    </>
  );
}
