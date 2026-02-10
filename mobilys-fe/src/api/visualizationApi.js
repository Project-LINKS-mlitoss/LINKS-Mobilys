import { get, post } from "./middleware";
import { useAuthStore } from "../state/authStore";

export const getTotalBusOnStopsDataByParent = (params = {}) =>
    get(`/visualization/total-bus-on-stops-by-parents/`, params);

export const getTotalBusOnStopsDataByChild = (params = {}) =>
    get(`/visualization/total-bus-on-stops-by-child/`, params);

export const getTotalBusOnStopsDetailParent = (params = {}) =>
    get(`/visualization/total-bus-on-stops-detail-parent/`, params);

export const getTotalBusOnStopsDetailChild = (params = {}) =>
    get(`/visualization/total-bus-on-stops-detail-child/`, params);

export const getBufferAnalysisGraphApi = (params = {}) => {
    const { projectId, userId } = useAuthStore.getState();
    let query = { ...params };
    if (projectId) query = { ...query, project_id: projectId };
    else if (userId) query = { ...query, user_id: userId };
    return get(`/visualization/buffer-analysis-visualization/graph/`, query);
};

export const getRoadNetworkReachabilityApi = (body = {}) => {
    const { projectId } = useAuthStore.getState();
    const payload = projectId ? { ...body, project_id: projectId } : body;
    return post(`/visualization/road-network-reachability/`, payload);
};

export const getRoadNetworkReachabilityAnalysisApi = (body = {}) => {
    const { projectId } = useAuthStore.getState();
    const payload = projectId ? { ...body, project_id: projectId } : body;
    return post(`/visualization/road-network-reachability/analysis/`, payload);
};

// FP004 Map (GeoJSON for stops/routes/buffer)
export const getBufferAnalysisMapApi = (params = {}) => {
    const { projectId } = useAuthStore.getState();
    const query = projectId ? { ...params, project_id: projectId } : params;
    return get(`/visualization/buffer-analysis-visualization/`, query);
};

//fp004 all routes and stops
export const getAllRoutesAndStops = (params = {}) =>
    get(`/visualization/all-routes/`, params);

//get graphbuilding status for FP005
export const getGraphBuildingStatusApi = (scenario_id) =>
    get(`/gtfs/data/import/${scenario_id}/get_graph_status/`);

//Build Graph for FP005
export const buildGraphApi = (scenarioId, graphType = "osm") =>
    get(
        `/visualization/buildOTPGraph/${scenarioId}/?graph_type=${encodeURIComponent(graphType)}`,
    );

//Get Population Data
export const getPopulationDataApi = (scenario_id = "") =>
    get(`/visualization/population_by_prefecture/?scenario_id=${scenario_id}`);

export const getAllRouteAndStopsDataApi = (params = {}) =>
    get(`/visualization/all-routes/`, params);

export const getStopRadiusAnalysisMapApi = (body = {}) => {
    const { projectId } = useAuthStore.getState();
    const payload = projectId ? { ...body, project_id: projectId } : body;
    return post(`/visualization/stop_group_buffer_analysis/`, payload);
};

export const getStopRadiusAnalysisMapGraphApi = (body = {}) => {
    const { projectId } = useAuthStore.getState();
    const payload = projectId ? { ...body, project_id: projectId } : body;
    return post(`/visualization/stop_group_buffer_analysis/graph/`, payload);
};

export const getODUsageDistributionApi = (body = {}) =>
    post(`/visualization/od-analysis/usage-distribution/`, body);

export const getODLastFirstStopApi = (body = {}) =>
    post(`/visualization/od-analysis/last-first-stop/`, body);

export const getODBusStopApi = (body = {}) =>
    post(`/visualization/od-analysis/bus-stop/`, body);

export const getODUploadApi = (body = {}) =>
    post(`/visualization/od-analysis/upload/`, body);

export const postBoardingAlightingRoutesApi = (body = {}) =>
    post(`/visualization/boarding-alighting/routes/`, body);

export const getBoardingAlightingUploadApi = (body = {}) =>
    post(`/visualization/boarding-alighting-checker/`, body);

export const postBoardingAlightingRouteGroupApi = (body = {}) =>
    post(`/visualization/boarding-alighting-checker/routes-group/`, body);

export const postBoardingAlightingGetSegmentApi = (body = {}) =>
    post(`/visualization/boarding-alighting/all-segment/`, body);

export const postBoardingAlightingGetSegmentFilterApi = (body = {}) =>
    post(`/visualization/boarding-alighting/segment-stop/filter`, body);

export const postBoardingAlightingGetSegmentGraphApi = (body = {}) =>
    post(`/visualization/boarding-alighting/segment-stop/`, body);

export const checkPrefectureAvailabilityApi = (scenarioId, graphType) =>
    get(
        `/visualization/prefecture-availability/${scenarioId}/?graph_type=${graphType}`,
    );

export const postBoardingAlightingRoutesDetailApi = (body = {}) =>
    post(`/visualization/boarding-alighting/routes-detail/`, body);

// Project-level prefecture override (used for POI bounding boxes)
const resolveProjectId = (projectId) =>
    projectId ?? useAuthStore.getState().projectId;

export const getProjectPrefectureSelection = (projectId) => {
    const pid = resolveProjectId(projectId);
    const { userId } = useAuthStore.getState();
    const params = {};
    if (pid) params.project_id = pid;
    else if (userId) params.user_id = userId;
    if (!params.project_id && !params.user_id) {
        throw new Error(
            "project_id or user_id is required to fetch prefecture selection",
        );
    }
    return get(`/visualization/project-prefecture/`, params);
};

export const updateProjectPrefectureSelection = ({ projectId, prefecture }) => {
    const pid = resolveProjectId(projectId);
    const { userId } = useAuthStore.getState();
    const payload = { prefecture };
    if (pid) payload.project_id = pid;
    else if (userId) payload.user_id = userId;
    if (!payload.project_id && !payload.user_id) {
        throw new Error(
            "project_id or user_id is required to update prefecture selection",
        );
    }
    return post(`/visualization/project-prefecture/`, payload);
};

export const getPOIsByBBox = (scenarioId, params = {}) => {
    const { projectId, userId } = useAuthStore.getState();
    const query = { ...params };
    if (scenarioId) query.scenario_id = scenarioId;
    if (projectId) query.project_id = projectId;
    else if (userId) query.user_id = userId;
    return get("/visualization/poi/bbox/", query);
};

export const getUserPOIsByBBox = (scenarioId, params = {}) => {
    const { projectId, userId } = useAuthStore.getState();
    const query = { ...params };
    if (scenarioId) query.scenario_id = scenarioId;
    if (projectId) query.project_id = projectId;
    else if (userId) query.user_id = userId;
    return get("/visualization/poi/db_bbox/", query);
};

export const tileProxy = (encoded) =>
    get(`/visualization/tile-proxy/?mode=gray&url=${encoded}`);
