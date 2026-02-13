// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import React from "react";

import {
  deleteValidationResult,
  fetchSimulationScenariosDetail,
  getValidationResult,
} from "../../../services/simulationService";
import { SIMULATION } from "@/strings";

const strings = SIMULATION.detailPage;

function deriveValidationPropsFromServer(result) {
  const cmp = [...(result?.trip_count_comparisons ?? [])].sort((a, b) =>
    (a.route_id || "").localeCompare(b.route_id || "", "ja")
  );
  const comparisonsWithDiff = cmp.filter((r) => Number(r.difference) !== 0);
  const comparisonsNoDiff = cmp.filter((r) => Number(r.difference) === 0);

  const rows = result?.invalid_rows ?? [];
  const grouped = rows.reduce((acc, r) => {
    const k = r.route_id || "（不明）";
    (acc[k] = acc[k] || []).push(r);
    return acc;
  }, {});
  const invalidGroupedByRoute = Object.entries(grouped).sort((a, b) =>
    String(a[0]).localeCompare(String(b[0]), "ja")
  );

  return { comparisonsWithDiff, comparisonsNoDiff, invalidGroupedByRoute };
}

function emptyValidationState() {
  return {
    validationLoading: false,
    validationError: "",
    validationResult: null,
    comparisonsWithDiff: [],
    comparisonsNoDiff: [],
    invalidGroupedByRoute: [],
  };
}

export function useSimulationDetailPage(simulationId) {
  const [simulationData, setSimulationData] = React.useState(null);
  const [loadingSimulation, setLoadingSimulation] = React.useState(true);
  const [errorSimulation, setErrorSimulation] = React.useState("");

  const [validationLoading, setValidationLoading] = React.useState(false);
  const [validationError, setValidationError] = React.useState("");
  const [validationResult, setValidationResult] = React.useState(null);
  const [comparisonsWithDiff, setComparisonsWithDiff] = React.useState([]);
  const [comparisonsNoDiff, setComparisonsNoDiff] = React.useState([]);
  const [invalidGroupedByRoute, setInvalidGroupedByRoute] = React.useState([]);
  const [hasPersistedValidation, setHasPersistedValidation] = React.useState(false);

  const requestIdRef = React.useRef(0);

  const applyValidationState = React.useCallback((s) => {
    setValidationLoading(!!s.validationLoading);
    setValidationError(s.validationError || "");
    setValidationResult(s.validationResult || null);
    setComparisonsWithDiff(
      Array.isArray(s.comparisonsWithDiff) ? s.comparisonsWithDiff : []
    );
    setComparisonsNoDiff(
      Array.isArray(s.comparisonsNoDiff) ? s.comparisonsNoDiff : []
    );
    setInvalidGroupedByRoute(
      Array.isArray(s.invalidGroupedByRoute) ? s.invalidGroupedByRoute : []
    );
  }, []);

  React.useEffect(() => {
    const requestId = ++requestIdRef.current;

    if (!simulationId) {
      setSimulationData(null);
      setLoadingSimulation(false);
      setErrorSimulation(strings.messages.missingSimulationId);
      applyValidationState(emptyValidationState());
      setHasPersistedValidation(false);
      return;
    }

    (async () => {
      let scenario = null;

      setLoadingSimulation(true);
      setErrorSimulation("");
      try {
        scenario = await fetchSimulationScenariosDetail(simulationId);
        if (requestId !== requestIdRef.current) return;
        setSimulationData(scenario);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setSimulationData(null);
        setErrorSimulation(err?.message || strings.messages.detailFetchFailed);
      } finally {
        if (requestId === requestIdRef.current) setLoadingSimulation(false);
      }

      setValidationLoading(true);
      setValidationError("");
      try {
        const vr = await getValidationResult({ simulationId });
        if (requestId !== requestIdRef.current) return;

        const hasServerResult = !!vr?.result_json;
        const hasRun = scenario?.has_run;

        if (hasServerResult && hasRun === false) {
          try {
            await deleteValidationResult({ simulationId });
          } catch {
            // ignore
          }

          if (requestId !== requestIdRef.current) return;
          applyValidationState(emptyValidationState());
          setHasPersistedValidation(false);
        } else if (hasServerResult) {
          const derived = deriveValidationPropsFromServer(vr.result_json);
          applyValidationState({
            validationLoading: false,
            validationError: "",
            validationResult: vr.result_json,
            ...derived,
          });
          setHasPersistedValidation(true);
        } else {
          applyValidationState(emptyValidationState());
          setHasPersistedValidation(false);
        }
      } catch {
        if (requestId !== requestIdRef.current) return;
        // keep the UX similar to before: ignore server errors here
        applyValidationState(emptyValidationState());
        setHasPersistedValidation(false);
      } finally {
        if (requestId === requestIdRef.current) setValidationLoading(false);
      }
    })();

    return () => {
      requestIdRef.current += 1;
    };
  }, [applyValidationState, simulationId]);

  const cleanupValidationIfNeeded = React.useCallback(async () => {
    if (!simulationId) return;
    if (simulationData?.has_run) return;
    if (!hasPersistedValidation) return;

    try {
      await deleteValidationResult({ simulationId });
    } catch {
      // ignore
    }
  }, [hasPersistedValidation, simulationData?.has_run, simulationId]);

  return {
    simulationData,
    loadingSimulation,
    errorSimulation,

    validationLoading,
    validationError,
    validationResult,
    comparisonsWithDiff,
    comparisonsNoDiff,
    invalidGroupedByRoute,
    applyValidationState,

    hasPersistedValidation,
    setHasPersistedValidation,
    cleanupValidationIfNeeded,
  };
}

