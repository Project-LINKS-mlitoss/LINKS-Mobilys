// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";
import { useSnackbarStore } from "../../../state/snackbarStore";
import { editScenario, getEditScenarioContextSvc } from "../../../services/scenarioService";
import { ERRORS as ERROR_MESSAGES } from "../../../constant";
import { FEED_INFO } from "../../../strings";

function toDateOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function useFeedInfoTab({ scenarioId, onScenarioNameChange }) {
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [scenarioCtx, setScenarioCtx] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const refreshContext = React.useCallback(async () => {
    if (!scenarioId) return;
    const data = await getEditScenarioContextSvc(scenarioId);
    setScenarioCtx(data);
    if (onScenarioNameChange && data?.scenario_name) {
      onScenarioNameChange(data.scenario_name);
    }
  }, [onScenarioNameChange, scenarioId]);

  React.useEffect(() => {
    if (!scenarioId) return undefined;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getEditScenarioContextSvc(scenarioId);
        if (cancelled) return;
        setScenarioCtx(data);
        if (onScenarioNameChange && data?.scenario_name) {
          onScenarioNameChange(data.scenario_name);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err?.message || FEED_INFO.tab.error.loadFailed;
          setError(message);
          showSnackbar({ title: message, severity: "error" });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [onScenarioNameChange, scenarioId, showSnackbar]);

  const initialValues = React.useMemo(
    () => ({
      scenario_name: scenarioCtx?.scenario_name || "",
      feed_info: {
        publisher_name: scenarioCtx?.feed_info?.publisher_name || "",
        publisher_url: scenarioCtx?.feed_info?.publisher_url || "",
        version: scenarioCtx?.feed_info?.version || "",
        start_date: toDateOrNull(scenarioCtx?.feed_info?.start_date),
        end_date: toDateOrNull(scenarioCtx?.feed_info?.end_date),
        language: scenarioCtx?.feed_info?.language || "",
      },
    }),
    [scenarioCtx]
  );

  const onSubmit = React.useCallback(
    async (payload) => {
      setSubmitting(true);
      try {
        await editScenario(scenarioId, payload, {
          fallbackMessage: ERROR_MESSAGES.scenario.updateFeedInfo,
        });
        showSnackbar({ title: FEED_INFO.tab.snackbar.updated, severity: "success" });
        await refreshContext();
      } catch (err) {
        showSnackbar({
          title: err?.message || FEED_INFO.tab.snackbar.updateFailed,
          severity: "error",
        });
      } finally {
        setSubmitting(false);
      }
    },
    [refreshContext, scenarioId, showSnackbar]
  );

  return {
    loading,
    error,
    submitting,
    initialValues,
    submitLabel: FEED_INFO.tab.submitLabel,
    onSubmit,
  };
}

