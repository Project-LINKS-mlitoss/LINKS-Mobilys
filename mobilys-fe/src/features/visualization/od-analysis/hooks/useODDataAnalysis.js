// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSnackbarStore } from "../../../../state/snackbarStore";
import { useVisualizationServices } from "../../hooks/useVisualizationServices";
import { STORAGE_KEYS, VISUALIZATION_LAYOUT } from "../../../../constant/ui";
import { VISUALIZATION } from "@/strings";
import { loadCsvFromIDB, removeCsvFromIDB } from "../../../../utils/indexDb";

import { parseOdCsvFile, parseOdCsvText, validateOdHeaders } from "../helper/odUtils";

async function loadOdCsvRowsFromIDB(scenarioId) {
  const blob = await loadCsvFromIDB({ prefix: "od", scenarioId });
  if (!blob) return [];
  const text = await blob.text();
  return await parseOdCsvText(text);
}

const OD_ALL_LABEL = VISUALIZATION.common.filters.all; // UI label (e.g. "すべて")
const OD_ALL_VALUE = VISUALIZATION.common.filters.allAlt; // API value (e.g. "全て")
const normalizeSelectedDate = (value) => {
  if (!value) return OD_ALL_VALUE;
  return value === OD_ALL_LABEL ? OD_ALL_VALUE : value;
};

