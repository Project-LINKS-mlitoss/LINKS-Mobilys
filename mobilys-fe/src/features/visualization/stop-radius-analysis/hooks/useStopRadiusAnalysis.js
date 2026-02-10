import { useCallback, useEffect, useMemo, useState } from "react";

import { useSnackbarStore } from "../../../../state/snackbarStore";
import { useVisualizationServices } from "../../hooks/useVisualizationServices";
import { STORAGE_KEYS } from "../../../../constant/ui";
import { VISUALIZATION_DEFAULTS } from "../../../../constant/validation";
import { VISUALIZATION } from "@/strings";

export function useStopRadiusAnalysis() {
  const [scenarioOptions, setScenarioOptions] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.selectedScenarioVisualization);
    return stored || "";
  });
  const [loadingScenario, setLoadingScenario] = useState(true);
  const [stopGroupingMethod, setStopGroupingMethod] = useState("stop_name");

  const [radius, setRadius] = useState(VISUALIZATION_DEFAULTS.stopRadiusAnalysis.radiusM);

  const [radiusFeatureCollection, setRadiusFeatureCollection] = useState(null);
  const [radiusKey, setRadiusKey] = useState(0);
  const [allRouteAndStopData, setAllRouteAndStopData] = useState(null);
  const [populationData, setPopulationData] = useState(null);

  const [loadingRes, setLoadingRes] = useState(false);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [graphData, setGraphData] = useState(null);

  const showSnackbar = useSnackbarStore((s) => s.showSnackbar);
  const {
    getUserScenarios,
    getAllRouteAndStopsData,
    getPopulationData,
    getStopRadiusAnalysisMap,
    getStopRadiusAnalysisMapGraph,
  } = useVisualizationServices();

  const selectedScenarioObj = useMemo(() => {
    if (!selectedScenario) return null;
    if (typeof selectedScenario === "object") return selectedScenario;
    return scenarioOptions.find((s) => s.id === selectedScenario) || null;
  }, [selectedScenario, scenarioOptions]);

  const currentScenarioName = useMemo(() => {
    return (
      selectedScenarioObj?.name ||
      selectedScenarioObj?.label ||
      selectedScenarioObj?.scenario_name ||
      selectedScenarioObj?.scenarioName ||
      (selectedScenarioObj?.id
        ? String(selectedScenarioObj.id)
        : VISUALIZATION.common.scenarioFallbackName)
    );
  }, [selectedScenarioObj]);

  const fetchUserScenarios = useCallback(async () => {
    try {
      const data = await getUserScenarios();
      setScenarioOptions(data);
      setLoadingScenario(false);

      if (data?.length) {
        const stored = localStorage.getItem(STORAGE_KEYS.selectedScenarioVisualization);
        if (stored && data.some((s) => s.id === stored)) setSelectedScenario(stored);
        else setSelectedScenario(data[0].id);
      }
    } catch (error) {
      setLoadingScenario(false);
      showSnackbar({
        title: VISUALIZATION.stopRadiusAnalysis.errors.fetchScenarioFailed,
        detail: error.message,
        severity: "error",
      });
    }
  }, [getUserScenarios, showSnackbar]);

  useEffect(() => {
    if (selectedScenario) {
      localStorage.setItem(STORAGE_KEYS.selectedScenarioVisualization, selectedScenario);
    }
  }, [selectedScenario]);

  useEffect(() => {
    fetchUserScenarios();
  }, [fetchUserScenarios]);

  const fetchPopulationData = useCallback(async () => {
    try {
      const response = await getPopulationData(selectedScenario);
      setPopulationData(response);
    } catch (error) {
      showSnackbar({
        title: VISUALIZATION.stopRadiusAnalysis.errors.fetchPopulationFailed,
        detail: error.message,
        severity: "error",
      });
    }
  }, [getPopulationData, selectedScenario, showSnackbar]);

  useEffect(() => {
    setRadiusFeatureCollection(null);
    setGraphData(null);
    if (!selectedScenario) return;

    getAllRouteAndStopsData({
      scenario_id: selectedScenario,
      is_using_shape_data: true,
      is_using_parent_stop: true,
    })
      .then((res) => {
        setAllRouteAndStopData(res?.data || null);
        setStopGroupingMethod(res?.data?.stop_grouping_method || "stop_name");
      })
      .catch((error) => {
        showSnackbar({
          title: VISUALIZATION.stopRadiusAnalysis.errors.fetchRoutesAndStopsFailed,
          detail: error.message,
          severity: "error",
        });
      });

    fetchPopulationData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScenario]);

  const handleCalculate = useCallback(async () => {
    if (!selectedScenario || !radius) return;
    const features = allRouteAndStopData?.features || [];
    if (!features.length) {
      showSnackbar({
        title: VISUALIZATION.stopRadiusAnalysis.errors.baseDataNotLoaded,
        detail: VISUALIZATION.common.emptyState.noResultsRunCalculation,
        severity: "warning",
      });
      return;
    }

    setLoadingRes(true);
    setLoadingGraph(true);
    try {
      const response = await getStopRadiusAnalysisMap({
        scenario_id: selectedScenario,
        radius: Number(radius),
        dissolve: "global",
        outline_only: false,
      });
      setRadiusFeatureCollection(response.radius ?? null);

      const graph = await getStopRadiusAnalysisMapGraph({
        scenario_id: selectedScenario,
        radius: Number(radius),
      });

      setRadiusKey((prev) => prev + 1);
      setGraphData(graph);
    } catch (error) {
      showSnackbar({
        title: VISUALIZATION.stopRadiusAnalysis.errors.mockDataGenerationFailed,
        detail: error.message,
        severity: "error",
      });
    } finally {
      setLoadingRes(false);
      setLoadingGraph(false);
    }
  }, [
    allRouteAndStopData?.features,
    getStopRadiusAnalysisMap,
    getStopRadiusAnalysisMapGraph,
    radius,
    selectedScenario,
    showSnackbar,
  ]);

  const handleReset = useCallback(() => {
    setRadiusFeatureCollection(null);
    setGraphData(null);
    setRadius(VISUALIZATION_DEFAULTS.stopRadiusAnalysis.radiusM);
  }, []);

  return {
    scenarioOptions,
    selectedScenario,
    setSelectedScenario,
    loadingScenario,
    stopGroupingMethod,
    radius,
    setRadius,
    radiusFeatureCollection,
    radiusKey,
    allRouteAndStopData,
    populationData,
    loadingRes,
    loadingGraph,
    graphData,
    handleCalculate,
    handleReset,
    currentScenarioName,
  };
}

