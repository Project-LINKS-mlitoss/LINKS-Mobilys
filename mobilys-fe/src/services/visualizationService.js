// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { ApiError } from "../utils/errors/ApiError";
import { ERRORS } from "../constant/errorMessages";
import { VISUALIZATION } from "../strings";
import {
    getBufferAnalysisGraphApi,
    getRoadNetworkReachabilityApi,
    getRoadNetworkReachabilityAnalysisApi,
    getTotalBusOnStopsDataByChild,
    getTotalBusOnStopsDataByParent,
    getTotalBusOnStopsDetailChild,
    getTotalBusOnStopsDetailParent,
    getBufferAnalysisMapApi,
    getGraphBuildingStatusApi,
    getPopulationDataApi,
    getStopRadiusAnalysisMapApi,
    getStopRadiusAnalysisMapGraphApi,
    getBoardingAlightingUploadApi,
    getAllRoutesAndStops,
    buildGraphApi,
    getAllRouteAndStopsDataApi,
    getODUsageDistributionApi,
    getODLastFirstStopApi,
    getODBusStopApi,
    getODUploadApi,
    postBoardingAlightingRoutesApi,
    postBoardingAlightingRouteGroupApi,
    postBoardingAlightingGetSegmentApi,
    postBoardingAlightingGetSegmentFilterApi,
    postBoardingAlightingGetSegmentGraphApi,
    checkPrefectureAvailabilityApi,
    postBoardingAlightingRoutesDetailApi,
} from "../api/visualizationApi";
import { useAuthStore } from "../state/authStore";

// Shared project resolver for visualization calls
const resolveProjectId = () =>
    useAuthStore?.getState?.().projectId ?? localStorage.getItem("project_id");

const withProjectId = (body = {}) => {
    const projectId = resolveProjectId();
    return projectId ? { ...body, project_id: projectId } : body;
};

const getErrorStatus = (error) =>
    error?.statusCode ?? error?.response?.status ?? error?.status ?? null;

const getErrorMessage = (error, fallbackMessage) =>
    error?.response?.data?.message ||
    error?.response?.data?.detail ||
    error?.message ||
    fallbackMessage;

const asApiError = (error, fallbackMessage, context = {}) => {
    const apiError =
        error instanceof ApiError
            ? error
            : ApiError.fromAxiosError(error, fallbackMessage);
    apiError.context = { ...(apiError.context || {}), ...context };
    return apiError;
};

const requireOk = (response, fallbackMessage, context = {}) => {
    if (!response) {
        throw new ApiError(fallbackMessage, {
            statusCode: 500,
            errorCode: "NO_RESPONSE",
            context,
        });
    }

    if (response.status !== 200) {
        const serverMessage =
            response?.data?.message ||
            response?.data?.detail ||
            fallbackMessage;
        throw new ApiError(serverMessage, {
            statusCode: response.status,
            errorCode: response?.data?.code ?? null,
            context: { ...context, responseData: response?.data },
        });
    }

    return response;
};

export const getNumberOfBusRunningVisualizationData = async (
    params = {},
    mode,
) => {
    try {
        if (mode === "parent") {
            return await getTotalBusOnStopsDataByParent(params);
        }
        if (mode === "child") {
            return await getTotalBusOnStopsDataByChild(params);
        }
        throw new ApiError(ERRORS.visualization.invalidModeFailed, {
            statusCode: 400,
            errorCode: "INVALID_MODE",
            context: { fn: "getNumberOfBusRunningVisualizationData", mode },
        });
    } catch (error) {
        throw asApiError(error, ERRORS.visualization.busRunningFetchFailed, {
            fn: "getNumberOfBusRunningVisualizationData",
        });
    }
};

export const getNumberOfBusRunningVisualizationDetailData = async (
    params = {},
    mode,
) => {
    try {
        if (mode === "parent") {
            return await getTotalBusOnStopsDetailParent(params);
        }
        if (mode === "child") {
            return await getTotalBusOnStopsDetailChild(params);
        }
        throw new ApiError(ERRORS.visualization.invalidModeFailed, {
            statusCode: 400,
            errorCode: "INVALID_MODE",
            context: {
                fn: "getNumberOfBusRunningVisualizationDetailData",
                mode,
            },
        });
    } catch (error) {
        throw asApiError(
            error,
            ERRORS.visualization.busRunningDetailFetchFailed,
            {
                fn: "getNumberOfBusRunningVisualizationDetailData",
            },
        );
    }
};

