// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import PropTypes from "prop-types";
import { Box, Paper, Divider, Typography, Backdrop, CircularProgress } from "@mui/material";

/**
 * Reusable scaffold that standardizes the UX/layout across BufferAnalysis, RoadNetworkAnalysis,
 * and NumberOfBusRunningVisualization screens.
 *
 * Slots:
 *  - title?: string | ReactNode — optional header title. If omitted, header is hidden.
 *  - filterPanel?: ReactNode — rendered inside a Paper at the top-left.
 *  - leftExtra?: ReactNode — any extra left content (e.g., status/progress, buttons) shown under the filter.
 *  - graphs?: ReactNode — graphs/list/cards shown below leftExtra.
 *  - right: ReactNode | ({ containerWidth, containerRef }) => ReactNode — main map/content on the right.
 *  - rightLoading?: boolean — shows a Backdrop over the right Paper.
 *
 * Style knobs:
 *  - headerHeight (default 72)
 *  - viewportHeight (default '100vh')
 *  - leftWidth (default 500), leftMinWidth (default 320)
 *  - leftBg (default '#fafafa')
 *  - showDivider (default true)
 *  - leftSx, rightSx, rightPaperSx — SX overrides
 */
export default function VisualizationTwoPaneLayout({
  title,
  headerHeight = 72,
  viewportHeight = "100vh",
  leftWidth = 500,
  leftMinWidth = 320,
  leftBg = "#fafafa",
  showDivider = true,
  filterPanel,
  leftExtra,
  graphs,
  right,
  rightLoading = false,
  leftSx,
  rightSx,
  rightPaperSx,
}) {
  const hasHeader = Boolean(title);
  const rightContainerRef = React.useRef(null);
  const [rightWidth, setRightWidth] = React.useState(0);

  React.useEffect(() => {
    const el = rightContainerRef.current;
    if (!el) return;
    const obs = new window.ResizeObserver((entries) => {
      for (const entry of entries) {
        setRightWidth(entry.contentRect.width);
      }
    });
    obs.observe(el);
    // initial measure
    setRightWidth(el.getBoundingClientRect().width || 0);
    return () => obs.disconnect();
  }, []);

  const titleNode = typeof title === "string" ? (
    <Typography variant="h4" fontWeight={700}>{title}</Typography>
  ) : (
    title
  );

  const rightNode = typeof right === "function"
    ? right({ containerWidth: rightWidth, containerRef: rightContainerRef })
    : right;

  return (
    <Box sx={{ height: viewportHeight, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {hasHeader && (
        <Box sx={{ height: headerHeight, px: 4, display: "flex", alignItems: "center", borderBottom: "1px solid #eee" }}>
          {titleNode}
        </Box>
      )}

      <Box sx={{
        height: hasHeader ? `calc(${viewportHeight} - ${headerHeight}px)` : "100%",
        display: "flex",
        flexDirection: "row",
        overflow: "hidden",
        minHeight: 0,
      }}>
        {/* Left column */}
        <Box sx={{
          width: leftWidth,
          minWidth: leftMinWidth,
          p: 2,
          bgcolor: leftBg,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          ...leftSx,
        }}>
          {filterPanel && (
            <Paper sx={{ p: 2, mb: 2, flexShrink: 0 }}>
              {filterPanel}
            </Paper>
          )}

          {leftExtra}
          {graphs}
        </Box>

        {showDivider && <Divider orientation="vertical" flexItem sx={{ mx: 0 }} />}

        {/* Right column */}
        <Box ref={rightContainerRef} sx={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "center",
          overflow: "hidden",
          p: 2,
          height: "100%",
          ...rightSx,
        }}>
          <Paper sx={{
            flex: 1,
            display: "flex",
            alignItems: "stretch",
            justifyContent: "stretch",
            p: 0,
            boxSizing: "border-box",
            overflow: "hidden",
            minHeight: 0,
            height: "100%",
            ...rightPaperSx,
          }}>
            {rightLoading && (
              <Backdrop open sx={{ zIndex: 6002 }}>
                <CircularProgress />
              </Backdrop>
            )}
            {rightNode}
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}

VisualizationTwoPaneLayout.propTypes = {
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  headerHeight: PropTypes.number,
  viewportHeight: PropTypes.string,
  leftWidth: PropTypes.number,
  leftMinWidth: PropTypes.number,
  leftBg: PropTypes.string,
  showDivider: PropTypes.bool,
  filterPanel: PropTypes.node,
  leftExtra: PropTypes.node,
  graphs: PropTypes.node,
  right: PropTypes.oneOfType([PropTypes.node, PropTypes.func]).isRequired,
  rightLoading: PropTypes.bool,
  leftSx: PropTypes.object,
  rightSx: PropTypes.object,
  rightPaperSx: PropTypes.object,
};
