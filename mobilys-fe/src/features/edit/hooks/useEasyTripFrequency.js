// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import { useSearchParams } from "react-router-dom";
import { cloneGTFSDataImport } from "../../../services/importService";
import { getUserScenarios } from "../../../services/scenarioService";
import { getTripFrequency, saveTripFrequency } from "../../../services/tripService";
import { SCENARIO } from "../../../strings";

export function useEasyTripFrequency() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [loadError, setLoadError] = React.useState("");
  const [scenarioOptions, setScenarioOptions] = React.useState([]);
  const [scenarioOwnedByUser, setScenarioOwnedByUser] = React.useState([]);
  const [loadingScenarios, setLoadingScenarios] = React.useState(true);
  const [selectedScenarioId, setSelectedScenarioId] = React.useState(
    searchParams.get("scenarioId") || ""
  );

  const [routeGroups, setRouteGroups] = React.useState([]);
  const [initialLoading, setInitialLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [resetSignal, setResetSignal] = React.useState(0);
  const [tripResult, setTripResult] = React.useState([]);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [baseScenarioId, setBaseScenarioId] = React.useState("");
  const [newScenarioName, setNewScenarioName] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [newScenarioNameError, setNewScenarioNameError] = React.useState("");

  const existingScenarioNames = React.useMemo(
    () =>
      new Set(
        (scenarioOwnedByUser || [])
          .map((s) => (s?.scenario_name || s?.name || "").trim().toLowerCase())
          .filter(Boolean)
      ),
    [scenarioOwnedByUser]
  );

  const validateScenarioName = React.useCallback(
    (name) => {
      const v = (name || "").trim();
      if (!v) return SCENARIO.pickerTile.validation.requiredScenarioName;
      if (existingScenarioNames.has(v.toLowerCase())) {
        return SCENARIO.pickerTile.validation.duplicateScenarioName;
      }
      return null;
    },
    [existingScenarioNames]
  );

  const refreshScenarios = React.useCallback(async () => {
    setLoadingScenarios(true);
    setLoadError("");
    try {
      const list = (await getUserScenarios(true)) || [];
      setScenarioOptions(list);

      try {
        const owned = (await getUserScenarios(false)) || [];
        setScenarioOwnedByUser(owned);
      } catch {
        setScenarioOwnedByUser([]);
      }
    } catch (err) {
      setScenarioOptions([]);
      setScenarioOwnedByUser([]);
      setLoadError(err?.message || "");
    } finally {
      setLoadingScenarios(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshScenarios();
  }, [refreshScenarios]);

  const loadFrequency = React.useCallback(async (scenarioId, { showSpinner = true } = {}) => {
    if (!scenarioId) return;

    if (showSpinner) setInitialLoading(true);
    else setRefreshing(true);

    try {
      setLoadError("");
      const data = await getTripFrequency(scenarioId);
      setRouteGroups(data);
      return data;
    } catch (err) {
      setRouteGroups([]);
      setLoadError(err?.message || "");
      return null;
    } finally {
      if (showSpinner) setInitialLoading(false);
      else setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    if (!selectedScenarioId) return;
    setSearchParams({ scenarioId: String(selectedScenarioId) });
    void loadFrequency(selectedScenarioId, { showSpinner: true });
  }, [loadFrequency, selectedScenarioId, setSearchParams]);

  const save = React.useCallback(async () => {
    if (!selectedScenarioId) return;
    setSaving(true);
    try {
      await saveTripFrequency(tripResult);
      await loadFrequency(selectedScenarioId, { showSpinner: false });
      setResetSignal((s) => s + 1);
    } finally {
      setSaving(false);
    }
  }, [loadFrequency, selectedScenarioId, tripResult]);

  const openDialog = React.useCallback(() => {
    setBaseScenarioId(selectedScenarioId || "");
    setNewScenarioName("");
    setNewScenarioNameError("");
    setDialogOpen(true);
  }, [selectedScenarioId]);

  const closeDialog = React.useCallback(() => {
    if (creating) return;
    setDialogOpen(false);
    setNewScenarioNameError("");
  }, [creating]);

  const createScenario = React.useCallback(async () => {
    if (!baseScenarioId) return null;

    const errorMsg = validateScenarioName(newScenarioName);
    if (errorMsg) {
      setNewScenarioNameError(errorMsg);
      return null;
    }

    setCreating(true);
    try {
      const cloned = await cloneGTFSDataImport({
        scenario_name: newScenarioName.trim(),
        source_scenario_id: baseScenarioId,
      });

      const newId = cloned?.new_scenario?.id ?? null;
      await refreshScenarios();

      if (newId) setSelectedScenarioId(String(newId));

      setDialogOpen(false);
      setNewScenarioName("");
      setBaseScenarioId("");
      setNewScenarioNameError("");

      return newId;
    } finally {
      setCreating(false);
    }
  }, [baseScenarioId, newScenarioName, refreshScenarios, validateScenarioName]);

  return {
    loadError,
    scenarioOptions,
    scenarioOwnedByUser,
    loadingScenarios,
    selectedScenarioId,
    setSelectedScenarioId,

    routeGroups,
    tripResult,
    setTripResult,
    initialLoading,
    refreshing,
    saving,
    resetSignal,

    dialogOpen,
    openDialog,
    closeDialog,
    baseScenarioId,
    setBaseScenarioId,
    newScenarioName,
    setNewScenarioName,
    newScenarioNameError,
    setNewScenarioNameError,
    creating,
    validateScenarioName,
    createScenario,

    loadFrequency,
    save,
    refreshScenarios,
  };
}