export const getBufferAnalysisGraphData = async (params = {}) => {
    try {
        const response = requireOk(
            await getBufferAnalysisGraphApi(params),
            ERRORS.visualization.bufferAnalysisGraphFailed,
            { fn: "getBufferAnalysisGraphData" },
        );

        const payload = response?.data?.data;
        if (!payload) {
            throw new ApiError(ERRORS.visualization.bufferAnalysisGraphNoData, {
                statusCode: 500,
                errorCode: "NO_DATA",
                context: { fn: "getBufferAnalysisGraphData" },
            });
        }

        return {
            routeAndStopGraphData: payload.route_and_stops,
            POIGraphData: payload.POI_on_buffer_area,
            stopData: payload.stops_on_buffer_area,
            populationData: payload.population_on_buffer_area,
        };
    } catch (error) {
        throw asApiError(
            error,
            ERRORS.visualization.bufferAnalysisGraphFailed,
            {
                fn: "getBufferAnalysisGraphData",
            },
        );
    }
};
function transformPOIs(data) {
    // data = { medical_institutions_within_isochrone, schools_within_isochrone, custom_poi }
    const mapByTime = new Map();

    // 1) Check if there is at least one custom POI in any cutoff bin
    const hasCustomPoi =
        Array.isArray(data.custom_poi) &&
        data.custom_poi.some(
            (seg) => Array.isArray(seg?.pois) && seg.pois.length > 0,
        );

    // 2) Decide which sources to use
    const sources = hasCustomPoi
        ? [
              // Custom mode: only custom POIs
              {
                  segments: data.custom_poi ?? [],
                  resolveType: (poi) => poi.type,
              },
          ]
        : [
              // Default mode: only MLIT POIs (hospital + school)
              {
                  segments: data.medical_institutions_within_isochrone ?? [],
                  resolveType: () => VISUALIZATION.common.poiTypes.hospital,
              },
              {
                  segments: data.schools_within_isochrone ?? [],
                  resolveType: () => VISUALIZATION.common.poiTypes.school,
              },
          ];

    for (const { segments, resolveType } of sources) {
        for (const seg of segments) {
            const cutoff_time = Number(seg?.cutoff_time);
            if (!Number.isFinite(cutoff_time)) continue;

            const pois = seg?.pois ?? [];

            if (!mapByTime.has(cutoff_time)) {
                mapByTime.set(cutoff_time, new Map());
            }
            const typeMap = mapByTime.get(cutoff_time);

            for (const poi of pois) {
                const poiType = resolveType(poi) ?? "unknown";
                if (!typeMap.has(poiType)) typeMap.set(poiType, []);
                typeMap.get(poiType).push({
                    poi_name: poi.title || poi.name,
                    address: poi.address || "",
                });
            }
        }
    }

    return Array.from(mapByTime.entries())
        .sort(([a], [b]) => a - b)
        .map(([cutoff_time, typeMap]) => ({
            cutoff_time,
            poi_by_type: Array.from(typeMap.entries()).map(
                ([poi_type, details]) => ({
                    poi_type,
                    details,
                }),
            ),
        }));
}

function mergeUniquePois(schoolPois = [], medicalPois = [], customPois = []) {
    const sources = [
        {
            groups: schoolPois,
            forcedType: VISUALIZATION.common.poiTypes.school,
        },
        {
            groups: medicalPois,
            forcedType: VISUALIZATION.common.poiTypes.hospital,
        },
        { groups: customPois, forcedType: null },
    ];

    const allPois = sources.flatMap(({ groups, forcedType }) =>
        (groups ?? []).flatMap((g) =>
            (g.pois ?? []).map((p) => ({
                ...p,
                type: forcedType ?? p.type,
            })),
        ),
    );

    const normalized = allPois.map((p) => ({
        id: p.id,
        type: p.type ?? "unknown",
        name: p.name ?? p.title,
        lat: p.lat,
        lng: p.lng ?? p.lon,
    }));

    const uniqueMap = new Map();
    for (const item of normalized) {
        const key = `${item.type}|${item.name}|${item.lat}|${item.lng}`;
        if (!uniqueMap.has(key)) uniqueMap.set(key, item);
    }
    return Array.from(uniqueMap.values());
}

