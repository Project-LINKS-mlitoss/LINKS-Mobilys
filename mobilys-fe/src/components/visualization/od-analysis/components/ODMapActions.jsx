// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { IconButton, Tooltip as MuiTooltip } from "@mui/material";
import { VISUALIZATION } from "@/strings";

export default function ODMapActions({
  isFullscreen,
  onToggleFullscreen,
  onDownloadPng,
  exporting,
  mapUiZIndex,
}) {
  return (
    <>
      <div data-html2canvas-ignore>
        <MuiTooltip
          title={
            isFullscreen
              ? VISUALIZATION.common.map.fullscreen.exit
              : VISUALIZATION.common.map.fullscreen.enter
          }
        >
          <IconButton
            onClick={onToggleFullscreen}
            sx={{
              position: "absolute",
              top: 16,
              right: 16,
              zIndex: mapUiZIndex,
              bgcolor: "#fff",
              boxShadow: 1,
            }}
            size="large"
            aria-label="fullscreen"
          >
            {isFullscreen ? (
              <span className="material-symbols-outlined outlined">
                fullscreen_exit
              </span>
            ) : (
              <span className="material-symbols-outlined outlined">
                fullscreen
              </span>
            )}
          </IconButton>
        </MuiTooltip>
      </div>

      <MuiTooltip title={VISUALIZATION.common.map.actions.downloadPng}>
        <IconButton
          data-html2canvas-ignore
          onClick={onDownloadPng}
          disabled={exporting}
          sx={{
            position: "absolute",
            top: 16,
            right: 70,
            zIndex: mapUiZIndex,
            bgcolor: "#fff",
            boxShadow: 1,
            opacity: exporting ? 0.6 : 1,
          }}
          size="large"
          aria-label="download map png"
        >
          <span className="material-symbols-outlined outlined">download</span>
        </IconButton>
      </MuiTooltip>

      {exporting && (
        <div
          data-html2canvas-ignore
          style={{
            position: "absolute",
            inset: 0,
            zIndex: mapUiZIndex + 10,
            display: "grid",
            placeItems: "center",
            background: "rgba(255,255,255,0.35)",
            backdropFilter: "blur(0.5px)",
            fontWeight: 700,
          }}
        >
          {VISUALIZATION.common.map.actions.downloading}
        </div>
      )}
    </>
  );
}

