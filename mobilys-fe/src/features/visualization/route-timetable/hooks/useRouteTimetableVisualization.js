import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as htmlToImage from "html-to-image";

import { minutesToHHmmss } from "../../../../components/TimeRangeSlider";
import { buildFilename } from "../../../../components/visualization/buildFilename";
import { directionMap } from "../../../../constant/gtfs";
import { STORAGE_KEYS, TIME } from "../../../../constant/ui";
import { useSnackbarStore } from "../../../../state/snackbarStore";
import { useVisualizationServices } from "../../hooks/useVisualizationServices";
import { VISUALIZATION } from "@/strings";

import { toRouteGroupId, toServiceId } from "../helper/routeTimetableUtils";

export function useRouteTimetableVisualization() {
    const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
    const {
        getUserScenarios,
        getAllRouteAndStopsData,
        getNumberOfBusRunningVisualizationDetailData,
        getServicePerScenarioData,
    } = useVisualizationServices();

    const [scenarioOptions, setScenarioOptions] = useState([]);
    const [loadingScenario, setLoadingScenario] = useState(true);
    const [selectedScenario, setSelectedScenario] = useState(() => {
        return (
            localStorage.getItem(STORAGE_KEYS.selectedScenarioVisualization) ||
            ""
        );
    });

    const [allRouteAndStopData, setAllRouteAndStopData] = useState(null);
    const [loadingRoutes, setLoadingRoutes] = useState(false);

    const [routeGroupsOptions, setRouteGroupsOptions] = useState([]);
    const [selectedRouteGroups, setSelectedRouteGroups] = useState([]);

    const [groupingOption, setGroupingOption] = useState("parent");
    const [directionId, setDirectionId] = useState("");

    const [serviceIdOptions, setServiceIdOptions] = useState([]);
    const [selectedServiceIds, setSelectedServiceIds] = useState([]);

    const [timeRange, setTimeRange] = useState([0, TIME.minutesPerDay]);

    const [selectedStopMeta, setSelectedStopMeta] = useState(null);
    const [selectedStopDetail, setSelectedStopDetail] = useState(null);
    const [loadingStopDetail, setLoadingStopDetail] = useState(false);

    const resolveServiceIds = useCallback(() => {
        const pool =
            selectedServiceIds && selectedServiceIds.length > 0
                ? selectedServiceIds
                : serviceIdOptions;
        return (pool || [])
            .map((service) => toServiceId(service))
            .filter((value) => value !== "");
    }, [selectedServiceIds, serviceIdOptions]);

    const startTime = useMemo(() => minutesToHHmmss(timeRange[0]), [timeRange]);
    const endTime = useMemo(
        () => minutesToHHmmss(timeRange[1], { isEnd: true }),
        [timeRange],
    );

    const fetchScenarios = useCallback(async () => {
        try {
            setLoadingScenario(true);
            const list = (await getUserScenarios()) || [];
            setScenarioOptions(list);
            if (list.length === 0) return;

            const stored = localStorage.getItem(
                STORAGE_KEYS.selectedScenarioVisualization,
            );
            const existsInList = list.some(
                (item) => String(item.id) === String(stored),
            );
            if (stored && existsInList) setSelectedScenario(stored);
            else if (!selectedScenario) setSelectedScenario(list[0].id);
        } catch (error) {
            showSnackbar({
                title: VISUALIZATION.routeTimetable.errors.fetchScenarioFailed,
                severity: "error",
                detail: error?.message || "",
            });
        } finally {
            setLoadingScenario(false);
        }
    }, [getUserScenarios, selectedScenario, showSnackbar]);

    useEffect(() => {
        fetchScenarios();
    }, [fetchScenarios]);

    useEffect(() => {
        if (!selectedScenario) return;
        localStorage.setItem(
            STORAGE_KEYS.selectedScenarioVisualization,
            selectedScenario,
        );
    }, [selectedScenario]);

    useEffect(() => {
        if (!selectedScenario) {
            setAllRouteAndStopData(null);
            setServiceIdOptions([]);
            setSelectedServiceIds([]);
            setRouteGroupsOptions([]);
            setSelectedRouteGroups([]);
            setSelectedStopMeta(null);
            setSelectedStopDetail(null);
            return;
        }

        const fetchRoutes = async () => {
            setLoadingRoutes(true);
            try {
                const routesRes = await getAllRouteAndStopsData({
                    scenario_id: selectedScenario,
                    is_using_shape_data: true,
                    is_using_parent_stop: groupingOption === "parent",
                });
                const payload = routesRes?.data || null;
                setAllRouteAndStopData(payload);

                const groups = payload?.route_groups || [];
                setRouteGroupsOptions(groups);
                setSelectedRouteGroups(groups);
            } catch (error) {
                setAllRouteAndStopData(null);
                showSnackbar({
                    title: VISUALIZATION.common.snackbars
                        .fetchRoutesStopsFailed,
                    severity: "error",
                    detail: error?.message || "",
                });
            } finally {
                setLoadingRoutes(false);
            }
        };

        const fetchServices = async () => {
            try {
                const servicesRes = await getServicePerScenarioData({
                    scenario_id: selectedScenario,
                });
                const serviceList = servicesRes?.data?.data || [];
                setServiceIdOptions(serviceList);
                setSelectedServiceIds(
                    serviceList.length > 0 ? [serviceList[0]] : [],
                );
            } catch (error) {
                setServiceIdOptions([]);
                setSelectedServiceIds([]);
                showSnackbar({
                    title: VISUALIZATION.common.snackbars.fetchServicesFailed,
                    severity: "error",
                    detail: error?.message || "",
                });
            }
        };

        setSelectedStopMeta(null);
        setSelectedStopDetail(null);
        fetchRoutes();
        fetchServices();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedScenario, groupingOption]);

    const handleStopSelect = useCallback(
        async (stopProps) => {
            if (!stopProps || !stopProps.stop_id || !selectedScenario) {
                setSelectedStopMeta(null);
                setSelectedStopDetail(null);
                return;
            }

            setSelectedStopMeta({
                stop_id: stopProps.stop_id,
                stop_name:
                    stopProps.parent_stop ||
                    stopProps.stop_name ||
                    stopProps.stop_id,
            });

            const serviceIds = resolveServiceIds();
            setLoadingStopDetail(true);
            try {
                const res = await getNumberOfBusRunningVisualizationDetailData(
                    {
                        scenario_id: selectedScenario,
                        stop_id: stopProps.stop_id,
                        direction_id: directionId,
                        service_id: serviceIds.join(","),
                        start_time: startTime,
                        end_time: endTime,
                        route_group_ids: (selectedRouteGroups || [])
                            .map((g) => toRouteGroupId(g))
                            .join(","),
                    },
                    groupingOption,
                );
                setSelectedStopDetail(res?.data?.data || null);
            } catch (error) {
                showSnackbar({
                    title: VISUALIZATION.routeTimetable.errors
                        .fetchTimetableFailed,
                    severity: "error",
                    detail:
                        error?.response?.data?.message || error?.message || "",
                });
                setSelectedStopDetail(null);
            } finally {
                setLoadingStopDetail(false);
            }
        },
        [
            directionId,
            endTime,
            getNumberOfBusRunningVisualizationDetailData,
            groupingOption,
            resolveServiceIds,
            selectedRouteGroups,
            selectedScenario,
            showSnackbar,
            startTime,
        ],
    );

    const handleScenarioChange = useCallback((scenarioId) => {
        setSelectedScenario(scenarioId);
        setSelectedStopMeta(null);
        setSelectedStopDetail(null);
    }, []);

    const handleDirectionChange = useCallback((value) => {
        setDirectionId(value);
        setSelectedStopDetail(null);
    }, []);

    const handleServiceIdsChange = useCallback((values) => {
        setSelectedServiceIds(values);
        setSelectedStopDetail(null);
    }, []);

    const handleTimeRangeChange = useCallback((range) => {
        setTimeRange(range);
        setSelectedStopDetail(null);
    }, []);

    const handleRouteGroupsChange = useCallback(
        (values) => setSelectedRouteGroups(values || []),
        [],
    );

    const handleGroupingOptionChange = useCallback((value) => {
        setGroupingOption(value);
        setSelectedStopMeta(null);
        setSelectedStopDetail(null);
    }, []);

    const handleResetFilters = useCallback(() => {
        setDirectionId("");
        setSelectedServiceIds(serviceIdOptions.slice(0, 1));
        setTimeRange([0, TIME.minutesPerDay]);
        setSelectedRouteGroups(routeGroupsOptions);
        setGroupingOption("parent");
        setSelectedStopMeta(null);
        setSelectedStopDetail(null);
    }, [routeGroupsOptions, serviceIdOptions]);

    const handleApplyFilters = useCallback(
        async (payloadFromPanel) => {
            if (!selectedScenario) return;
            const grouping =
                payloadFromPanel?.grouping_option || groupingOption;

            const serviceIds = resolveServiceIds();
            const routeGroupIds = (selectedRouteGroups || [])
                .map((g) => toRouteGroupId(g))
                .filter(Boolean);

            setLoadingRoutes(true);
            try {
                const res = await getAllRouteAndStopsData({
                    scenario_id: selectedScenario,
                    is_using_shape_data: true,
                    is_using_parent_stop: grouping === "parent",
                    start_time: startTime,
                    end_time: endTime,
                    direction_id: directionId || undefined,
                    service_id: serviceIds.join(","),
                    route_group_ids: routeGroupIds.join(","),
                });
                const payload = res?.data || null;
                setAllRouteAndStopData(payload);
                const groups = payload?.route_groups || [];
                setRouteGroupsOptions(groups);
                if (!selectedRouteGroups?.length)
                    setSelectedRouteGroups(groups);
            } catch (error) {
                setAllRouteAndStopData(null);
                showSnackbar({
                    title: VISUALIZATION.common.snackbars
                        .fetchRoutesStopsFailed,
                    severity: "error",
                    detail: error?.message || "",
                });
            } finally {
                setLoadingRoutes(false);
            }
        },
        [
            directionId,
            endTime,
            getAllRouteAndStopsData,
            groupingOption,
            resolveServiceIds,
            selectedRouteGroups,
            selectedScenario,
            showSnackbar,
            startTime,
        ],
    );

    const directionFilter = useMemo(
        () =>
            directionId === "" ? "" : directionMap[directionId] || directionId,
        [directionId],
    );

    const selectedScenarioName = useMemo(() => {
        return (
            scenarioOptions.find(
                (s) => String(s.id) === String(selectedScenario),
            )?.scenario_name || VISUALIZATION.common.scenarioFallbackName
        );
    }, [scenarioOptions, selectedScenario]);

    const activeServiceNames = useMemo(
        () => resolveServiceIds(),
        [resolveServiceIds],
    );

    const [panelOpen, setPanelOpen] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const panelRef = useRef(null);
    const modalRef = useRef(null);

    const handleDownload = useCallback(
        async (fromModal = false) => {
            const node = fromModal ? modalRef.current : panelRef.current;
            if (!node) return;
            try {
                const uri = await htmlToImage.toPng(node, {
                    backgroundColor: "#fff",
                });
                const a = document.createElement("a");
                a.href = uri;
                const scenarioName =
                    selectedScenarioName ||
                    scenarioOptions.find(
                        (s) => String(s.id) === String(selectedScenario),
                    )?.scenario_name ||
                    VISUALIZATION.common.scenarioFallbackName;
                a.download = buildFilename(
                    scenarioName,
                    VISUALIZATION.titles.routeTimetable,
                    "graph",
                    VISUALIZATION.routeTimetable.labels.stopTimetable,
                    "png",
                );
                a.click();
            } catch (e) {
                 
                console.error(e);
            }
        },
        [scenarioOptions, selectedScenario, selectedScenarioName],
    );

    return {
        scenarioOptions,
        loadingScenario,
        selectedScenario,
        handleScenarioChange,
        // base data
        allRouteAndStopData,
        loadingRoutes,
        // filters
        routeGroupsOptions,
        selectedRouteGroups,
        handleRouteGroupsChange,
        groupingOption,
        handleGroupingOptionChange,
        directionId,
        handleDirectionChange,
        serviceIdOptions,
        selectedServiceIds,
        handleServiceIdsChange,
        timeRange,
        handleTimeRangeChange,
        handleApplyFilters,
        handleResetFilters,
        // stop detail
        selectedStopMeta,
        selectedStopDetail,
        loadingStopDetail,
        handleStopSelect,
        // derived
        startTime,
        endTime,
        directionFilter,
        activeServiceNames,
        selectedScenarioName,
        // panel state
        panelOpen,
        setPanelOpen,
        modalOpen,
        setModalOpen,
        panelRef,
        modalRef,
        handleDownload,
    };
}