export const getRoadNetworkIsochroneData = async (body = {}) => {
    try {
        const reachabilityResponse = requireOk(
            await getRoadNetworkReachabilityApi(body),
            ERRORS.visualization.roadNetworkFetchFailed,
            { fn: "getRoadNetworkIsochroneData" },
        );

        const isochrone = reachabilityResponse?.data?.data?.isochrone;
        return {
            data: reachabilityResponse?.data?.data || {},
            isochrone,
        };
    } catch (error) {
        const status = getErrorStatus(error);
        const message = getErrorMessage(
            error,
            ERRORS.visualization.roadNetworkFetchFailed,
        );

        // For 400 Bad Request we return a soft error payload
        // so the caller can show the backend message inline.
        if (status === 400) {
            return {
                error: true,
                status,
                message,
                data: null,
                isochrone: null,
            };
        }

        throw asApiError(error, message, { fn: "getRoadNetworkIsochroneData" });
    }
};

export const getRoadNetworkAnalysisGraphData = async ({
    isochrone,
    scenarioId,
} = {}) => {
    try {
        if (!isochrone) {
            throw new ApiError(ERRORS.visualization.isochroneRequired, {
                statusCode: 400,
                errorCode: "MISSING_ISOCHRONE",
                context: { fn: "getRoadNetworkAnalysisGraphData" },
            });
        }

        const projectId = resolveProjectId();
        const analysisPayload = {
            isochrone,
            ...(projectId ? { project_id: projectId } : {}),
            ...(scenarioId ? { scenario_id: scenarioId } : {}),
        };
        const analysisResponse = requireOk(
            await getRoadNetworkReachabilityAnalysisApi(analysisPayload),
            ERRORS.visualization.roadNetworkGraphFailed,
            { fn: "getRoadNetworkAnalysisGraphData" },
        );

        const analysisData = analysisResponse?.data?.data || {};
        const d = {
            ...analysisData,
            isochrone: analysisData.isochrone ?? isochrone,
        };

        // 1) Decide if custom POIs exist inside the isochrone
        const hasCustomPoiWithinIsochrone =
            Array.isArray(d.custom_poi) &&
            d.custom_poi.some(
                (seg) => Array.isArray(seg?.pois) && seg.pois.length > 0,
            );

        // 2) Build mergedPois for the map:
        //    - custom present  -> only custom
        //    - no custom      -> only MLIT
        const mergedPoi = hasCustomPoiWithinIsochrone
            ? mergeUniquePois([], [], d.custom_poi)
            : mergeUniquePois(
                  d.schools_within_isochrone,
                  d.medical_institutions_within_isochrone,
                  [],
              );

        // 3) Build POI graph data using the same rule
        const poiGraphData = transformPOIs({
            medical_institutions_within_isochrone: hasCustomPoiWithinIsochrone
                ? []
                : d.medical_institutions_within_isochrone,
            schools_within_isochrone: hasCustomPoiWithinIsochrone
                ? []
                : d.schools_within_isochrone,
            custom_poi: hasCustomPoiWithinIsochrone ? d.custom_poi : [],
        });

        return {
            data: d,
            graphData: {
                routeAndStopGraphData: d.routes_and_stops_within_isochrone,
                POIGraphData: poiGraphData,
                stopData: d.stop_groups,
            },
            mergedPois: mergedPoi,
        };
    } catch (error) {
        const status = getErrorStatus(error);
        const message = getErrorMessage(
            error,
            ERRORS.visualization.roadNetworkGraphFailed,
        );

        // For 400 Bad Request we return a soft error payload
        // so the caller can show the backend message inline.
        if (status === 400) {
            return {
                error: true,
                status,
                message,
                data: null,
                graphData: null,
                mergedPois: [],
            };
        }

        throw asApiError(error, message, {
            fn: "getRoadNetworkAnalysisGraphData",
        });
    }
};

