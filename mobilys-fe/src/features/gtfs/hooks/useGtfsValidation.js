import React from "react";
import {
  fetchNormalizedValidationReport,
  triggerGtfsValidation,
} from "../../../services/gtfsValidatorService";

export function useGtfsValidation({ scenarioId, autoRunValidationToken, onAutoRunConsumed }) {
  const [report, setReport] = React.useState(null);
  const [isFetching, setIsFetching] = React.useState(false);
  const [isPosting, setIsPosting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState("");
  const [initialLoaded, setInitialLoaded] = React.useState(false);

  const loadReport = React.useCallback(
    async ({ isInitial = false } = {}) => {
      if (!scenarioId) return null;

      try {
        setIsFetching(true);
        if (!isInitial) {
          // reserved for manual refresh behavior
        }
        setErrorMsg("");
        const data = await fetchNormalizedValidationReport(scenarioId, { lang: "ja" });
        setReport(data);
        setInitialLoaded(true);
        return data;
      } catch (err) {
        const message = err?.message || "";
        setErrorMsg(message);
        return null;
      } finally {
        setIsFetching(false);
      }
    },
    [scenarioId]
  );

  const runValidation = React.useCallback(async () => {
    if (!scenarioId) return null;

    try {
      setIsPosting(true);
      setErrorMsg("");
      setReport(null);

      const res = await triggerGtfsValidation(scenarioId);
      await loadReport({ isInitial: false });
      return res;
    } catch (err) {
      const message = err?.message || "";
      setErrorMsg(message);
      throw err;
    } finally {
      setIsPosting(false);
    }
  }, [loadReport, scenarioId]);

  React.useEffect(() => {
    if (!scenarioId) return undefined;

    setReport(null);
    setInitialLoaded(false);
    setErrorMsg("");
    void loadReport({ isInitial: true });

    return undefined;
  }, [loadReport, scenarioId]);

  React.useEffect(() => {
    if (!scenarioId) return;
    if (!autoRunValidationToken) return;

    void runValidation();
    if (typeof onAutoRunConsumed === "function") onAutoRunConsumed();
  }, [autoRunValidationToken, onAutoRunConsumed, runValidation, scenarioId]);

  const loadingNow = isPosting || isFetching;
  const hasData = Boolean(report);

  return {
    report,
    isFetching,
    isPosting,
    errorMsg,
    initialLoaded,
    loadingNow,
    hasData,
    loadReport,
    runValidation,
  };
}

