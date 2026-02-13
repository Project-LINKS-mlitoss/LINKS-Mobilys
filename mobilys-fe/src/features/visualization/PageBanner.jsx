// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import PropTypes from "prop-types";
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogContent,
  DialogActions,
  DialogTitle,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { PAGE_BANNER_UI } from "../../constant/ui";
import { VISUALIZATION } from "@/strings";

function PageBanner({
  text,
  modalContent = null,
  tinted = false,
  variant = "info",
  dense = false,
  fullWidth = true,
  startAdornment,
  endAdornment,
  expandable = true,
  maxLines = 2,
  moreLabel = VISUALIZATION.pageBanner.moreLabel,
  closeLabel = VISUALIZATION.pageBanner.closeLabel,
  modalTitle = VISUALIZATION.pageBanner.modalTitle,
  sx,
  ...rest
}) {
  const theme = useTheme();

  const surfaceStyles = {
    bgcolor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 2,
  };

  const base =
    {
      info: theme.palette.info.main,
      success: theme.palette.success.main,
      warning: theme.palette.warning.main,
      error: theme.palette.error.main,
      primary: theme.palette.primary.main,
      neutral: theme.palette.text.primary,
    }[variant] || theme.palette.info.main;

  const tintedStyles = {
    bgcolor: alpha(base, PAGE_BANNER_UI.tintedBgAlpha),
    border: `1px solid ${alpha(base, PAGE_BANNER_UI.tintedBorderAlpha)}`,
    borderRadius: 2,
  };

  const textRef = React.useRef(null);
  const [isOverflowing, setIsOverflowing] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const getResolvedLineHeight = React.useCallback((node) => {
    if (!node) return 0;
    const computed = getComputedStyle(node);
    const explicitLineHeight = parseFloat(computed.lineHeight);
    if (Number.isFinite(explicitLineHeight)) {
      return explicitLineHeight;
    }
    const fontSize = parseFloat(computed.fontSize);
    if (Number.isFinite(fontSize)) {
      return fontSize * 1.2;
    }
    return PAGE_BANNER_UI.fallbackLineHeightPx; // fallback
  }, []);

  // Overflow detection for clamped text
  React.useEffect(() => {
    const el = textRef.current;
    if (!el) return;

    const detectOverflow = () => {
      const prevClamp = el.style.webkitLineClamp;
      const prevDisplay = el.style.display;

      el.style.webkitLineClamp = "unset";
      el.style.display = "block";

      const fullHeight = el.scrollHeight;
      const lineHeight = getResolvedLineHeight(el);
      const visibleHeight = lineHeight * maxLines;
      const overflowing = fullHeight > visibleHeight + PAGE_BANNER_UI.overflowTolerancePx; // tolerance

      el.style.display = prevDisplay || "-webkit-box";
      el.style.webkitLineClamp = prevClamp || String(maxLines);

      setIsOverflowing(overflowing);
    };

    detectOverflow();
    const ro = new ResizeObserver(detectOverflow);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, maxLines, getResolvedLineHeight]);

  return (
    <>
      <Box
        role="note"
        aria-live="polite"
        sx={{
          width: fullWidth ? "100%" : "auto",
          display: "flex",
          alignItems: "flex-start",
          gap: 1.25,
          px: dense ? 1.5 : 2,
          py: dense ? 1 : 1.5,
          boxSizing: "border-box",
          overflow: "visible",
          borderRadius: 2,
          position: "relative",
          ...(tinted ? tintedStyles : surfaceStyles),
          ...sx,
        }}
        {...rest}
      >
        {startAdornment && (
          <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            {startAdornment}
          </Box>
        )}

        {/* Clamped text */}
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <Typography
            ref={textRef}
            variant={dense ? "body2" : "body1"}
            sx={{
              fontWeight: 500,
              lineHeight: 1.6,
              display: "-webkit-box",
              WebkitLineClamp: maxLines,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "normal",
              wordBreak: "break-word",
              color: PAGE_BANNER_UI.textColor,
            }}
          >
            {text}
          </Typography>

          {/* Button on next line */}
          {expandable && isOverflowing && (
            <Button
              sx={{ mt: 0.5, alignSelf: "flex-start", paddingLeft: 0 }}
              size={dense ? "small" : "medium"}
              onClick={() => setOpen(true)}
            >
              {moreLabel}
            </Button>
          )}
        </Box>

        {/* For optional right-side adornment */}
        {endAdornment && (
          <Box sx={{ display: "flex", alignItems: "center", ml: 1 }}>
            {endAdornment}
          </Box>
        )}
      </Box>

      {/* Modal */}
      <Dialog
        fullWidth
        maxWidth="md"
        open={open}
        onClose={() => setOpen(false)}
      >
        <DialogTitle>{modalTitle}</DialogTitle>
        <DialogContent dividers>
          {modalContent ? (
            modalContent
          ) : (
            <Typography
              variant="body1"
              sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
            >
              {text}
            </Typography>
          )}
        </DialogContent>

        <DialogActions>
          <Button variant="contained" onClick={() => setOpen(false)}>
            {closeLabel}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

PageBanner.propTypes = {
  text: PropTypes.string.isRequired,
  tinted: PropTypes.bool,
  variant: PropTypes.oneOf([
    "info",
    "neutral",
    "success",
    "warning",
    "error",
    "primary",
  ]),
  dense: PropTypes.bool,
  fullWidth: PropTypes.bool,
  startAdornment: PropTypes.node,
  endAdornment: PropTypes.node,
  expandable: PropTypes.bool,
  maxLines: PropTypes.number,
  moreLabel: PropTypes.string,
  closeLabel: PropTypes.string,
  modalTitle: PropTypes.string,
  sx: PropTypes.object,
};

export default PageBanner;