export const fetchFP004MapFeaturesData = async (params = {}) => {
    try {
        const response = requireOk(
            await getBufferAnalysisMapApi(params),
            ERRORS.visualization.bufferAnalysisMapFailed,
            { fn: "fetchFP004MapFeaturesData" },
        );

        const buffer = response?.data?.data?.buffer;
        const populationData = response?.data?.data?.population;

        if (!buffer || !Array.isArray(buffer.features)) {
            throw new ApiError(ERRORS.visualization.bufferAnalysisMapNoData, {
                statusCode: 500,
                errorCode: "NO_DATA",
                context: { fn: "fetchFP004MapFeaturesData" },
            });
        }

        return {
            populationData,
            features: buffer.features,
            buffer_geojson: buffer.buffer_geojson,
        };
    } catch (error) {
        throw asApiError(error, ERRORS.visualization.bufferAnalysisMapFailed, {
            fn: "fetchFP004MapFeaturesData",
        });
    }
};

export const fetchFP004RouteGroupsAndStopsData = async (params = {}) => {
    try {
        const response = requireOk(
            await getAllRoutesAndStops(params),
            ERRORS.visualization.routeStopFetchFailed,
            { fn: "fetchFP004RouteGroupsAndStopsData" },
        );

        const features = response?.data?.features || [];
        if (!Array.isArray(features)) {
            throw new ApiError(ERRORS.visualization.routeStopNoData, {
                statusCode: 500,
                errorCode: "NO_DATA",
                context: { fn: "fetchFP004RouteGroupsAndStopsData" },
            });
        }

        return {
            routesGeoJSON: {
                type: "FeatureCollection",
                features: features.filter(
                    (f) => f.properties?.feature_type === "route",
                ),
            },
            stopsGeoJSON: {
                type: "FeatureCollection",
                features: features.filter(
                    (f) =>
                        f.properties?.feature_type === "stop" ||
                        f.properties?.feature_type === "parent_stop",
                ),
            },
        };
    } catch (error) {
        throw asApiError(error, ERRORS.visualization.routeStopFetchFailed, {
            fn: "fetchFP004RouteGroupsAndStopsData",
        });
    }
};

export const fetchFP005RouteGroupsAndStopsData = async (params = {}) => {
    try {
        const response = requireOk(
            await getRoadNetworkReachabilityApi(params),
            ERRORS.visualization.routeStopFetchFailed,
            { fn: "fetchFP005RouteGroupsAndStopsData" },
        );

        const data = response?.data?.data || {};

        return {
            routesGeoJSON: {
                type: "FeatureCollection",
                features: data.routes_and_stops_within_isochrone || [],
            },
            stopsGeoJSON: {
                type: "FeatureCollection",
                features: data.stops_on_buffer_area || [],
            },
        };
    } catch (error) {
        throw asApiError(error, ERRORS.visualization.routeStopFetchFailed, {
            fn: "fetchFP005RouteGroupsAndStopsData",
        });
    }
};

// fetching road network reachability data (legacy)
export const getIsochroneData = async (_unused, params = {}) => {
    try {
        const response = requireOk(
            await getRoadNetworkReachabilityApi(params),
            ERRORS.visualization.isochroneFetchFailed,
            { fn: "getIsochroneData" },
        );
        return response.data;
    } catch (error) {
        throw asApiError(error, ERRORS.visualization.isochroneFetchFailed, {
            fn: "getIsochroneData",
        });
    }
};

export const getGraphBuildingStatus = async (scenarioId) => {
    try {
        const response = requireOk(
            await getGraphBuildingStatusApi(scenarioId),
            ERRORS.visualization.graphStatusFetchFailed,
            { fn: "getGraphBuildingStatus", scenarioId },
        );
        const d = response?.data?.data ?? {};
        return {
            osm_graph_status: d.osm_graph_status ?? "pending",
            drm_graph_status: d.drm_graph_status ?? "pending",
        };
    } catch (error) {
        throw asApiError(error, ERRORS.visualization.graphStatusFetchFailed, {
            fn: "getGraphBuildingStatus",
            scenarioId,
        });
    }
};

export const buildGraph = async ({ scenarioId, graphType }) => {
    try {
        const response = requireOk(
            await buildGraphApi(scenarioId, graphType),
            ERRORS.visualization.graphBuildFailed,
            { fn: "buildGraph", scenarioId, graphType },
        );
        return response.data;
    } catch (error) {
        throw asApiError(error, ERRORS.visualization.graphBuildFailed, {
            fn: "buildGraph",
            scenarioId,
            graphType,
        });
    }
};

