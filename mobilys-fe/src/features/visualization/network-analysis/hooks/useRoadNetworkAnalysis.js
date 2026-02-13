// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { useSnackbarStore } from "../../../../state/snackbarStore";
import { useVisualizationServices } from "../../hooks/useVisualizationServices";
import { POLLING_INTERVAL_MS, STORAGE_KEYS } from "../../../../constant/ui";
import { VISUALIZATION_DEFAULTS } from "../../../../constant/validation";
import { VISUALIZATION_MAP_DEFAULTS } from "../../../../constant/map";
import { VISUALIZATION } from "@/strings";

import {
    clampDateToRange,
    getCurrentTimeHHMM,
    getScenarioDisplayName,
    getScenarioId,
    getTodayISODate,
    toNumber,
} from "../utils/networkAnalysisUtils";

function isTerminalGraphStatus(status) {
    return (
        status === "built" ||
        status === "rebuilt" ||
        status === "failed" ||
        status === "rebuild_failed"
    );
}

export function useRoadNetworkAnalysis({ graphType }) {
    const {
        getUserScenarios,
        getRoadNetworkIsochroneData,
        getRoadNetworkAnalysisGraphData,
        getGraphBuildingStatus,
        buildGraph,
        getPopulationData,
        checkPrefectureAvailability,
        fetchFP004RouteGroupsAndStopsData,
    } = useVisualizationServices();

    const [scenarioOptions, setScenarioOptions] = useState([]);

    const [selectedScenario, setSelectedScenario] = useState(() => {
        const stored = localStorage.getItem(
            STORAGE_KEYS.selectedScenarioVisualization,
        );
        return stored || "";
    });

    const loadingScenario = false;
    const [coords, setCoords] = useState(
        VISUALIZATION_MAP_DEFAULTS.roadNetworkCenterLatLng,
    );

    const today = useMemo(() => getTodayISODate(), []);
    const [date, setDate] = useState(today);

    const currentTime = useMemo(() => getCurrentTimeHHMM(), []);
    const [time, setTime] = useState(currentTime);

    const [maxwalkingdistance, setMaxWalkingDistance] = useState(
        VISUALIZATION_DEFAULTS.roadNetwork.maxWalkingDistanceM,
    );
    const [speed, setSpeed] = useState(VISUALIZATION_DEFAULTS.walkingSpeedKmh);
    const [percentile, setPercentile] = useState(
        VISUALIZATION_DEFAULTS.roadNetwork.percentile,
    );

    const [loadingRes, setLoadingRes] = useState(false);
    const [graphData, setGraphData] = useState(false);
    const [isochroneData, setIsochroneData] = useState(null);
    const [routeGeojson, setRouteGeojson] = useState(null);
    const [stopGeojson, setStopGeojson] = useState(null);

    const [graphStatus, setGraphStatus] = useState(null);
    const [graphStatusUpdatedAt, setGraphStatusUpdatedAt] = useState(null);
    const pollRef = useRef(null);
    const prevGraphStatusRef = useRef(null);

    const [confirmOpen, setConfirmOpen] = useState(false);
    const [poiData, setPoiData] = useState([]);
    const [populationData, setPopulationData] = useState(null);
    const [populationDataWithinIsochrone, setPopulationDataWithinIsochrone] =
        useState(null);

    const [prefAvail, setPrefAvail] = useState({
        ok: true,
        missing: [],
        needed: [],
        available: [],
        graphType,
    });
    const [prefAvailLoading, setPrefAvailLoading] = useState(false);

    const [maxMinutes, setMaxMinutes] = useState(null);
    const [analysisMessage, setAnalysisMessage] = useState("");

    const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
    const location = useLocation();

    const scenarioIdFromUrl = useMemo(
        () => (location.search ? location.search.substring(1) : ""),
        [location.search],
    );

    const selectedScenarioObj = useMemo(() => {
        if (!selectedScenario) return null;
        if (typeof selectedScenario === "object") return selectedScenario;
        return (
            scenarioOptions.find((option) => option.id === selectedScenario) ||
            null
        );
    }, [selectedScenario, scenarioOptions]);

    const currentScenarioName = useMemo(
        () =>
            getScenarioDisplayName(
                selectedScenarioObj,
                VISUALIZATION.common.scenarioFallbackName,
            ),
        [selectedScenarioObj],
    );

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

    const fetchUserScenarios = useCallback(async () => {
        getUserScenarios()
            .then((data) => {
                setScenarioOptions(data);
                if (data.length > 0) {
                    const stored = localStorage.getItem(
                        STORAGE_KEYS.selectedScenarioVisualization,
                    );
                    if (stored && data.some((s) => s.id === stored)) {
                        setSelectedScenario(stored);
                    } else {
                        setSelectedScenario(data[0].id);
                    }
                }
            })
            .catch((error) => {
                showSnackbar({
                    title: VISUALIZATION.common.snackbars.fetchScenariosFailed,
                    detail: error.message,
                    severity: "error",
                });
            });
    }, [getUserScenarios, showSnackbar]);

    useEffect(() => {
        if (!selectedScenario) return;
        setPrefAvailLoading(true);
        checkPrefectureAvailability(selectedScenario, graphType)
            .then((res) => {
                return setPrefAvail(res);
            })
            .catch((e) => {
                setPrefAvail({
                    ok: false,
                    missing: [],
                    needed: [],
                    available: [],
                    graphType,
                });
                showSnackbar({
                    title: VISUALIZATION.common.snackbars
                        .checkPrefAvailabilityFailed,
                    detail: e.message,
                    severity: "error",
                });
            })
            .finally(() => setPrefAvailLoading(false));
    }, [
        checkPrefectureAvailability,
        graphType,
        selectedScenario,
        showSnackbar,
    ]);

    useEffect(() => {
        if (selectedScenario) {
            localStorage.setItem(
                STORAGE_KEYS.selectedScenarioVisualization,
                selectedScenario,
            );
        }
    }, [selectedScenario]);

    const clearPoll = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, []);

    const fetchGraphStatus = useCallback(
        async (scenarioId, { suppressToast = false } = {}) => {
            try {
                const statusResponse = await getGraphBuildingStatus(scenarioId);
                const statusKey =
                    graphType === "drm"
                        ? "drm_graph_status"
                        : "osm_graph_status";
                const status = statusResponse?.[statusKey];

                const prev = prevGraphStatusRef.current;
                const changed = status !== prev;
                const wasRunning =
                    prev === "pending" ||
                    prev === "building" ||
                    prev === "rebuilding";
                const nowTerminal = isTerminalGraphStatus(status);

                if (!suppressToast && changed && wasRunning && nowTerminal) {
                    if (status === "built" || status === "rebuilt") {
                        showSnackbar({
                            title: VISUALIZATION.common.snackbars
                                .networkGraphReady,
                            detail: String(status || ""),
                            severity: "success",
                        });
                    } else {
                        showSnackbar({
                            title: VISUALIZATION.common.snackbars
                                .networkGraphBuildFailed,
                            detail: String(status || ""),
                            severity: "error",
                        });
                    }
                }

                prevGraphStatusRef.current = status;
                setGraphStatus(status);
                setGraphStatusUpdatedAt(Date.now());
                return status;
            } catch (error) {
                showSnackbar({
                    title: VISUALIZATION.common.snackbars
                        .fetchGraphBuildStatusFailed,
                    detail: error.message,
                    severity: "error",
                });
                return null;
            }
        },
        [getGraphBuildingStatus, graphType, showSnackbar],
    );

    const startStatusPolling = useCallback(
        async (scenarioId) => {
            clearPoll();
            await fetchGraphStatus(scenarioId, { suppressToast: false });
            pollRef.current = setInterval(async () => {
                const current = await fetchGraphStatus(scenarioId, {
                    suppressToast: false,
                });
                if (isTerminalGraphStatus(current)) clearPoll();
            }, POLLING_INTERVAL_MS.roadNetworkGraphStatus);
        },
        [clearPoll, fetchGraphStatus],
    );

    useEffect(() => () => clearPoll(), [clearPoll]);

    const createandUpdateGraph = useCallback(async () => {
        try {
            if (!selectedScenario) return;
            const scenarioId = getScenarioId(selectedScenario);
            if (!scenarioId) return;

            if (graphStatus === "pending") {
                setGraphStatus("building");
                setGraphStatusUpdatedAt(Date.now());
                prevGraphStatusRef.current = "building";
                await buildGraph({ scenarioId, graphType });
                startStatusPolling(scenarioId);
                return;
            }

            if (isTerminalGraphStatus(graphStatus)) {
                setGraphStatus("rebuilding");
                setGraphStatusUpdatedAt(Date.now());
                prevGraphStatusRef.current = "rebuilding";
                await buildGraph({ scenarioId, graphType });
                startStatusPolling(scenarioId);
                return;
            }

            await fetchGraphStatus(scenarioId, { suppressToast: true });
        } catch (error) {
            showSnackbar({
                title: VISUALIZATION.common.snackbars.startGraphBuildFailed,
                detail: error.message,
                severity: "error",
            });
        }
    }, [
        buildGraph,
        fetchGraphStatus,
        graphStatus,
        graphType,
        selectedScenario,
        showSnackbar,
        startStatusPolling,
    ]);

    const routesReqIdRef = useRef(0);
    const handleFetchRoutes = useCallback(
        async (scenarioId) => {
            setRouteGeojson(null);
            setStopGeojson(null);

            const reqId = ++routesReqIdRef.current;
            setLoadingRes(true);
            try {
                const response = await fetchFP004RouteGroupsAndStopsData({
                    scenario_id: scenarioId,
                    is_using_shape_data: true,
                    is_using_parent_stop: true,
                });

                if (reqId !== routesReqIdRef.current) return;

                setRouteGeojson(response?.routesGeoJSON || null);
                setStopGeojson(response?.stopsGeoJSON || null);

                const first =
                    response?.routesGeoJSON?.features?.[0]?.geometry
                        ?.coordinates?.[0];
                if (first && Array.isArray(first) && first.length >= 2) {
                    const [lng, lat] = first;
                    setCoords({ lat, lng });
                }
            } catch (error) {
                if (reqId !== routesReqIdRef.current) return;
                showSnackbar({
                    title: VISUALIZATION.common.snackbars
                        .fetchRoutesStopsFailed,
                    detail: error.message,
                    severity: "error",
                });
            } finally {
                if (reqId === routesReqIdRef.current) setLoadingRes(false);
            }
        },
        [fetchFP004RouteGroupsAndStopsData, showSnackbar],
    );

    const latestScenarioIdRef = useRef(null);
    const fetchPopulationDataSafe = useCallback(
        async (scenarioId) => {
            latestScenarioIdRef.current = scenarioId;
            try {
                const response = await getPopulationData(scenarioId);
                if (latestScenarioIdRef.current === scenarioId)
                    setPopulationData(response || null);
            } catch (error) {
                if (latestScenarioIdRef.current === scenarioId) {
                    showSnackbar({
                        title: VISUALIZATION.common.snackbars
                            .fetchPopulationFailed,
                        detail: error.message,
                        severity: "error",
                    });
                }
            }
        },
        [getPopulationData, showSnackbar],
    );

    const handleGenerateBuffer = useCallback(async () => {
        setLoadingRes(true);
        setAnalysisMessage("");
        setGraphData(false);
        setPoiData([]);
        setPopulationDataWithinIsochrone(null);
        let isochroneReady = false;
        try {
            const scenarioId = getScenarioId(selectedScenario);
            const params = {
                origin_lat: coords.lat,
                origin_lon: coords.lng,
                date,
                start_time: time,
                mode: "WALK,TRANSIT",
                max_walking_distance: maxwalkingdistance,
                walking_speed: toNumber(speed),
                scenario_id: scenarioId,
                graph_type: graphType,
            };

            const isochroneResponse = await getRoadNetworkIsochroneData(params);

            if (isochroneResponse?.error && isochroneResponse.status === 400) {
                setGraphData(false);
                setIsochroneData(null);
                setPoiData([]);
                setPopulationDataWithinIsochrone(null);
                setAnalysisMessage(isochroneResponse.message);
                setLoadingRes(false);
                showSnackbar({
                    title: VISUALIZATION.common.snackbars.errorTitle,
                    detail: isochroneResponse.message,
                    severity: "error",
                });
                return;
            }

            const isochrone = isochroneResponse?.isochrone;
            setIsochroneData(isochrone);
            isochroneReady = true;
            setLoadingRes(false);
            setAnalysisMessage(VISUALIZATION.common.messages.loadingGraphData);

            const graphResponse = await getRoadNetworkAnalysisGraphData({
                isochrone,
                scenarioId,
            });

            if (graphResponse?.error && graphResponse.status === 400) {
                setGraphData(false);
                setPoiData([]);
                setPopulationDataWithinIsochrone(null);
                setAnalysisMessage(graphResponse.message);
                showSnackbar({
                    title: VISUALIZATION.common.snackbars.errorTitle,
                    detail: graphResponse.message,
                    severity: "error",
                });
                return;
            }

            setAnalysisMessage("");
            setGraphData(graphResponse.graphData);
            setIsochroneData(isochrone);
            setPoiData(graphResponse.mergedPois);
            setPopulationDataWithinIsochrone(
                graphResponse.data.population_within_isochrone,
            );
        } catch (error) {
            setLoadingRes(false);
            if (!isochroneReady) setIsochroneData(null);

            console.error("Error generating buffer:", error);
            showSnackbar({
                title: VISUALIZATION.common.snackbars.errorTitle,
                detail:
                    error.message ||
                    VISUALIZATION.common.snackbars.generateBufferFailed,
                severity: "error",
            });
        }
    }, [
        coords.lat,
        coords.lng,
        date,
        getRoadNetworkAnalysisGraphData,
        getRoadNetworkIsochroneData,
        graphType,
        maxwalkingdistance,
        selectedScenario,
        showSnackbar,
        speed,
        time,
    ]);

    const handleMapClick = useCallback((coordsVal) => {
        setCoords({ lat: coordsVal.lat, lng: coordsVal.lng });
    }, []);

    useEffect(() => {
        fetchUserScenarios();
    }, [fetchUserScenarios]);

    useEffect(() => {
        if (
            scenarioOptions.length > 0 &&
            scenarioIdFromUrl &&
            scenarioOptions.some((s) => s.id === scenarioIdFromUrl)
        ) {
            setSelectedScenario(scenarioIdFromUrl);
        }
    }, [scenarioOptions, scenarioIdFromUrl]);

    useEffect(() => {
        if (
            scenarioOptions.length > 0 &&
            !scenarioIdFromUrl &&
            !selectedScenario
        ) {
            setSelectedScenario(scenarioOptions[0].id);
        }
    }, [scenarioOptions, scenarioIdFromUrl, selectedScenario]);

    useEffect(() => {
        if (!selectedScenario) return;
        const scenarioId = getScenarioId(selectedScenario);

        setGraphData(false);
        setIsochroneData(null);
        setPoiData([]);
        setMaxMinutes(null);

        handleFetchRoutes(scenarioId);
        fetchPopulationDataSafe(scenarioId);

        (async () => {
            await fetchGraphStatus(scenarioId, { suppressToast: true });
            clearPoll();
        })();
    }, [
        clearPoll,
        fetchGraphStatus,
        fetchPopulationDataSafe,
        handleFetchRoutes,
        selectedScenario,
    ]);

    const onRefreshGraphStatus = useCallback(() => {
        if (!selectedScenario) return;
        const scenarioId = getScenarioId(selectedScenario);
        fetchGraphStatus(scenarioId, { suppressToast: true });
    }, [fetchGraphStatus, selectedScenario]);

    const scenarioIdForChild = useMemo(
        () => getScenarioId(selectedScenario),
        [selectedScenario],
    );

    return {
        scenarioOptions,
        selectedScenario,
        setSelectedScenario,
        loadingScenario,
        coords,
        setCoords,
        date,
        handleDateChange,
        time,
        setTime,
        maxwalkingdistance,
        setMaxWalkingDistance,
        speed,
        setSpeed,
        percentile,
        setPercentile,
        loadingRes,
        graphData,
        isochroneData,
        routeGeojson,
        stopGeojson,
        graphStatus,
        graphStatusUpdatedAt,
        confirmOpen,
        setConfirmOpen,
        poiData,
        populationData,
        populationDataWithinIsochrone,
        prefAvail,
        prefAvailLoading,
        maxMinutes,
        setMaxMinutes,
        analysisMessage,
        currentScenarioName,
        scenarioIdForChild,
        onRefreshGraphStatus,
        createandUpdateGraph,
        handleGenerateBuffer,
        handleMapClick,
        graphType,
    };
}
