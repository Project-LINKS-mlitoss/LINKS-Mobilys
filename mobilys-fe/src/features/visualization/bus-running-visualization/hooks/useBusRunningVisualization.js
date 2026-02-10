import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { STORAGE_KEYS } from "../../../../constant/ui";
import { VISUALIZATION } from "@/strings";

import { getUserScenarios } from "../../../../services/scenarioService";
import {
    getNumberOfBusRunningVisualizationData,
    getNumberOfBusRunningVisualizationDetailData,
    getPopulationData,
} from "../../../../services/visualizationService";
import { getServicePerScenarioData } from "../../../../services/calendarService";
import { getPoiData } from "../../../../services/poiService";

const toRouteGroupIds = (routeGroups) =>
    (routeGroups || [])
        .map((rg) => rg?.route_group_id)
        .filter(Boolean)
        .join(",");

export function useBusRunningVisualization() {
    const [scenarioOptions, setScenarioOptions] = useState([]);
    const [loadingScenario, setLoadingScenario] = useState(true);

    const getInitialScenario = () => {
        const stored = localStorage.getItem(
            STORAGE_KEYS.selectedScenarioVisualization,
        );
        return stored || "";
    };
    const [selectedScenario, setSelectedScenario] =
        useState(getInitialScenario);

    // data map (BASE GEOMETRY)
    const [routesGroup, setRoutesGroup] = useState([]);
    const [stops, setStops] = useState([]);
    const [edgesData, setEdgesData] = useState([]);

    // data graph
    const [groupedData, setGroupedData] = useState([]);
    const [routeGroupGraphData, setRouteGroupGraphData] = useState([]);
    const [stopGraphData, setStopGraphData] = useState({ group_data: [] });
    const [stopGraphGrouping, setStopGraphGrouping] = useState("");

    // filter params
    const [routesGroupOption, setRoutesGroupOption] = useState([]);
    const [selectedRouteGroups, setSelectedRouteGroups] = useState([]);
    const [directionId, setDirectionId] = useState("");
    const [serviceIdOptions, setServiceIdOptions] = useState([]);
    const [selectedServiceId, setSelectedServiceId] = useState([]);
    const [groupingoption, setGroupingOption] = useState("parent");
    const [loadingFilter, setLoadingFilter] = useState(false);
    const [activeFilter, setActiveFilter] = useState({
        startTime: "00:00:00",
        endTime: "23:59:59",
    });

    const [showTripNumbersFlag, setShowTripNumbersFlag] = useState(false);

    // map container width
    const [mapContainerWidth, setMapContainerWidth] = useState(0);
    const mapContainerRef = useRef(null);

    // POI & population
    const [poiData, setPoiData] = useState([]);
    const [populationData, setPopulationData] = useState(null);

    const [countHitApi, setCountHitApi] = useState(0);

    // stop detail dialog
    const [selectedStop, setSelectedStop] = useState(null);
    const isStopOpen = selectedStop !== null;

    // Sync selectedScenario to localStorage whenever it changes
    useEffect(() => {
        if (selectedScenario) {
            localStorage.setItem(
                STORAGE_KEYS.selectedScenarioVisualization,
                selectedScenario,
            );
        }
    }, [selectedScenario]);

    // initial load: POIs + scenarios
    useEffect(() => {
        setLoadingScenario(true);
        getPoiData()
            .then(setPoiData)
            .catch(() => {});

        getUserScenarios()
            .then((res) => {
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
            })
            .catch(() => {
                setScenarioOptions([]);
            })
            .finally(() => setLoadingScenario(false));
    }, []);

    // population data refresh
    useEffect(() => {
        if (!selectedScenario) return;
        (async () => {
            try {
                const response = await getPopulationData(selectedScenario);
                setPopulationData(response);
            } catch {}
        })();
    }, [selectedScenario]);

    useEffect(() => {
        if (!selectedScenario) return;
        setLoadingFilter(true);
        const params = { scenario_id: selectedScenario };

        Promise.all([
            getNumberOfBusRunningVisualizationData(params, groupingoption),
            getServicePerScenarioData({ scenario_id: selectedScenario }),
        ])
            .then(([res, serviceRes]) => {
                const d = res?.data?.data || {};
                const group = d.routes_group || [];
                setRoutesGroup(group);
                setRoutesGroupOption(group);
                setSelectedRouteGroups(group);

                setStops(d.stops || []);
                setEdgesData(d.edges || []);

                const svcOpts = serviceRes?.data?.data || [];
                setServiceIdOptions(svcOpts);
                if (svcOpts.length) setSelectedServiceId([svcOpts[0]]);

                setGroupedData([]);
                setRouteGroupGraphData([]);
                setStopGraphData({ group_data: [] });
                setStopGraphGrouping("");
                setShowTripNumbersFlag(false);
            })
            .catch(() => {
                setRoutesGroup([]);
                setRoutesGroupOption([]);
                setSelectedRouteGroups([]);
                setStops([]);
                setEdgesData([]);
                setServiceIdOptions([]);
                setGroupedData([]);
                setRouteGroupGraphData([]);
                setStopGraphData({ group_data: [] });
                setStopGraphGrouping("");
                setShowTripNumbersFlag(false);
            })
            .finally(() => setLoadingFilter(false));
    }, [selectedScenario, groupingoption]);

    const handleApplyFilter = useCallback(
        async (filterValues) => {
            setCountHitApi((c) => c + 1);
            setLoadingFilter(true);

            setActiveFilter({
                startTime: filterValues.startTime || "00:00:00",
                endTime: filterValues.endTime || "23:59:59",
            });

            setDirectionId(filterValues.directionId || "");
            setSelectedServiceId(filterValues.serviceId || []);
            setSelectedScenario(filterValues.scenarioId || "");
            setSelectedRouteGroups(filterValues.selectedRouteGroups || []);
            setGroupingOption(filterValues.groupingOption || "");

            const params = {
                start_time: filterValues.startTime,
                end_time: filterValues.endTime,
                direction_id: filterValues.directionId,
                service_id: Array.isArray(filterValues.serviceId)
                    ? filterValues.serviceId.join(",")
                    : filterValues.serviceId,
                scenario_id: filterValues.scenarioId,
                route_group_ids: toRouteGroupIds(
                    filterValues.selectedRouteGroups,
                ),
            };

            try {
                const res = await getNumberOfBusRunningVisualizationData(
                    params,
                    groupingoption,
                );
                const d = res?.data?.data || {};

                if (Array.isArray(d.edges) && d.edges.length > 0) {
                    setEdgesData(d.edges);
                    setStops(Array.isArray(d.stops) ? d.stops : []);
                    setShowTripNumbersFlag(true);
                } else {
                    setShowTripNumbersFlag(false);
                }

                setRoutesGroup(
                    Array.isArray(d.routes_group)
                        ? d.routes_group
                        : routesGroup,
                );
                setGroupedData(d.route_group_total_graph || []);
                setRouteGroupGraphData(d.route_group_graph || []);
                setStopGraphData(d.stop_group_graph || { group_data: [] });
                setStopGraphGrouping(d.stop_group_graph?.grouping_method || "");
            } catch {
                setGroupedData([]);
                setRouteGroupGraphData([]);
                setStopGraphData({ group_data: [] });
                setStopGraphGrouping("");
                setShowTripNumbersFlag(false);
            } finally {
                setLoadingFilter(false);
            }
        },
        [groupingoption, routesGroup],
    );

    const handleMapRouteGroupsChange = useCallback(
        async (newValue) => {
            setSelectedRouteGroups(newValue);
            setLoadingFilter(true);
            setCountHitApi(0);

            const params = {
                direction_id: directionId,
                service_id: selectedServiceId.join(","),
                scenario_id: selectedScenario,
                route_group_ids: toRouteGroupIds(newValue),
            };

            try {
                const res = await getNumberOfBusRunningVisualizationData(
                    params,
                    groupingoption,
                );
                const d = res?.data?.data || {};

                setRoutesGroup(
                    Array.isArray(d.routes_group)
                        ? d.routes_group
                        : routesGroup,
                );

                if (Array.isArray(d.edges) && d.edges.length > 0) {
                    setEdgesData(d.edges);
                    setStops(Array.isArray(d.stops) ? d.stops : []);
                } else {
                    setShowTripNumbersFlag(false);
                }
            } catch {
            } finally {
                setLoadingFilter(false);
            }
        },
        [
            directionId,
            selectedServiceId,
            selectedScenario,
            groupingoption,
            routesGroup,
        ],
    );

    const handleMapRouteSelect = useCallback(
        async (selectedRoute) => {
            if (!selectedRoute || !Array.isArray(selectedRoute)) return;
            setCountHitApi((c) => c + 1);
            const matched = routesGroupOption.filter(
                (opt) =>
                    selectedRoute.includes(opt.route_group_name) ||
                    selectedRoute.includes(opt.route_group_id),
            );
            setSelectedRouteGroups(matched);

            const params = {
                direction_id: directionId,
                service_id: selectedServiceId.join(","),
                scenario_id: selectedScenario,
                route_group_ids: toRouteGroupIds(matched),
            };

            setLoadingFilter(true);
            try {
                const res = await getNumberOfBusRunningVisualizationData(
                    params,
                    groupingoption,
                );
                const d = res?.data?.data || {};
                setRoutesGroup(
                    Array.isArray(d.routes_group)
                        ? d.routes_group
                        : routesGroup,
                );

                if (Array.isArray(d.edges) && d.edges.length > 0) {
                    setEdgesData(d.edges);
                    setStops(Array.isArray(d.stops) ? d.stops : []);
                } else {
                    setShowTripNumbersFlag(false);
                }
            } catch {
            } finally {
                setLoadingFilter(false);
            }
        },
        [
            routesGroupOption,
            directionId,
            selectedServiceId,
            selectedScenario,
            groupingoption,
            routesGroup,
        ],
    );

    const handleStopSelect = useCallback(
        async (stop) => {
            if (!stop) return;
            const params = {
                direction_id: directionId,
                service_id: selectedServiceId.join(","),
                scenario_id: selectedScenario,
                stop_id: stop.stop_id,
                start_time: activeFilter.startTime,
                end_time: activeFilter.endTime,
                route_group_ids: toRouteGroupIds(selectedRouteGroups),
            };
            try {
                const res = await getNumberOfBusRunningVisualizationDetailData(
                    params,
                    groupingoption,
                );
                setSelectedStop(res.data.data);
            } catch {}
        },
        [
            directionId,
            selectedServiceId,
            selectedScenario,
            activeFilter,
            selectedRouteGroups,
            groupingoption,
        ],
    );

    const handleStopDetailClose = useCallback(() => setSelectedStop(null), []);

    // Resize observer
    useEffect(() => {
        if (!mapContainerRef.current) return;
        const observer = new window.ResizeObserver((entries) => {
            for (let entry of entries)
                setMapContainerWidth(entry.contentRect.width);
        });
        observer.observe(mapContainerRef.current);
        return () => observer.disconnect();
    }, []);

    const handleResetFilter = useCallback(async () => {
        setCountHitApi(0);
        setGroupedData([]);
        setRouteGroupGraphData([]);
        setStopGraphData({ group_data: [] });
        setStopGraphGrouping("");
        setShowTripNumbersFlag(false);
        setDirectionId("");
        setSelectedServiceId([]);
        setActiveFilter({
            startTime: "00:00:00",
            endTime: "23:59:59",
        });

        setLoadingFilter(true);
        const params = { scenario_id: selectedScenario };
        try {
            const res = await getNumberOfBusRunningVisualizationData(
                params,
                groupingoption,
            );
            const d = res?.data?.data || {};
            const group = d.routes_group || [];
            setRoutesGroup(group);
            setRoutesGroupOption(group);
            setSelectedRouteGroups(group);
            setStops(d.stops || []);
            setEdgesData(d.edges || []);
        } catch {
            setRoutesGroup([]);
            setRoutesGroupOption([]);
            setSelectedRouteGroups([]);
            setStops([]);
            setEdgesData([]);
        } finally {
            setLoadingFilter(false);
        }
    }, [selectedScenario, groupingoption]);

    const visibleRouteKeys = useMemo(() => {
        if (!selectedRouteGroups || !selectedRouteGroups.length) return null;
        const keys = [];
        for (const rg of selectedRouteGroups) {
            if (rg.route_group_name != null)
                keys.push(String(rg.route_group_name));
            if (rg.route_group_id != null) keys.push(String(rg.route_group_id));
        }
        return new Set(keys);
    }, [selectedRouteGroups]);

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

    const serviceLevelDescription =
        VISUALIZATION.busRunningVisualization.description;

    return {
        // scenario
        scenarioOptions,
        loadingScenario,
        selectedScenario,
        setSelectedScenario,

        // filter state
        routesGroupOption,
        selectedRouteGroups,
        setSelectedRouteGroups,
        directionId,
        serviceIdOptions,
        selectedServiceId,
        setSelectedServiceId,
        groupingoption,
        setGroupingOption,
        activeFilter,

        // data
        routesGroup,
        stops,
        edgesData,
        groupedData,
        routeGroupGraphData,
        stopGraphData,
        stopGraphGrouping,
        poiData,
        populationData,

        // UI state
        loadingFilter,
        showTripNumbersFlag,
        countHitApi,
        mapContainerRef,
        mapContainerWidth,
        visibleRouteKeys,
        currentScenarioName,
        serviceLevelDescription,

        // stop dialog
        selectedStop,
        isStopOpen,
        handleStopDetailClose,

        // handlers
        handleApplyFilter,
        handleResetFilter,
        handleMapRouteGroupsChange,
        handleMapRouteSelect,
        handleStopSelect,
    };
}