export const getPopulationData = async (scenario_id = {}) => {
    try {
        const response = requireOk(
            await getPopulationDataApi(scenario_id),
            ERRORS.visualization.fetchPopulationFailed,
            { fn: "getPopulationData", scenario_id },
        );
        return response.data;
    } catch (error) {
        throw asApiError(error, ERRORS.visualization.fetchPopulationFailed, {
            fn: "getPopulationData",
            scenario_id,
        });
    }
};

export const getAllRouteAndStopsData = async (params = {}) => {
    try {
        return await getAllRouteAndStopsDataApi(params);
    } catch (error) {
        throw asApiError(error, ERRORS.visualization.routeStopFetchFailed, {
            fn: "getAllRouteAndStopsData",
        });
    }
};

export const getStopRadiusAnalysisMap = async (body = {}) => {
    try {
        const response = requireOk(
            await getStopRadiusAnalysisMapApi(withProjectId(body)),
            ERRORS.visualization.stopRadiusMapFailed,
            { fn: "getStopRadiusAnalysisMap" },
        );
        const data = response?.data?.data;
        if (!data) {
            throw new ApiError(ERRORS.visualization.stopRadiusMapNoData, {
                statusCode: 500,
                errorCode: "NO_DATA",
                context: { fn: "getStopRadiusAnalysisMap" },
            });
        }
        return data;
    } catch (error) {
        throw asApiError(error, ERRORS.visualization.stopRadiusMapFailed, {
            fn: "getStopRadiusAnalysisMap",
        });
    }
};

export const getStopRadiusAnalysisMapGraph = async (body = {}) => {
    try {
        const response = requireOk(
            await getStopRadiusAnalysisMapGraphApi(withProjectId(body)),
            ERRORS.visualization.stopRadiusGraphFailed,
            { fn: "getStopRadiusAnalysisMapGraph" },
        );
        const raw = response?.data?.data || {};
        return sortStopRadiusAnalysis(raw);
    } catch (error) {
        throw asApiError(error, ERRORS.visualization.stopRadiusGraphFailed, {
            fn: "getStopRadiusAnalysisMapGraph",
        });
    }
};

function sortStopRadiusAnalysis(input) {
    if (!input || typeof input !== "object") return input;

    const stop_group_method = input.stop_group_method;

    let population_graph_src = Array.isArray(input.population_graph)
        ? input.population_graph
        : null;

    if (!population_graph_src && input.population_total) {
        const pt = input.population_total || {};
        population_graph_src = [
            {
                id: "ALL",
                age_0_14: Number(pt.age_0_14 || 0),
                age_15_64: Number(pt.age_15_64 || 0),
                age_65_up: Number(pt.age_65_up || 0),
                total_population: Number(pt.total_population || 0),
            },
        ];
    }
    const population_graph = sortPopulationGraph(
        Array.isArray(population_graph_src) ? population_graph_src : [],
    );

    let poiGraphArr = null;

    if (Array.isArray(input.poi_graph)) {
        poiGraphArr = input.poi_graph;
    } else if (Array.isArray(input.POI_graph)) {
        poiGraphArr = input.POI_graph;
    } else if (Array.isArray(input.poi_summary)) {
        const points = Array.isArray(input.poi_for_map)
            ? input.poi_for_map
            : [];
        const pois = input.poi_summary.map((s) => ({
            type: s.type,
            data: points
                .filter((p) => p.type === s.type)
                .map((p) => ({
                    poi_name: p.poi_name || "",
                    address: p.address || "",
                    lat: Number(p.lat),
                    lng: Number(p.lng),
                })),
        }));
        poiGraphArr = [{ id: "ALL", pois }];
    }

    const POI_graph = sortPoiGraph(
        Array.isArray(poiGraphArr) ? poiGraphArr : [],
    );

    const route_graph_src = Array.isArray(input.route_graph)
        ? input.route_graph
        : [];
    const route_graph = sortRouteGraph(route_graph_src);

    const poi_for_map = Array.isArray(input.poi_for_map)
        ? input.poi_for_map
        : Array.isArray(POI_graph)
          ? getUniquePOI(POI_graph)
          : [];

    return {
        stop_group_method,
        route_graph,
        population_graph,
        POI_graph,
        poi_for_map,
    };
}