export function useODDataAnalysis() {
  const showSnackbar = useSnackbarStore((s) => s.showSnackbar);
  const {
    getUserScenarios,
    fetchFP004RouteGroupsAndStopsData,
    getODUsageDistributionData,
    getODLastFirstStopData,
    getODBusStopData,
    getODUploadData,
  } = useVisualizationServices();

  const [scenarioOptions, setScenarioOptions] = useState([]);
  const [loadingScenario, setLoadingScenario] = useState(true);
  const [selectedScenario, setSelectedScenario] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.selectedScenarioVisualization) || "";
  });

  const [loadingFilter, setLoadingFilter] = useState(false);

  const [leftRatio, setLeftRatio] = useState(VISUALIZATION_LAYOUT.leftPanel.defaultRatio);
  const [mapContainerWidth, setMapContainerWidth] = useState(0);
  const mapContainerRef = useRef(null);

  const [forceUpdate, setForceUpdate] = useState(0);

  const [selectedVisualization, setSelectedVisualization] = useState(0);
  const [allRoutesData, setAllRoutesData] = useState(null);
  const [uploadedData, setUploadedData] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const [oDUsageDistributionData, setODUsageDistributionData] = useState(null);
  const [oDUsageDistributionDateOptions, setODUsageDistributionDateOptions] = useState([]);
  const [oDUsageDistributionMode, setODUsageDistributionMode] = useState("sum");
  const [oDUsageDistributionSelectedDate, setODUsageDistributionSelectedDate] = useState(
    OD_ALL_VALUE,
  );
  const [oDUsageDistributionSelectedPoint, setODUsageDistributionSelectedPoint] = useState(null);

  const [oDLastFirstStopData, setODLastFirstStopData] = useState(null);
  const [oDLastFirstStopSelectedPoint, setODLastFirstStopSelectedPoint] = useState(null);
  const [oDLastFirstStopSelectedMode, setODLastFirstStopSelectedMode] = useState("first_stop");
  const [oDLastFirstStopSelectedDate, setODLastFirstStopSelectedDate] = useState(
    OD_ALL_VALUE,
  );
  const [oDLastFirstStopDateOptions, setODLastFirstStopDateOptions] = useState([]);

  const [oDBusStopData, setODBusStopData] = useState(null);
  const [oDBusStopDateOptions, setODBusStopDateOptions] = useState([]);
  const [oDBusStopSelectedDate, setODBusStopSelectedDate] = useState(OD_ALL_VALUE);
  const [oDBusStopSelectedPoint, setODBusStopSelectedPoint] = useState(null);
  const [oDBusStopLayer, setODBusStopLayer] = useState(null);

  const visualizationOptions = useMemo(
    () => [
      VISUALIZATION.odAnalysis.visualizationOptions.stopUsage,
      VISUALIZATION.odAnalysis.visualizationOptions.usageDistribution,
      VISUALIZATION.odAnalysis.visualizationOptions.boardingAlightingPoints,
    ],
    []
  );

  const currentScenarioName = useMemo(() => {
    const obj =
      typeof selectedScenario === "object"
        ? selectedScenario
        : scenarioOptions.find((s) => s.id === selectedScenario);
    return (
      obj?.scenario_name ||
      obj?.name ||
      (selectedScenario ? String(selectedScenario) : VISUALIZATION.common.scenarioFallbackName)
    );
  }, [selectedScenario, scenarioOptions]);

  const canDoDescription = VISUALIZATION.odAnalysis.description;

  const fetchODUsageDistribution = useCallback(
    async (odData, scenarioId, selectedDate = oDUsageDistributionSelectedDate, mode = oDUsageDistributionMode) => {
      try {
        setLoadingFilter(true);
        const normalizedDate = normalizeSelectedDate(selectedDate);
        const reqBody = {
          od_data: odData,
          scenario_id: scenarioId,
          selected_date: normalizedDate,
          total_type: mode,
        };
        const response = await getODUsageDistributionData(reqBody);
        setODUsageDistributionData(response.geojson);
        setODUsageDistributionDateOptions(response.date_options || []);
        if (!oDUsageDistributionSelectedDate && response.date_options?.length) {
          setODUsageDistributionSelectedDate(response.date_options[0]);
        }
        if (!oDUsageDistributionMode) setODUsageDistributionMode("sum");
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Failed to fetch OD Usage Distribution Data:", err);
        setODUsageDistributionData(null);
      } finally {
        setLoadingFilter(false);
      }
    },
    [getODUsageDistributionData, oDUsageDistributionMode, oDUsageDistributionSelectedDate],
  );

  const handleUploadCSV = useCallback(
    async (file, cb) => {
      const results = await parseOdCsvFile(file);
      const fields = results?.meta?.fields ?? [];
      if (!validateOdHeaders(fields)) {
        throw new Error(
          VISUALIZATION.odAnalysis.upload.invalidCsvHeaders,
        );
      }

      const jsonData = results.data ?? [];
      cb?.();

      if (selectedVisualization === 0) {
        await fetchODUsageDistribution(jsonData, selectedScenario);
      }

      try {
        const response = await getODUploadData({
          scenario_id: selectedScenario,
          od_data: jsonData,
        });
        setUploadedData(response);
        setShowUploadModal(true);
      } catch (err) {
        setUploadedData(null);
        setShowUploadModal(false);
      }

      return true;
    },
    [fetchODUsageDistribution, getODUploadData, selectedScenario, selectedVisualization],
  );

  useEffect(() => {
    setLoadingScenario(true);
    getUserScenarios()
      .then((res) => {
        setScenarioOptions(res || []);
        setLoadingScenario(false);
        if (res && res.length > 0) {
          const stored = localStorage.getItem(STORAGE_KEYS.selectedScenarioVisualization);
          if (stored && res.some((s) => s.id === stored)) setSelectedScenario(stored);
          else setSelectedScenario(res[0].id);
        }
      })
      .catch(() => {
        setScenarioOptions([]);
        setLoadingScenario(false);
      });
  }, [getUserScenarios]);

  useEffect(() => {
    if (selectedVisualization !== 1) {
      setODLastFirstStopSelectedPoint(null);
    }
  }, [selectedVisualization]);

  useEffect(() => {
    if (selectedScenario) {
      localStorage.setItem(STORAGE_KEYS.selectedScenarioVisualization, selectedScenario);
    }
  }, [selectedScenario]);

  useEffect(() => {
    if (!selectedScenario) return;
    fetchFP004RouteGroupsAndStopsData({
      scenario_id: selectedScenario,
      is_using_shape_data: true,
      is_using_parent_stop: true,
    })
      .then((data) => setAllRoutesData(data))
      .catch(() => setAllRoutesData(null));
  }, [fetchFP004RouteGroupsAndStopsData, selectedScenario]);

  useEffect(() => {
    (async () => {
      if (selectedVisualization !== 0 || !selectedScenario) return;
      const rows = await loadOdCsvRowsFromIDB(selectedScenario);
      await fetchODUsageDistribution(
        rows,
        selectedScenario,
        oDUsageDistributionSelectedDate,
        oDUsageDistributionMode,
      );
    })();
  }, [
    fetchODUsageDistribution,
    forceUpdate,
    oDUsageDistributionMode,
    oDUsageDistributionSelectedDate,
    selectedScenario,
    selectedVisualization,
  ]);

  useEffect(() => {
    (async () => {
      if (selectedVisualization !== 1 || !selectedScenario || !oDLastFirstStopSelectedMode) return;
      setLoadingFilter(true);

      const prevName = oDLastFirstStopSelectedPoint?.properties?.stop_name ?? null;
      setODLastFirstStopSelectedPoint(null);

      const odData = await loadOdCsvRowsFromIDB(selectedScenario);
      const reqBody = {
        scenario_id: selectedScenario,
        od_data: odData,
        type: oDLastFirstStopSelectedMode,
        selected_date: normalizeSelectedDate(oDLastFirstStopSelectedDate),
      };

      try {
        const response = await getODLastFirstStopData(reqBody);
        setODLastFirstStopData(response.geojson);
        setODLastFirstStopDateOptions(response.date_options || []);

        if (prevName && response?.geojson?.features?.length) {
          const nextFeature = response.geojson.features.find((f) => f?.properties?.stop_name === prevName);
          if (nextFeature) setODLastFirstStopSelectedPoint(nextFeature);
        }
      } catch (err) {
        setODLastFirstStopData(null);
        // eslint-disable-next-line no-console
        console.error("Failed to fetch OD Last/First Stop Data:", err);
      } finally {
        setLoadingFilter(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    forceUpdate,
    getODLastFirstStopData,
    oDLastFirstStopSelectedDate,
    oDLastFirstStopSelectedMode,
    selectedScenario,
    selectedVisualization,
  ]);

  useEffect(() => {
    (async () => {
      if (selectedVisualization !== 2 || !selectedScenario) return;
      setLoadingFilter(true);
      const odData = await loadOdCsvRowsFromIDB(selectedScenario);
      const reqBody = {
        scenario_id: selectedScenario,
        od_data: odData,
        selected_date: normalizeSelectedDate(oDBusStopSelectedDate),
        layer: oDBusStopLayer,
      };
      try {
        const response = await getODBusStopData(reqBody);
        setODBusStopData(response.bus_stop_data);
        setODBusStopDateOptions(response.date_options || []);
      } catch (err) {
        setODBusStopData(null);
        // eslint-disable-next-line no-console
        console.error("Failed to fetch OD Bus Stop Data:", err);
      } finally {
        setLoadingFilter(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceUpdate, getODBusStopData, oDBusStopLayer, oDBusStopSelectedDate, selectedScenario, selectedVisualization]);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    const observer = new window.ResizeObserver((entries) => {
      for (let entry of entries) setMapContainerWidth(entry.contentRect.width);
    });
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleToggleLeft = useCallback(() => {
    setLeftRatio((prev) =>
      prev === VISUALIZATION_LAYOUT.leftPanel.defaultRatio
        ? VISUALIZATION_LAYOUT.leftPanel.expandedRatio
        : VISUALIZATION_LAYOUT.leftPanel.defaultRatio,
    );
  }, []);

  const handleDeleteData = useCallback(async () => {
    if (!selectedScenario) return;
    try {
      await removeCsvFromIDB({ prefix: "od", scenarioId: selectedScenario });
    } catch {}

    setODUsageDistributionData(null);
    setODUsageDistributionDateOptions([]);
    setODUsageDistributionMode("sum");
    setODUsageDistributionSelectedDate("");
    setODUsageDistributionSelectedPoint(null);

    setODLastFirstStopData(null);
    setODLastFirstStopSelectedPoint(null);
    setODLastFirstStopSelectedMode("first_stop");
    setODLastFirstStopSelectedDate(OD_ALL_VALUE);
    setODLastFirstStopDateOptions([]);

    setODBusStopData(null);
    setODBusStopSelectedDate(OD_ALL_VALUE);
    setODBusStopDateOptions([]);

    setForceUpdate((v) => v + 1);
  }, [selectedScenario]);

  useEffect(() => {
    setODUsageDistributionData(null);
    setODUsageDistributionDateOptions([]);
    setODUsageDistributionMode("sum");
    setODUsageDistributionSelectedDate(OD_ALL_VALUE);
    setODUsageDistributionSelectedPoint(null);

    setODLastFirstStopData(null);
    setODLastFirstStopSelectedPoint(null);
    setODLastFirstStopSelectedMode("first_stop");
    setODLastFirstStopSelectedDate(OD_ALL_VALUE);
    setODLastFirstStopDateOptions([]);

    setODBusStopData(null);
    setODBusStopSelectedDate(OD_ALL_VALUE);
    setODBusStopDateOptions([]);

    setForceUpdate((v) => v + 1);
  }, [selectedScenario]);

  return {
    showSnackbar,
    scenarioOptions,
    loadingScenario,
    selectedScenario,
    setSelectedScenario,
    loadingFilter,
    leftRatio,
    handleToggleLeft,
    mapContainerRef,
    mapContainerWidth,
    forceUpdate,
    setForceUpdate,
    selectedVisualization,
    setSelectedVisualization,
    allRoutesData,
    uploadedData,
    showUploadModal,
    setShowUploadModal,
    visualizationOptions,
    canDoDescription,
    currentScenarioName,
    handleUploadCSV,
    handleDeleteData,
    // vis 0
    oDUsageDistributionData,
    oDUsageDistributionDateOptions,
    oDUsageDistributionMode,
    setODUsageDistributionMode,
    oDUsageDistributionSelectedDate,
    setODUsageDistributionSelectedDate,
    oDUsageDistributionSelectedPoint,
    setODUsageDistributionSelectedPoint,
    // vis 1
    oDLastFirstStopData,
    oDLastFirstStopSelectedPoint,
    setODLastFirstStopSelectedPoint,
    oDLastFirstStopSelectedMode,
    setODLastFirstStopSelectedMode,
    oDLastFirstStopSelectedDate,
    setODLastFirstStopSelectedDate,
    oDLastFirstStopDateOptions,
    // vis 2
    oDBusStopData,
    oDBusStopDateOptions,
    oDBusStopSelectedDate,
    setODBusStopSelectedDate,
    oDBusStopSelectedPoint,
    setODBusStopSelectedPoint,
    oDBusStopLayer,
    setODBusStopLayer,
  };
}
