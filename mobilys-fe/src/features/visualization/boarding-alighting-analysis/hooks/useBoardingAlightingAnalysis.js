// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSnackbarStore } from "../../../../state/snackbarStore";
import { STORAGE_KEYS, VISUALIZATION_LAYOUT } from "../../../../constant/ui";
import { VISUALIZATION } from "@/strings";

import { getUserScenarios } from "../../../../services/scenarioService";
import {
    fetchFP004RouteGroupsAndStopsData,
    getBoardingAlightingUploadData,
    getBoardingAlightingGetSegmentFilterData,
    getBoardingAlightingGetSegmentGraphData,
    postBoardingAlightingGetSegmentData,
    postBoardingAlightingRouteGroupApiService,
    postBoardingAlightingRoutesData,
    postBoardingAlightingRoutesDetailData,
} from "../../../../services/visualizationService";

import {
    LS_RG_PREFIX,
    buildStartEndFromFilter,
    createRouteScopeFromFilter,
    inflateRouteGroupData,
    parseCsvFile,
    parseCsvText,
    validateHeadersJyoukou,
} from "../helper/boardingAlightingUtils";
import {
    hasCsvInIDB,
    loadCsvFromIDB,
    removeCsvFromIDB,
} from "../../../../utils/indexDb";

export function useBoardingAlightingAnalysis() {
    const showSnackbar = useSnackbarStore((s) => s.showSnackbar);

    // scenario
    const [scenarioOptions, setScenarioOptions] = useState([]);
    const [loadingScenario, setLoadingScenario] = useState(true);
    const [selectedScenario, setSelectedScenario] = useState(
        localStorage.getItem(STORAGE_KEYS.selectedScenarioVisualization) || "",
    );

    const selectedScenarioObj = useMemo(
        () => scenarioOptions.find((s) => s.id === selectedScenario),
        [scenarioOptions, selectedScenario],
    );

    const activeScenarioName = useMemo(() => {
        const found = scenarioOptions.find((s) => s.id === selectedScenario);
        return (
            found?.scenario_name ||
            found?.name ||
            found?.label ||
            VISUALIZATION.common.scenarioFallbackName
        );
    }, [scenarioOptions, selectedScenario]);

    const selectedScenarioName =
        selectedScenarioObj?.scenario_name ||
        selectedScenarioObj?.name ||
        selectedScenarioObj?.label ||
        VISUALIZATION.common.scenarioFallbackName;

    // layout
    const [leftRatio, setLeftRatio] = useState(
        VISUALIZATION_LAYOUT.leftPanel.defaultRatio,
    );
    const mapContainerRef = useRef(null);

    const [forceUpdate, setForceUpdate] = useState(0);

    // visualization selection (for map-based views)
    const [selectedVisualization, setSelectedVisualization] = useState(0);
    const visualizationOptions = useMemo(
        () => [
            VISUALIZATION.boardingAlightingAnalysis.routeLevelTitle,
            VISUALIZATION.boardingAlightingAnalysis.visualizationOptions
                .segmentUsersByTime,
            VISUALIZATION.boardingAlightingAnalysis.visualizationOptions
                .stopUsers,
        ],
        [],
    );

    // full-screen dashboard flag
    const [showDashboard, setShowDashboard] = useState(false);

    // data states
    const [boardingAlightingData, setBoardingAlightingData] = useState(null);
    const [allRoutesData, setAllRoutesData] = useState(null);

    // routes viz
    const [routesFilter, setRoutesFilter] = useState({
        metric: "in_vehicle",
        date: VISUALIZATION.common.filters.all,
        timeMode: "all",
        hour: 7,
        routeId: "",
        tripId: "",
    });
    const [metric, setMetric] = useState("in_car");
    const [boardingAlightingResult, setBoardingAlightingResult] =
        useState(null);

    // route-group / maps
    const [availableRouteGroups, setAvailableRouteGroups] = useState([]);
    const [keywordRoutesMap, setKeywordRoutesMap] = useState({});
    const [routeTripsMap, setRouteTripsMap] = useState({});

    // segment viz
    const [routeSegmentData, setRouteSegmentData] = useState(null);
    const [routeSegmentFilterData, setRouteSegmentFilterData] = useState(null);
    const [routeSegmentGraphData, setRouteSegmentGraphData] = useState(null);

    const [selectedModeSegment, setSelectedModeSegment] = useState("in_car");
    const [selectedDate, setSelectedDate] = useState(VISUALIZATION.common.filters.all);
    const [selectedRouteGroup, setSelectedRouteGroup] = useState(VISUALIZATION.common.filters.all);
    const [selectedRoute, setSelectedRoute] = useState(VISUALIZATION.common.filters.all);
    const [selectedTrip, setSelectedTrip] = useState(VISUALIZATION.common.filters.all);
    const [selectedSegment, setSelectedSegment] = useState(null);
    const [selectedTimeRange, setSelectedTimeRange] = useState([0, 24]);

    // stop viz
    const [selectedStop, setSelectedStop] = useState(null);
    const [routeStopFilterData, setRouteStopFilterData] = useState(null);
    const [routeStopGraphData, setRouteStopGraphData] = useState(null);
    const [selectedDateStop, setSelectedDateStop] = useState(VISUALIZATION.common.filters.all);
    const [selectedRouteGroupStop, setSelectedRouteGroupStop] =
        useState(VISUALIZATION.common.filters.all);
    const [selectedRouteStop, setSelectedRouteStop] = useState(VISUALIZATION.common.filters.all);
    const [selectedTripStop, setSelectedTripStop] = useState(VISUALIZATION.common.filters.all);
    const [selectedModeStop, setSelectedModeStop] = useState("both");

    const [uploadedData, setUploadedData] = useState(null);
    const [showUploadModal, setShowUploadModal] = useState(false);

    const [globalLoading, setGlobalLoading] = useState(false);
    const withGlobalLoading = useCallback(async (fn) => {
        try {
            setGlobalLoading(true);
            return await fn();
        } finally {
            setGlobalLoading(false);
        }
    }, []);

    const [loadingFilter, setLoadingFilter] = useState(false);

    // Clicking the segment or stop on visualization 0
    const lastRoutesReqRef = useRef(null);
    const [clickDialog, setClickDialog] = useState({
        open: false,
        mode: null, // 'segment' | 'stop'
        loading: false,
        error: null,
        summary: null, // result.data.summary
    });

    const loadCsvRowsFromIDB = useCallback(async (scenarioId) => {
        const blob = await loadCsvFromIDB({ prefix: "joukou", scenarioId });
        if (!blob) return [];
        const text = await blob.text();
        return await parseCsvText(text);
    }, []);

    // ========= Effects =========

    // Fetch scenarios
    useEffect(() => {
        withGlobalLoading(async () => {
            setLoadingScenario(true);
            try {
                const res = await getUserScenarios();
                setScenarioOptions(res || []);
                if (res && res.length > 0) {
                    const stored = localStorage.getItem(
                        STORAGE_KEYS.selectedScenarioVisualization,
                    );
                    if (stored && res.some((s) => s.id === stored)) {
                        setSelectedScenario(stored);
                    } else {
                        setSelectedScenario(res[0].id);
                    }
                }
            } catch {
                setScenarioOptions([]);
            } finally {
                setLoadingScenario(false);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync selected scenario to LS
    useEffect(() => {
        if (selectedScenario) {
            localStorage.setItem(
                STORAGE_KEYS.selectedScenarioVisualization,
                selectedScenario,
            );
        }
    }, [selectedScenario]);

    // Load route+stop base data when visualization = 0
    useEffect(() => {
        if (selectedVisualization !== 0 || !selectedScenario) return;
        withGlobalLoading(async () => {
            try {
                const data = await fetchFP004RouteGroupsAndStopsData({
                    scenario_id: selectedScenario,
                    is_using_shape_data: true,
                    is_using_parent_stop: true,
                });
                setAllRoutesData(data);
            } catch {
                setAllRoutesData(null);
            }
        });
    }, [selectedVisualization, selectedScenario, withGlobalLoading]);

    // Load CSV rows from IDB whenever scenario changes
    useEffect(() => {
        if (!selectedScenario) return;

        (async () => {
            const has = await hasCsvInIDB({
                prefix: "joukou",
                scenarioId: selectedScenario,
            });
            if (!has) {
                setBoardingAlightingData(null);
            } else {
                const rows = await loadCsvRowsFromIDB(selectedScenario);
                setBoardingAlightingData(Array.isArray(rows) ? rows : []);
            }
        })();

        // load route-group JSON from LS
        const rgStr = localStorage.getItem(LS_RG_PREFIX + selectedScenario);
        if (rgStr) {
            try {
                const rgJson = JSON.parse(rgStr);
                const { groups, map, keywordTripsMap } =
                    inflateRouteGroupData(rgJson);
                setAvailableRouteGroups(groups);
                setKeywordRoutesMap(map);
                setRouteTripsMap(keywordTripsMap);
            } catch {
                setAvailableRouteGroups([]);
                setKeywordRoutesMap({});
                setRouteTripsMap({});
            }
        } else {
            setAvailableRouteGroups([]);
            setKeywordRoutesMap({});
            setRouteTripsMap({});
        }

        setForceUpdate((v) => v + 1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedScenario]);

    // ===== Upload handler (called by DataManagement after saving to IDB) =====
    const handleUploadCSV = useCallback(
        async (file, cb) => {
            if (!file || !selectedScenario) return;

            const results = await parseCsvFile(file);
            const fields = results?.meta?.fields ?? [];
            if (!validateHeadersJyoukou(fields)) {
                throw new Error(
                    VISUALIZATION.boardingAlightingAnalysis.upload.invalidCsvHeaders,
                );
            }

            const jsonData = results.data;
            setBoardingAlightingData(jsonData);
            cb?.();

            await withGlobalLoading(async () => {
                try {
                    const response = await getBoardingAlightingUploadData({
                        scenario_id: selectedScenario,
                        data: jsonData,
                    });
                    setUploadedData(response);
                    setShowUploadModal(true);
                } catch (err) {
                    console.error(
                        "Failed to fetch BoardingAlightingUploadData:",
                        err,
                    );
                    setUploadedData(null);
                    setShowUploadModal(false);
                }

                try {
                    const resp =
                        await postBoardingAlightingRouteGroupApiService({
                            scenario_id: selectedScenario,
                            data: jsonData,
                        });
                    localStorage.setItem(
                        LS_RG_PREFIX + selectedScenario,
                        JSON.stringify(resp),
                    );
                    const { groups, map, keywordTripsMap } =
                        inflateRouteGroupData(resp);
                    setAvailableRouteGroups(groups);
                    setKeywordRoutesMap(map);
                    setRouteTripsMap(keywordTripsMap);
                } catch (err) {
                    console.error("Failed to fetch RouteGroupData:", err);
                }
            });

            return true;
        },
        [selectedScenario, withGlobalLoading],
    );

    // Delete all data for current scenario
    const handleDeleteData = useCallback(async () => {
        if (!selectedScenario) return;
        try {
            await removeCsvFromIDB({
                prefix: "joukou",
                scenarioId: selectedScenario,
            });
        } catch {}
        localStorage.removeItem(LS_RG_PREFIX + selectedScenario);

        setBoardingAlightingData(null);
        setAvailableRouteGroups([]);
        setKeywordRoutesMap({});
        setBoardingAlightingResult(null);
        setForceUpdate((v) => v + 1);
        setSelectedStop(null);
        setRouteStopFilterData(null);
        setRouteStopGraphData(null);
        setSelectedDateStop(VISUALIZATION.common.filters.all);
        setSelectedRouteGroupStop(VISUALIZATION.common.filters.all);
        setSelectedRouteStop(VISUALIZATION.common.filters.all);
        setSelectedTripStop(VISUALIZATION.common.filters.all);
    }, [selectedScenario]);

    // ===== Routes filter =====
    const handleRoutesFilter = useCallback(
        async (filter) => {
            setRoutesFilter(filter);

            const localData = await loadCsvRowsFromIDB(selectedScenario);

            const dateValue =
                filter.date === VISUALIZATION.common.filters.all ||
                filter.date === "all"
                    ? ""
                    : filter.date;
            const tripIdValue =
                filter.tripId === VISUALIZATION.common.filters.all
                    ? ""
                    : filter.tripId;

            let startTime = "";
            let endTime = "";
            if (Array.isArray(filter.time)) {
                startTime = String(filter.time[0]).padStart(2, "0") + ":00:00";
                endTime =
                    Number(filter.time[1]) === 24
                        ? "23:59:59"
                        : String(filter.time[1]).padStart(2, "0") + ":00:00";
            } else if (filter.time === "all" || !filter.time) {
                startTime = "";
                endTime = "";
            } else {
                startTime = String(filter.time).padStart(2, "0") + ":00:00";
                endTime = String(filter.time).padStart(2, "0") + ":00:00";
            }

            const routeIdValue =
                !filter.routeId ||
                filter.routeId === VISUALIZATION.common.filters.all
                    ? ""
                    : filter.routeId;
            const routeKeywordValue =
                !filter.routeGroup ||
                filter.routeGroup === VISUALIZATION.common.filters.all
                    ? ""
                    : filter.routeGroup;

            const reqBody = {
                scenario_id: selectedScenario,
                route_id: routeIdValue,
                route_group: routeKeywordValue,
                type: filter.type,
                start_time: startTime,
                end_time: endTime,
                date: dateValue,
                trip_id: tripIdValue,
                data: localData,
            };

            lastRoutesReqRef.current = reqBody;

            setLoadingFilter(true);
            await withGlobalLoading(async () => {
                try {
                    const result =
                        await postBoardingAlightingRoutesData(reqBody);
                    setBoardingAlightingResult(result);
                } catch (err) {
                    console.error(err);
                    setBoardingAlightingResult(null);
                } finally {
                    setLoadingFilter(false);
                }
            });
        },
        [loadCsvRowsFromIDB, selectedScenario, withGlobalLoading],
    );

    const handleMetricChange = useCallback(
        (newMetric) => {
            setMetric(newMetric);
            const timeKey = routesFilter.time ?? routesFilter.timeMode ?? "all";
            handleRoutesFilter({
                ...routesFilter,
                type: newMetric,
                time: timeKey,
            });
        },
        [routesFilter, handleRoutesFilter],
    );

    // ===== Segment / stop data (visualization 1/2) =====
    useEffect(() => {
        (async () => {
            if (!selectedScenario) return;
            if (!(selectedVisualization === 1 || selectedVisualization === 2))
                return;

            const localData = await loadCsvRowsFromIDB(selectedScenario);
            if (!localData || localData.length === 0) {
                setRouteSegmentData(null);
                return;
            }

            await withGlobalLoading(async () => {
                try {
                    const response = await postBoardingAlightingGetSegmentData({
                        scenario_id: selectedScenario,
                        data: localData,
                        with_analytics: true,
                        offset_m: 10,
                    });
                    setRouteSegmentData(response.data || null);
                } catch {
                    setRouteSegmentData(null);
                }
            });
        })();
    }, [
        selectedVisualization,
        selectedScenario,
        forceUpdate,
        loadCsvRowsFromIDB,
        withGlobalLoading,
    ]);

    useEffect(() => {
        if (!availableRouteGroups.includes(selectedRouteGroup)) {
            setSelectedRouteGroup(VISUALIZATION.common.filters.all);
        }
    }, [availableRouteGroups, selectedRouteGroup]);

    useEffect(() => {
        if (selectedSegment) {
            setSelectedRouteGroup(VISUALIZATION.common.filters.all);
            setSelectedRoute(VISUALIZATION.common.filters.all);
            setSelectedTrip(VISUALIZATION.common.filters.all);
        }
    }, [selectedSegment]);

    useEffect(() => {
        (async () => {
            if (!selectedStop && !selectedSegment) return;
            const data = boardingAlightingData;

            await withGlobalLoading(async () => {
                if (selectedSegment) {
                    try {
                        const respFilter =
                            await getBoardingAlightingGetSegmentFilterData({
                                scenario_id: selectedScenario,
                                mode: "segment",
                                segment: selectedSegment,
                                data,
                            });
                        setRouteSegmentFilterData(
                            respFilter.data?.filters?.hierarchy ?? null,
                        );
                    } catch {
                        setRouteSegmentFilterData(null);
                    }

                    try {
                        const start_time = Array.isArray(selectedTimeRange)
                            ? String(selectedTimeRange[0]).padStart(2, "0") +
                              ":00:00"
                            : selectedTimeRange?.start_time;
                        const end_time = Array.isArray(selectedTimeRange)
                            ? Number(selectedTimeRange[1]) === 24
                                ? "23:59:59"
                                : String(selectedTimeRange[1]).padStart(
                                      2,
                                      "0",
                                  ) + ":00:00"
                            : selectedTimeRange?.end_time === "24:00:00"
                              ? "23:59:59"
                              : selectedTimeRange?.end_time;

                        const respGraph =
                            await getBoardingAlightingGetSegmentGraphData({
                                scenario_id: selectedScenario,
                                mode: "segment",
                                segment: selectedSegment,
                                type: selectedModeSegment,
                                start_time,
                                end_time,
                                route_groups:
                                    selectedRouteGroup === VISUALIZATION.common.filters.all
                                        ? []
                                        : [selectedRouteGroup],
                                routes:
                                    selectedRoute === VISUALIZATION.common.filters.all
                                        ? []
                                        : [selectedRoute],
                                trips:
                                    selectedTrip === VISUALIZATION.common.filters.all
                                        ? []
                                        : [selectedTrip],
                                data,
                                date:
                                    selectedDate === VISUALIZATION.common.filters.all
                                        ? ""
                                        : selectedDate,
                            });
                        setRouteSegmentGraphData(respGraph.data ?? null);
                    } catch {
                        setRouteSegmentGraphData(null);
                    }
                }

                if (selectedStop && selectedStop.properties?.stop_keyword) {
                    const stopKey = {
                        keyword: selectedStop.properties.stop_keyword,
                    };
                    const mkTime = (rng) =>
                        Array.isArray(rng)
                            ? [
                                  String(rng[0]).padStart(2, "0") + ":00:00",
                                  Number(rng[1]) === 24
                                      ? "23:59:59"
                                      : String(rng[1]).padStart(2, "0") +
                                        ":00:00",
                              ]
                            : [
                                  rng?.start_time,
                                  rng?.end_time === "24:00:00"
                                      ? "23:59:59"
                                      : rng?.end_time,
                              ];

                    try {
                        const respFilter =
                            await getBoardingAlightingGetSegmentFilterData({
                                scenario_id: selectedScenario,
                                mode: "stop",
                                stop: stopKey,
                                data,
                            });
                        setRouteStopFilterData(
                            respFilter.data?.filters?.hierarchy ?? null,
                        );
                    } catch {
                        setRouteStopFilterData(null);
                    }

                    const [st, et] = mkTime(selectedTimeRange);
                    const commonPayload = {
                        scenario_id: selectedScenario,
                        mode: "stop",
                        stop: stopKey,
                        start_time: st,
                        end_time: et,
                        date:
                            selectedDateStop === VISUALIZATION.common.filters.all
                                ? ""
                                : selectedDateStop,
                        route_groups:
                            selectedRouteGroupStop === VISUALIZATION.common.filters.all
                                ? []
                                : [selectedRouteGroupStop],
                        routes:
                            selectedRouteStop === VISUALIZATION.common.filters.all
                                ? []
                                : [selectedRouteStop],
                        trips:
                            selectedTripStop === VISUALIZATION.common.filters.all
                                ? []
                                : [selectedTripStop],
                        data,
                    };

                    try {
                        if (selectedModeStop === "both") {
                            const [respB, respA] = await Promise.all([
                                getBoardingAlightingGetSegmentGraphData({
                                    ...commonPayload,
                                    type: "boarding",
                                }),
                                getBoardingAlightingGetSegmentGraphData({
                                    ...commonPayload,
                                    type: "alighting",
                                }),
                            ]);
                            setRouteStopGraphData({
                                boarding: respB?.data ?? null,
                                alighting: respA?.data ?? null,
                            });
                        } else {
                            const resp =
                                await getBoardingAlightingGetSegmentGraphData({
                                    ...commonPayload,
                                    type: selectedModeStop,
                                });
                            setRouteStopGraphData(resp?.data ?? null);
                        }
                    } catch {
                        setRouteStopGraphData(null);
                    }
                }
            });
        })();
    }, [
        selectedSegment,
        selectedScenario,
        boardingAlightingData,
        selectedModeSegment,
        selectedTimeRange,
        selectedRouteGroup,
        selectedRoute,
        selectedTrip,
        selectedDate,
        selectedStop,
        selectedModeStop,
        selectedDateStop,
        selectedRouteGroupStop,
        selectedRouteStop,
        selectedTripStop,
        withGlobalLoading,
    ]);

    async function fetchClickDetail(payload) {
        try {
            const response =
                await postBoardingAlightingRoutesDetailData(payload);
            return response;
        } catch (err) {
            console.error(
                "Failed to fetch BoardingAlightingRoutesDetailData:",
                err,
            );
            return null;
        }
    }

    const handleMapSegmentClick = useCallback(
        async (seg) => {
            setClickDialog({
                open: true,
                mode: "segment",
                loading: true,
                error: null,
                summary: null,
            });

            try {
                const filter = routesFilter;
                const { start_time, end_time } =
                    buildStartEndFromFilter(filter);
                const { route_id, route_groups } =
                    createRouteScopeFromFilter(filter);
                const date =
                    filter?.date === VISUALIZATION.common.filters.all ||
                    filter?.date === "all"
                        ? ""
                        : filter?.date;

                const payload = {
                    scenario_id: selectedScenario,
                    mode: "segment",
                    type: "in_car",
                    label: {
                        from_keyword: seg?.properties?.from_keyword || "",
                        to_keyword: seg?.properties?.to_keyword || "",
                    },
                    start_time,
                    end_time,
                    date,
                    route_id,
                    route_groups,
                    data: boardingAlightingData || [],
                };

                const result = await fetchClickDetail(payload);
                setClickDialog({
                    open: true,
                    mode: "segment",
                    loading: false,
                    error: null,
                    summary: result?.data?.summary || null,
                });
            } catch (err) {
                setClickDialog({
                    open: true,
                    mode: "segment",
                    loading: false,
                    error: String(err?.message || err),
                    summary: null,
                });
            }
        },
        [routesFilter, selectedScenario, boardingAlightingData],
    );

    const handleMapStopClick = useCallback(
        async (stop) => {
            setClickDialog({
                open: true,
                mode: "stop",
                loading: true,
                error: null,
                summary: null,
            });

            try {
                const filter = routesFilter;
                const { start_time, end_time } =
                    buildStartEndFromFilter(filter);
                const { route_id, route_groups } =
                    createRouteScopeFromFilter(filter);
                const date =
                    filter?.date === VISUALIZATION.common.filters.all ||
                    filter?.date === "all"
                        ? ""
                        : filter?.date;

                const payload = {
                    scenario_id: selectedScenario,
                    mode: "stop",
                    type: metric || "in_car",
                    label: {
                        keyword:
                            stop?.properties?.keyword ||
                            stop?.properties?.stop_keyword ||
                            stop?.properties?.name ||
                            "",
                    },
                    start_time,
                    end_time,
                    date,
                    route_id,
                    route_groups,
                    data: boardingAlightingData || [],
                };

                const result = await fetchClickDetail(payload);
                setClickDialog({
                    open: true,
                    mode: "stop",
                    loading: false,
                    error: null,
                    summary: result?.data?.summary || null,
                });
            } catch (err) {
                setClickDialog({
                    open: true,
                    mode: "stop",
                    loading: false,
                    error: String(err?.message || err),
                    summary: null,
                });
            }
        },
        [routesFilter, selectedScenario, metric, boardingAlightingData],
    );

    const closeClickDialog = useCallback(
        () => setClickDialog((s) => ({ ...s, open: false })),
        [],
    );

    return {
        // snackbar
        showSnackbar,

        // scenario
        scenarioOptions,
        loadingScenario,
        selectedScenario,
        setSelectedScenario,
        selectedScenarioObj,
        selectedScenarioName,
        activeScenarioName,

        // layout
        leftRatio,
        setLeftRatio,
        mapContainerRef,

        // force refresh
        forceUpdate,
        setForceUpdate,

        // view selection
        selectedVisualization,
        setSelectedVisualization,
        visualizationOptions,
        showDashboard,
        setShowDashboard,

        // data
        boardingAlightingData,
        setBoardingAlightingData,
        allRoutesData,

        // routes
        routesFilter,
        setRoutesFilter,
        metric,
        boardingAlightingResult,
        availableRouteGroups,
        keywordRoutesMap,
        routeTripsMap,
        handleRoutesFilter,
        handleMetricChange,

        // segment
        routeSegmentData,
        routeSegmentFilterData,
        routeSegmentGraphData,
        selectedModeSegment,
        setSelectedModeSegment,
        selectedDate,
        setSelectedDate,
        selectedRouteGroup,
        setSelectedRouteGroup,
        selectedRoute,
        setSelectedRoute,
        selectedTrip,
        setSelectedTrip,
        selectedSegment,
        setSelectedSegment,
        selectedTimeRange,
        setSelectedTimeRange,

        // stop
        selectedStop,
        setSelectedStop,
        routeStopFilterData,
        routeStopGraphData,
        selectedDateStop,
        setSelectedDateStop,
        selectedRouteGroupStop,
        setSelectedRouteGroupStop,
        selectedRouteStop,
        setSelectedRouteStop,
        selectedTripStop,
        setSelectedTripStop,
        selectedModeStop,
        setSelectedModeStop,

        // upload flow
        uploadedData,
        showUploadModal,
        setShowUploadModal,
        handleUploadCSV,
        handleDeleteData,

        // loading / dialogs
        globalLoading,
        loadingFilter,
        clickDialog,
        handleMapSegmentClick,
        handleMapStopClick,
        closeClickDialog,
    };
}