function getUniquePOI(items) {
    const seen = new Set();
    const uniquePOIs = [];

    items.forEach((item) => {
        item.pois.forEach((poi) => {
            poi.data.forEach((d) => {
                const obj = {
                    type: poi.type,
                    name: d.poi_name,
                    lat: d.lat,
                    lng: d.lng,
                };

                const key = `${obj.type}-${obj.name}-${obj.lat}-${obj.lng}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniquePOIs.push(obj);
                }
            });
        });
    });

    return uniquePOIs;
}

function sortRouteGraph(arr) {
    // Sort inner: each stop's routes by child count desc
    const withInnerSorted = (arr || []).map((sg) => {
        const routes = Array.isArray(sg.routes) ? sg.routes : [];
        const routesSorted = [...routes].sort(
            (a, b) => (b?.child?.length || 0) - (a?.child?.length || 0),
        );
        return { ...sg, routes: routesSorted };
    });

    // Sort stops by total child count desc
    const totalChildren = (sg) =>
        (sg.routes || []).reduce(
            (acc, rg) => acc + (rg?.child?.length || 0),
            0,
        );

    return [...withInnerSorted].sort(
        (a, b) => totalChildren(b) - totalChildren(a),
    );
}

function sortPopulationGraph(arr) {
    const totalOf = (p) =>
        typeof p?.total_population === "number"
            ? p.total_population
            : (p?.age_0_14 || 0) + (p?.age_15_64 || 0) + (p?.age_65_up || 0);

    return [...(arr || [])].sort((a, b) => totalOf(b) - totalOf(a));
}

function sortPoiGraph(arr) {
    // Sort inner: pois by data length desc
    const innerSorted = (arr || []).map((sg) => {
        const pois = Array.isArray(sg.pois) ? sg.pois : [];
        const poisSorted = [...pois].sort(
            (a, b) => (b?.data?.length || 0) - (a?.data?.length || 0),
        );
        return { ...sg, pois: poisSorted };
    });

    // Sort stops by total poi count desc
    const totalPoi = (sg) =>
        (sg.pois || []).reduce((acc, p) => acc + (p?.data?.length || 0), 0);

    return [...innerSorted].sort((a, b) => totalPoi(b) - totalPoi(a));
}

export const getODUsageDistributionData = async (body = {}) => {
    try {
        const response = requireOk(
            await getODUsageDistributionApi(body),
            ERRORS.visualization.odUsageDistributionFailed,
            { fn: "getODUsageDistributionData" },
        );
        return response.data;
    } catch (error) {
        throw asApiError(
            error,
            ERRORS.visualization.odUsageDistributionFailed,
            {
                fn: "getODUsageDistributionData",
            },
        );
    }
};

export const getODLastFirstStopData = async (body = {}) => {
    try {
        const response = requireOk(
            await getODLastFirstStopApi(body),
            ERRORS.visualization.odLastFirstStopFailed,
            { fn: "getODLastFirstStopData" },
        );
        return response.data;
    } catch (error) {
        throw asApiError(error, ERRORS.visualization.odLastFirstStopFailed, {
            fn: "getODLastFirstStopData",
        });
    }
};

export const getODBusStopData = async (body = {}) => {
    try {
        const response = requireOk(
            await getODBusStopApi(body),
            ERRORS.visualization.odBusStopFailed,
            { fn: "getODBusStopData" },
        );
        return response.data;
    } catch (error) {
        throw asApiError(error, ERRORS.visualization.odBusStopFailed, {
            fn: "getODBusStopData",
        });
    }
};

export const getODUploadData = async (body = {}) => {
    try {
        const response = requireOk(
            await getODUploadApi(body),
            ERRORS.visualization.odUploadFailed,
            { fn: "getODUploadData" },
        );
        return response.data;
    } catch (error) {
        throw asApiError(error, ERRORS.visualization.odUploadFailed, {
            fn: "getODUploadData",
        });
    }
};

export const postBoardingAlightingRoutesData = async (body = {}) => {
    try {
        const response = requireOk(
            await postBoardingAlightingRoutesApi(body),
            ERRORS.visualization.boardingAlightingRoutesFailed,
            { fn: "postBoardingAlightingRoutesData" },
        );
        return response.data;
    } catch (error) {
        throw asApiError(
            error,
            ERRORS.visualization.boardingAlightingRoutesFailed,
            {
                fn: "postBoardingAlightingRoutesData",
            },
        );
    }
};

export const getBoardingAlightingUploadData = async (body = {}) => {
    try {
        const response = requireOk(
            await getBoardingAlightingUploadApi(body),
            ERRORS.visualization.boardingAlightingUploadFailed,
            { fn: "getBoardingAlightingUploadData" },
        );
        return response.data;
    } catch (error) {
        throw asApiError(
            error,
            ERRORS.visualization.boardingAlightingUploadFailed,
            {
                fn: "getBoardingAlightingUploadData",
            },
        );
    }
};

export const postBoardingAlightingRouteGroupApiService = async (body = {}) => {
    try {
        const response = requireOk(
            await postBoardingAlightingRouteGroupApi(body),
            ERRORS.visualization.boardingAlightingRouteGroupFailed,
            { fn: "postBoardingAlightingRouteGroupApiService" },
        );
        return response.data;
    } catch (error) {
        throw asApiError(
            error,
            ERRORS.visualization.boardingAlightingRouteGroupFailed,
            { fn: "postBoardingAlightingRouteGroupApiService" },
        );
    }
};

export const postBoardingAlightingGetSegmentData = async (body = {}) => {
    try {
        const response = requireOk(
            await postBoardingAlightingGetSegmentApi(body),
            ERRORS.visualization.boardingAlightingSegmentFailed,
            { fn: "postBoardingAlightingGetSegmentData" },
        );
        return response.data;
    } catch (error) {
        throw asApiError(
            error,
            ERRORS.visualization.boardingAlightingSegmentFailed,
            { fn: "postBoardingAlightingGetSegmentData" },
        );
    }
};

export const getBoardingAlightingGetSegmentFilterData = async (body = {}) => {
    try {
        const response = requireOk(
            await postBoardingAlightingGetSegmentFilterApi(body),
            ERRORS.visualization.boardingAlightingSegmentFilterFailed,
            { fn: "getBoardingAlightingGetSegmentFilterData" },
        );
        return response.data;
    } catch (error) {
        throw asApiError(
            error,
            ERRORS.visualization.boardingAlightingSegmentFilterFailed,
            { fn: "getBoardingAlightingGetSegmentFilterData" },
        );
    }
};

export const getBoardingAlightingGetSegmentGraphData = async (body = {}) => {
    try {
        const response = requireOk(
            await postBoardingAlightingGetSegmentGraphApi(body),
            ERRORS.visualization.boardingAlightingSegmentGraphFailed,
            { fn: "getBoardingAlightingGetSegmentGraphData" },
        );
        return response.data;
    } catch (error) {
        throw asApiError(
            error,
            ERRORS.visualization.boardingAlightingSegmentGraphFailed,
            { fn: "getBoardingAlightingGetSegmentGraphData" },
        );
    }
};

export const checkPrefectureAvailability = async (scenarioId, graphType) => {
    try {
        const res = requireOk(
            await checkPrefectureAvailabilityApi(scenarioId, graphType),
            ERRORS.visualization.prefectureCheckFailed,
            { fn: "checkPrefectureAvailability", scenarioId, graphType },
        );
        const d = res?.data?.data ?? {};
        return {
            ok: !!d.ok,
            needed: d.needed ?? [],
            available: d.available ?? [],
            missing: d.missing ?? [],
            graphType: d.graph_type ?? graphType,
        };
    } catch (error) {
        throw asApiError(error, ERRORS.visualization.prefectureCheckFailed, {
            fn: "checkPrefectureAvailability",
            scenarioId,
            graphType,
        });
    }
};

export const postBoardingAlightingRoutesDetailData = async (body = {}) => {
    try {
        const response = requireOk(
            await postBoardingAlightingRoutesDetailApi(body),
            ERRORS.visualization.boardingAlightingRoutesDetailFailed,
            { fn: "postBoardingAlightingRoutesDetailData" },
        );
        return response.data;
    } catch (error) {
        throw asApiError(
            error,
            ERRORS.visualization.boardingAlightingRoutesDetailFailed,
            { fn: "postBoardingAlightingRoutesDetailData" },
        );
    }
};
