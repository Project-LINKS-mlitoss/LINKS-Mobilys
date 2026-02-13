// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import { useSnackbarStore } from "../state/snackbarStore";
import { Typography, Box, IconButton, Tooltip } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { UI } from "../constant/ui.js";

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
  } else {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
}

function isLongContent(text) {
  if (!text) return false;
  return (
    text.length > UI.globalSnackbar.longContent.maxChars ||
    text.split("\n").length > UI.globalSnackbar.longContent.maxLines
  );
}

export default function GlobalSnackbar() {
  const { open, title, detail, severity, closeSnackbar } = useSnackbarStore();
  const normalizedDetail = Array.isArray(detail)
    ? detail.join("\n")
    : detail || "";

  const showScrollAndCopy = isLongContent(normalizedDetail);

  return (
    <Snackbar
      open={open}
      autoHideDuration={UI.globalSnackbar.autoHideDurationMs}
      onClose={closeSnackbar}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}>
      <Alert
        onClose={closeSnackbar}
        severity={severity}
        sx={{
          width: "100%",
          maxWidth: UI.globalSnackbar.maxWidthPx,
          p: UI.globalSnackbar.padding,
          boxSizing: "border-box",
          position: "relative",
        }}>
        <Typography
          fontWeight="bold"
          variant="subtitle2"
          sx={{ mb: UI.globalSnackbar.titleMarginBottom, pr: 4 }}
        >
          {title}
        </Typography>
        <Box
          sx={{
            position: "relative",
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-start",
            pr: 0,
          }}>
          <Box
            sx={{
              flex: 1,
              maxHeight: showScrollAndCopy
                ? UI.globalSnackbar.longContent.maxHeightPx
                : "none",
              overflowY: showScrollAndCopy ? "auto" : "visible",
              whiteSpace: "pre-line",
              wordBreak: "break-all",
              fontSize: 14,
              pr: showScrollAndCopy ? 3 : 0,
              background: "transparent",
              "&::-webkit-scrollbar": showScrollAndCopy
                ? { width: UI.globalSnackbar.longContent.scrollbarWidthPx }
                : {},
            }}
            component="span"
            title={normalizedDetail}>
            {normalizedDetail}
          </Box>
          {showScrollAndCopy && (
            <Box
              sx={{
                position: "absolute",
                top: 0,
                right: 0,
              }}>
              <Tooltip title="Copy detail">
                <IconButton
                  onClick={() => copyToClipboard(normalizedDetail)}
                  size="small"
                  sx={{ color: UI.globalSnackbar.copyIconColor }}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>
      </Alert>
    </Snackbar>
  );
}
