// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import { Box, Typography, CircularProgress, Tab, Tabs } from "@mui/material";
import { ADDITIONAL } from "../../strings";
import { useAdditionalDataImport } from "./hooks/useAdditionalDataImport";

const POI = React.lazy(() => import("./POI"));
const OnedDetailedData = React.lazy(() => import("./OnedDetailedData"));
const BoardingAlightingData = React.lazy(() => import("./BoardingAlightingData"));
const ODData = React.lazy(() => import("./ODData"));

function LoadingFallback() {
  return (
    <Box sx={{ height: "100%", display: "grid", placeItems: "center" }}>
      <CircularProgress />
    </Box>
  );
}

function LazyTabPanel({ active, children }) {
  if (!active) return null;
  return (
    <Box sx={{ height: "100%" }}>
      <React.Suspense fallback={<LoadingFallback />}>{children}</React.Suspense>
    </Box>
  );
}

export default function AdditionalDataImport() {
  const { tab, setTab } = useAdditionalDataImport();

  return (
    <Box
      sx={{
        height: "86vh",
        boxSizing: "border-box",
        overflow: "visible",
        display: "flex",
        flexDirection: "column",
        mt: -4,
      }}
    >
      <Typography variant="h4" sx={{ mb: 1, fontWeight: 600, ml: 1 }}>
        {ADDITIONAL.dataImport.title}
      </Typography>

      <Box sx={{ px: 2, bgcolor: "background.paper" }}>
        <Tabs
          value={tab}
          onChange={(event, value) => {
            void event;
            setTab(value);
          }}
          textColor="primary"
          indicatorColor="primary"
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            mb: 3,
            minHeight: 42,
            ".MuiTab-root": {
              textTransform: "none",
              fontSize: 16,
              minWidth: 0,
              px: 3,
              py: 1,
              color: "text.secondary",
            },
            ".Mui-selected": {
              color: "primary.main",
              fontWeight: 600,
            },
            ".MuiTabs-indicator": {
              height: 3,
              borderRadius: 1,
            },
          }}
        >
          <Tab label={ADDITIONAL.dataImport.tabs.poi} value="poi" disableRipple />
          <Tab label={ADDITIONAL.dataImport.tabs.oneDetailed} value="onedetailed" disableRipple />
          <Tab label={ADDITIONAL.dataImport.tabs.ridership} value="ridership" disableRipple />
          <Tab label={ADDITIONAL.dataImport.tabs.od} value="od" disableRipple />
        </Tabs>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <LazyTabPanel active={tab === "poi"}>
          <POI embedded />
        </LazyTabPanel>
        <LazyTabPanel active={tab === "onedetailed"}>
          <OnedDetailedData embedded />
        </LazyTabPanel>
        <LazyTabPanel active={tab === "ridership"}>
          <BoardingAlightingData embedded />
        </LazyTabPanel>
        <LazyTabPanel active={tab === "od"}>
          <ODData embedded />
        </LazyTabPanel>
      </Box>
    </Box>
  );
}

