// src/pages/simulation/SimulationDetail.jsx
import React, { useState } from "react";
import { Box, Typography, Tabs, Tab, Paper, Button } from "@mui/material";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import { useNavigate, useParams } from "react-router-dom";

import SimulationFirstInput from "./SimulationFirstInput";
import RidershipChangeTab from "./RidershipChangeTab";
import OperatingEconomicsTab from "./OperatingEconomicsTab";
import CarRoutingPage from "./CarRouting";
import VolumeCarTab from "./VolumeCarTab";
import SpeedChangeTab from "./SpeedChangeTab";
import RoadBenefitTab from "./BenefitCalculation";
import Co2ReductionTab from "./CO2ReductionTab";
import SimulationSummary from "./SimulationSummary";
import CsvValidationTab from "./CsvValidationTab";

import { SIMULATION } from "@/strings";
import { useSimulationDetailPage } from "./hooks/useSimulationDetailPage";

const strings = SIMULATION.detailPage;
const TAB_LIST = [
  { key: 0, label: strings.tabs.input },
  { key: 1, label: strings.tabs.validation },
  { key: 2, label: strings.tabs.ridershipChange },
  { key: 3, label: strings.tabs.operatingEconomics },
  { key: 4, label: strings.tabs.carRouting },
  { key: 5, label: strings.tabs.carVolume },
  { key: 6, label: strings.tabs.speedChange },
  { key: 7, label: strings.tabs.benefitCalculation },
  { key: 8, label: strings.tabs.co2Reduction },
  { key: 9, label: strings.tabs.summary },
];

const DEFAULT_PARAMS = {
  serviceDate: "",
  serviceIds: [],
  epsilon_inc: 0.5,
  epsilon_dec: 0.5,
  costPerShare: 520.9,
  carShare: 0.58,
  timeValueYenPerMin_perVehicle: 48.89,
  defaultFare: 200,
};

export default function SimulationDetail() {
  const navigate = useNavigate();
  const { simulationId } = useParams();

  const [tab, setTab] = useState(0);

  // 🔑 summary remount key
  const [summaryKey, setSummaryKey] = useState(0);
  const goToSummary = () => {
    setSummaryKey((k) => k + 1);
    setTab(9);
  };

  // ─────────────────────────────────────────────────────────────
  // Lifted states for SimulationFirstInput (persist across tabs)
  // ─────────────────────────────────────────────────────────────
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [dateOptions, setDateOptions] = useState([]);
  const [serviceOptions, setServiceOptions] = useState([]);
  const [form, setForm] = useState(DEFAULT_PARAMS);

  const {
    simulationData,
    validationLoading,
    validationError,
    validationResult,
    comparisonsWithDiff,
    comparisonsNoDiff,
    invalidGroupedByRoute,
    applyValidationState: handleValidationStateChange,
    hasPersistedValidation,
    setHasPersistedValidation,
    cleanupValidationIfNeeded,
  } = useSimulationDetailPage(simulationId);

  // Handler for file changes
  const handleFilesChange = React.useCallback((files, persisted) => {
    setUploadedFiles(files);
    setHasPersistedValidation(persisted);
  }, [setHasPersistedValidation, setUploadedFiles]);

  // Handler for form/options changes
  const handleFormStateChange = React.useCallback((updates) => {
    if (updates.form !== undefined) {
      // Support both direct value and updater function
      if (typeof updates.form === 'function') {
        setForm(updates.form);
      } else {
        setForm(updates.form);
      }
    }
    if (updates.dateOptions !== undefined) setDateOptions(updates.dateOptions);
    if (updates.serviceOptions !== undefined) setServiceOptions(updates.serviceOptions);
  }, [setDateOptions, setForm, setServiceOptions]);

  // Reset all lifted state (called after successful save)
  const handleResetInputState = React.useCallback(() => {
    setUploadedFiles([]);
    setHasPersistedValidation(false);
    setDateOptions([]);
    setServiceOptions([]);
    setForm(DEFAULT_PARAMS);
  }, [setDateOptions, setForm, setHasPersistedValidation, setServiceOptions, setUploadedFiles]);

  const handleBackToSimulationList = async () => {
    await cleanupValidationIfNeeded();
    navigate("/simulation");
  };

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
      <Box sx={{ display: "flex", alignItems: "center"}}>
        <Button
          variant="text"
          color="primary"
          size="small"
          onClick={handleBackToSimulationList} 
          startIcon={<ChevronLeft fontSize="small" />}
          sx={{ px: 0, "&:hover": { backgroundColor: "transparent" } }}
        >
          {strings.backToList}
        </Button>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
        <Typography variant="h4" sx={{fontWeight: 600, ml: 1, mb: 1}}>
          {strings.title}
        </Typography>
        <Typography variant="subtitle2" sx={{ color: "text.secondary", fontWeight: 700 }}>
          {simulationData ? simulationData.name : strings.unknownName}
        </Typography>
      </Box>

      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: 44, "& .MuiTabs-indicator": { height: 3, borderRadius: 3 } }}
        >
          {TAB_LIST.map((t) => (
            <Tab
              key={t.key}
              label={t.label}
              sx={{ textTransform: "none", fontSize: 16, fontWeight: 500, minHeight: 44, px: 2.5, mr: 0.5, borderRadius: 1 }}
            />
          ))}
        </Tabs>
      </Paper>

      <Box sx={{ p: 2, minHeight: 200, bgcolor: "background.paper", width: "100%" }}>
        {/* 0: データ準備 */}
        {tab === 0 && (
          <SimulationFirstInput
            simulationId={simulationId}
            onSaved={goToSummary}
            beforeScenario={{ id: simulationData?.original_scenario_id, name: simulationData?.original_scenario_name }}
            afterScenario={{ id: simulationData?.duplicated_scenario_id, name: simulationData?.duplicated_scenario_name }}
            onOpenValidationTab={() => setTab(1)}
            onValidationStateChange={handleValidationStateChange}
            // 🆕 Lifted state props
            uploadedFiles={uploadedFiles}
            hasPersistedValidation={hasPersistedValidation}
            onFilesChange={handleFilesChange}
            form={form}
            dateOptions={dateOptions}
            serviceOptions={serviceOptions}
            onFormStateChange={handleFormStateChange}
            onResetInputState={handleResetInputState}
          />
        )}

        {/* 1: 検証結果 */}
        {tab === 1 && (
          <CsvValidationTab
            validationLoading={validationLoading}
            validationError={validationError}
            validationResult={validationResult}
            comparisonsWithDiff={comparisonsWithDiff}
            comparisonsNoDiff={comparisonsNoDiff}
            invalidGroupedByRoute={invalidGroupedByRoute}
          />
        )}

        {/* 2..9 */}
        {tab === 2 && <RidershipChangeTab simulationId={simulationId} />}
        {tab === 3 && <OperatingEconomicsTab simulationId={simulationId} />}
        {tab === 4 && <CarRoutingPage simulationId={simulationId} />}
        {tab === 5 && <VolumeCarTab simulationId={simulationId} />}
        {tab === 6 && <SpeedChangeTab simulationId={simulationId} />}
        {tab === 7 && <RoadBenefitTab simulationId={simulationId} />}
        {tab === 8 && <Co2ReductionTab />}

        {tab === 9 && (
          <SimulationSummary
            key={summaryKey}
            simulationId={simulationId}
            simulationName={simulationData?.name}
            scenarioName={simulationData?.duplicated_scenario_name}
          />
        )}
      </Box>
    </Box>
  );
}
