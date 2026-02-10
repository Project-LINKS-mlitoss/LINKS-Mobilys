import { useCallback, useEffect, useMemo, useState } from "react";

import { useSnackbarStore } from "../../../../state/snackbarStore";
import { useVisualizationServices } from "../../hooks/useVisualizationServices";
import { STORAGE_KEYS, TIME } from "../../../../constant/ui";
import { VISUALIZATION_DEFAULTS } from "../../../../constant/validation";
import { VISUALIZATION } from "@/strings";

import {
    clampDateToRange,
    getCurrentTimeHHMMSS,
    getTodayISODate,
    toNumber,
} from "../utils/networkAnalysisUtils";

export function useBufferAnalysis() {
    const [scenarioOptions, setScenarioOptions] = useState([]);

    const [selectedScenario, setSelectedScenario] = useState(() => {
        const stored = localStorage.getItem(
            STORAGE_KEYS.selectedScenarioVisualization,
        );
        return stored || "";
    });

    const [loadingScenario, setLoadingScenario] = useState(true);

    const TIME_INTERVALS =
        VISUALIZATION_DEFAULTS.bufferAnalysis.timeIntervalsMinutes;
    const layerTimesSecondsCsv = useMemo(
        () =>
            TIME_INTERVALS.map((minutes) =>
                String(minutes * TIME.secondsPerMinute),
            ).join(","),
        [TIME_INTERVALS],
    );
    const maxTravelTimeMinutes = TIME_INTERVALS[TIME_INTERVALS.length - 1] ?? 0;

    const [activeCutoffIdx, setActiveCutoffIdx] = useState(
        VISUALIZATION_DEFAULTS.bufferAnalysis.defaultActiveIntervalIndex,
    );
    const [graphDataByCutoff, setGraphDataByCutoff] = useState([]);

    const [coords, setCoords] = useState({});

    const today = useMemo(() => getTodayISODate(), []);
    const [date, setDate] = useState(today);

    const currentTime = useMemo(() => getCurrentTimeHHMMSS(), []);
    const [time, setTime] = useState(currentTime);

    const currentScenario = useMemo(
        () =>
            scenarioOptions.find(
                (s) => String(s.id) === String(selectedScenario),
            ) || null,
        [scenarioOptions, selectedScenario],
    );

    const currentScenarioName =
        currentScenario?.scenario_name ??
        currentScenario?.name ??
        currentScenario?.display_name ??
        "";

    const [speed, setSpeed] = useState(VISUALIZATION_DEFAULTS.walkingSpeedKmh);

    const [graphData, setGraphData] = useState(null);
    const [loadingGraph, setLoadingGraph] = useState(false);
    const [loadingRes, setLoadingRes] = useState(false);

    const [bufferGeojsonLayers, setBufferGeojsonLayers] = useState([]);
    const [routeGeojson, setRouteGeojson] = useState(null);
    const [stopGeojson, setStopGeojson] = useState(null);
    const [mapFocusTrigger, setMapFocusTrigger] = useState("scenario");
    const [populationData, setPopulationData] = useState(null);
    const [bufferVersion, setBufferVersion] = useState(0);

    const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
    const {
        getUserScenarios,
        getBufferAnalysisGraphData,
        fetchFP004MapFeaturesData,
        fetchFP004RouteGroupsAndStopsData,
        getPopulationData,
    } = useVisualizationServices();

    const [poiData, setPoiData] = useState([]); // only after POI graph fetch
    const [populationWithinBuffer, setPopulationWithinBuffer] = useState([]);

    const selectedScenarioObj = useMemo(() => {
        if (!selectedScenario) return null;
        if (typeof selectedScenario === "object") return selectedScenario;
        return (
            scenarioOptions.find((option) => option.id === selectedScenario) ||
            null
        );
    }, [selectedScenario, scenarioOptions]);

    const scenarioStartDate = selectedScenarioObj?.start_date || "";
    const scenarioEndDate = selectedScenarioObj?.end_date || "";

    const clampDateToScenario = useCallback(
        (rawDate) =>
            clampDateToRange(rawDate, {
                startDate: scenarioStartDate,
                endDate: scenarioEndDate,
            }),
        [scenarioStartDate, scenarioEndDate],
    );

    const handleDateChange = useCallback(
        (rawDate) => {
            if (!rawDate) {
                setDate(rawDate);
                return;
            }
            const bounded = clampDateToScenario(rawDate);
            setDate(bounded);
        },
        [clampDateToScenario],
    );

    useEffect(() => {
        if (!selectedScenarioObj) return;
        setDate((prev) => {
            const base = prev || today;
            const bounded = clampDateToScenario(base);
            if (!bounded) return prev;
            return bounded === prev ? prev : bounded;
        });
    }, [selectedScenarioObj, clampDateToScenario, today]);

    const mergePOIs = useCallback((data1, data2) => {
        const merged = [...data2];
        let nextId = data2.reduce((max, item) => Math.max(max, item.id), 0) + 1;
        data1.forEach((group) => {
            const type = group.poi_type;
            (group.details || []).forEach((detail) => {
                const name = detail.poi_name;
                const lat = detail.lat;
                const lng = detail.lon;
                const exists = merged.some(
                    (item) =>
                        item.type === type &&
                        item.name === name &&
                        item.lat === lat &&
                        item.lng === lng,
                );
                if (!exists) {
                    merged.push({ id: nextId++, type, name, lat, lng });
                }
            });
        });
        return merged;
    }, []);

    const fetchUserScenarios = useCallback(async () => {
        try {
            const data = await getUserScenarios();
            setScenarioOptions(data);
            setLoadingScenario(false);
            if (data.length > 0) {
                const stored = localStorage.getItem(
                    STORAGE_KEYS.selectedScenarioVisualization,
                );
                if (stored && data.some((s) => s.id === stored))
                    setSelectedScenario(stored);
                else setSelectedScenario(data[0].id);
            }
        } catch (error) {
            setLoadingScenario(false);
            showSnackbar({
                title: VISUALIZATION.common.snackbars.fetchScenariosFailed,
                detail: error.message,
                severity: "error",
            });
        }
    }, [getUserScenarios, showSnackbar]);

    useEffect(() => {
        if (selectedScenario) {
            localStorage.setItem(
                STORAGE_KEYS.selectedScenarioVisualization,
                selectedScenario,
            );
        }
    }, [selectedScenario]);

    const fetchPopulationData = useCallback(async () => {
        try {
            const response = await getPopulationData(selectedScenario);
            setPopulationData(response);
        } catch (error) {
            showSnackbar({
                title: VISUALIZATION.common.snackbars.fetchPopulationFailed,
                detail: error.message,
                severity: "error",
            });
        }
    }, [getPopulationData, selectedScenario, showSnackbar]);

    const fetchRouteAndStopData = useCallback(async () => {
        if (!selectedScenario) return;
        try {
            setLoadingRes(true);
            const response = await fetchFP004RouteGroupsAndStopsData({
                scenario_id: selectedScenario,
                is_using_shape_data: true,
                is_using_parent_stop: true,
            });
            setRouteGeojson(response.routesGeoJSON);
            setStopGeojson(response.stopsGeoJSON);
            setCoords({
                lat: response.routesGeoJSON.features[0].geometry
                    .coordinates[0][1],
                lng: response.routesGeoJSON.features[0].geometry
                    .coordinates[0][0],
            });
        } catch (error) {
            showSnackbar({
                title: VISUALIZATION.common.snackbars.fetchRoutesStopsFailed,
                detail: error.message,
                severity: "error",
            });
        } finally {
            setLoadingRes(false);
        }
    }, [fetchFP004RouteGroupsAndStopsData, selectedScenario, showSnackbar]);

    const getGraphData = useCallback(async () => {
        setLoadingGraph(true);
        try {
            const data = await getBufferAnalysisGraphData({
                lat: coords.lat,
                lon: coords.lng,
                departure_date: date,
                departure_time: time,
                walking_speed:
                    (Number(speed) * TIME.metersPerKm) / TIME.secondsPerHour,
                scenario_id: selectedScenario,
                layer_times: layerTimesSecondsCsv,
                max_travel_time: maxTravelTimeMinutes,
            });
            setGraphData(data);
            const allPois = mergePOIs(data.POIGraphData, []);
            setPoiData(allPois);
        } catch (error) {
            showSnackbar({
                title: VISUALIZATION.common.snackbars.fetchGraphDataFailed,
                detail: error.message,
                severity: "error",
            });
        } finally {
            setLoadingGraph(false);
        }
    }, [
        coords.lat,
        coords.lng,
        date,
        getBufferAnalysisGraphData,
        mergePOIs,
        selectedScenario,
        showSnackbar,
        speed,
        time,
    ]);

    const getMapFeatures = useCallback(async () => {
        setLoadingRes(true);
        try {
            const layers = [];
            const populationWithinBufferArr = [];
            for (const t of TIME_INTERVALS) {
                const params = {
                    scenario_id: selectedScenario,
                    lat: coords.lat,
                    lon: coords.lng,
                    departure_time: time,
                    departure_date: date,
                    walking_speed:
                        (toNumber(speed) * TIME.metersPerKm) /
                        TIME.secondsPerHour,
                    max_travel_time: t,
                };
                const result = await fetchFP004MapFeaturesData(params);
                if (result?.features?.length > 0) layers.push(result);
                if (result?.populationData) {
                    populationWithinBufferArr.push({
                        data: result.populationData,
                    });
                }
            }
            setBufferVersion((v) => v + 1);
            setPopulationWithinBuffer(populationWithinBufferArr);
            setBufferGeojsonLayers(layers);
        } catch (error) {
            showSnackbar({
                title: VISUALIZATION.common.snackbars.fetchMapFeaturesFailed,
                detail: error.message,
                severity: "error",
            });
        } finally {
            setLoadingRes(false);
        }
    }, [
        TIME_INTERVALS,
        coords.lat,
        coords.lng,
        date,
        fetchFP004MapFeaturesData,
        selectedScenario,
        showSnackbar,
        speed,
        time,
    ]);

    const getAllGraphData = useCallback(async () => {
        setLoadingGraph(true);
        try {
            const results = [];
            for (const t of TIME_INTERVALS) {
                const one = await getBufferAnalysisGraphData({
                    lat: coords.lat,
                    lon: coords.lng,
                    departure_date: date,
                    departure_time: time,
                    walking_speed:
                        (Number(speed) * TIME.metersPerKm) /
                        TIME.secondsPerHour,
                    scenario_id: selectedScenario,
                    max_travel_time: t,
                });
                results.push(one);
            }
            setGraphDataByCutoff(results);

            const last = results[results.length - 1];
            if (last?.POIGraphData) {
                const allPois = mergePOIs(last.POIGraphData, []);
                setPoiData(allPois);
            }
        } catch (error) {
            showSnackbar({
                title: VISUALIZATION.common.snackbars.fetchGraphDataFailed,
                detail: error.message,
                severity: "error",
            });
        } finally {
            setLoadingGraph(false);
        }
    }, [
        TIME_INTERVALS,
        coords.lat,
        coords.lng,
        date,
        getBufferAnalysisGraphData,
        mergePOIs,
        selectedScenario,
        showSnackbar,
        speed,
        time,
    ]);

    const handleCalculate = useCallback(async () => {
        await getMapFeatures();
        await getAllGraphData();
        setActiveCutoffIdx(TIME_INTERVALS.length - 1);
        setMapFocusTrigger("buffer");
    }, [TIME_INTERVALS.length, getAllGraphData, getMapFeatures]);

    const handleCutoffIndexChange = useCallback((idx) => {
        setActiveCutoffIdx(idx);
    }, []);

    const handleCoordsChange = useCallback(async (newCoords) => {
        setCoords(newCoords);
    }, []);

    const handleMapClick = useCallback(async (latlng) => {
        setCoords(latlng);
        setMapFocusTrigger("coords");
    }, []);

    const handleReset = useCallback(() => {
        setMapFocusTrigger("scenario");
        fetchRouteAndStopData();
        setBufferGeojsonLayers([]);
        setRouteGeojson(null);
        setStopGeojson(null);
        setGraphData(null);
        setPoiData([]); // cleared until POI graph fetch
        setLoadingGraph(false);
        setLoadingRes(false);
        setCoords({});
        handleDateChange(today);
        setTime(currentTime);
        setMapFocusTrigger("scenario");
        fetchPopulationData();
        setActiveCutoffIdx(0);
        setGraphDataByCutoff([]);
        setLoadingRes(true);
        setBufferVersion((v) => v + 1);
    }, [
        currentTime,
        fetchPopulationData,
        fetchRouteAndStopData,
        handleDateChange,
        today,
    ]);

    useEffect(() => {
        fetchUserScenarios();
    }, [fetchUserScenarios]);

    useEffect(() => {
        if (selectedScenario) {
            handleReset();
        }
    }, [handleReset, selectedScenario]);

    return {
        scenarioOptions,
        selectedScenario,
        setSelectedScenario,
        loadingScenario,
        TIME_INTERVALS,
        activeCutoffIdx,
        graphDataByCutoff,
        coords,
        date,
        handleDateChange,
        time,
        setTime,
        speed,
        setSpeed,
        currentScenarioName,
        graphData,
        loadingGraph,
        loadingRes,
        bufferGeojsonLayers,
        routeGeojson,
        stopGeojson,
        mapFocusTrigger,
        populationData,
        bufferVersion,
        poiData,
        populationWithinBuffer,
        handleCalculate,
        handleReset,
        handleCoordsChange,
        handleMapClick,
        handleCutoffIndexChange,
        getGraphData,
        setCoords,
        setMapFocusTrigger,
        setPopulationData,
    };
}
