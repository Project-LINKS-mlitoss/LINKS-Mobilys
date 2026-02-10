import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Tabs, Tab, Typography, Box, Button } from "@mui/material";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import GroupingTab from "./GroupingTab";
import GtfsDataTabs from "./GtfsDataTabs";
import { SCENARIO } from "../../strings";
import { useGtfsEdit } from "./hooks/useGtfsEdit";

function FlowStatusNav({ items, activeIndex, onSelect }) {
  return (
    <Box sx={{ width: "100%" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          flexWrap: "wrap",
          columnGap: 3,
          rowGap: 2,
        }}
      >
        {items.map((it, idx) => (
          <React.Fragment key={idx}>
            <Box
              onClick={() => onSelect(idx)}
              sx={{
                cursor: "pointer",
                textAlign: "center",
                px: 1,
                minWidth: 180,
                maxWidth: 260,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  mb: 1.25,
                  bgcolor: idx === activeIndex ? "primary.main" : "grey.400",
                }}
              />
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 700, mb: 0.5 }}
              >
                {it.title}
              </Typography>
              {it.sub && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    display: "block",
                    fontSize: 12,
                    lineHeight: 1.5,
                  }}
                >
                  {it.sub}
                </Typography>
              )}
            </Box>

            {idx < items.length - 1 && (
              <Box
                sx={{
                  alignSelf: "center",
                  px: 1,
                }}
              >
                <Typography
                  sx={{
                    color: "text.primary",
                    fontSize: 24,
                    lineHeight: 1,
                  }}
                >
                  ›
                </Typography>
              </Box>
            )}
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
}

export default function GTFSEdit() {
  const navigate = useNavigate();
  const { scenarioId } = useParams();
  const {
    flow,
    tabList,
    tab,
    setTab,
    groupSubTab,
    setGroupSubTab,
    gtfsFlatTab,
    setGtfsFlatTab,
    scenarioName,
    setScenarioName,
    flowSteps,
    flowTitle,
    activeFlowIndex,
    selectFlowStep,
  } = useGtfsEdit({ scenarioId });

  const handleTabChange = (_event, newValue) => setTab(newValue);

  return (
    <Box
      sx={{
        height: "86vh",
        boxSizing: "border-box",
        overflow: "visible",
        display: "flex",
        flexDirection: "column",
        mt: -5,
      }}
    >
      {!flow ? (
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Button
            variant="text"
            color="primary"
            size="small"
            onClick={() => navigate("/edit-data")}
            startIcon={<ChevronLeft fontSize="small" />}
            sx={{
              px: 0,
              "&:hover": { backgroundColor: "transparent" },
            }}
          >
            {SCENARIO.detail.backToList}
          </Button>
        </Box>
      ) : (
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Button
            variant="text"
            color="primary"
            size="small"
            onClick={() => navigate("/scenarios")}
            startIcon={<ChevronLeft fontSize="small" />}
            sx={{
              px: 0,
              "&:hover": { backgroundColor: "transparent" },
            }}
          >
            {SCENARIO.editPage.back.toHome}
          </Button>
        </Box>
      )}

      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, ml: 1 }}>
          {SCENARIO.editPage.title}
        </Typography>
        {scenarioName && (
          <Typography
            variant="subtitle2"
            sx={{ color: "text.secondary", fontWeight: 700 }}
          >
            {scenarioName}
          </Typography>
        )}
      </Box>

      {flow && flowSteps && (
        <Box sx={{ mb: 2 }}>
          {flowTitle && (
            <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
              {flowTitle}
            </Typography>
          )}
          <FlowStatusNav
            items={flowSteps}
            activeIndex={activeFlowIndex}
            onSelect={selectFlowStep}
          />
        </Box>
      )}

      <Tabs
        value={tab}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="GTFSEdit tabs"
        sx={{
          mb: 2,
          minHeight: 44,
          "& .MuiTabs-indicator": { height: 3, borderRadius: 3 },
        }}
      >
        {tabList.map((t, idx) => (
          <Tab
            key={idx}
            label={t.label}
            sx={{
              textTransform: "none",
              fontSize: 16,
              fontWeight: 500,
              minHeight: 44,
              px: 2.5,
              mr: 0.5,
              borderRadius: 1,
            }}
          />
        ))}
      </Tabs>

      <div>
        {tab === 0 && (
          <GroupingTab
            scenarioId={scenarioId}
            groupSubTab={groupSubTab}
            onSubTabChange={setGroupSubTab}
          />
        )}

        {tab === 1 && (
          <GtfsDataTabs
            scenarioId={scenarioId}
            gtfsFlatTab={gtfsFlatTab}
            setGtfsFlatTab={setGtfsFlatTab}
            onScenarioNameChange={setScenarioName}
          />
        )}
      </div>
    </Box>
  );
}
