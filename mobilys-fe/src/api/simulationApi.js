// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { get, post, put, del, patch } from "./middleware";
import { useAuthStore } from "../state/authStore";

//simulation scenario APIs
export const fetchSimulationScenariosApi = () => {
    const { projectId } = useAuthStore.getState();
    const base = "/simulation/data/";
    const url = projectId
        ? `${base}?project_id=${encodeURIComponent(projectId)}`
        : base;
    return get(url);
};
export const fetchSimulationScenarioDetailApi = (id) => {
    const { projectId } = useAuthStore.getState();
    const base = "/simulation/data/";
    const url = projectId
        ? `${base}${id}/?project_id=${encodeURIComponent(projectId)}`
        : `${base}${id}/`;
    return get(url);
};
export const createSimulationScenarioApi = (data) =>
    post(`/simulation/data/`, data);

export const deleteSimulationScenarioApi = (id) => {
    const { projectId } = useAuthStore.getState();
    const base = "/simulation/data/";
    const url = projectId
        ? `${base}${id}/?project_id=${encodeURIComponent(projectId)}`
        : `${base}${id}/`;
    return del(url);
};

// calculate route length API
export const getRouteLengthApi = ({ simulationId, routeId }) =>
    get(`/simulation/costbenefit/${simulationId}/route-length/${routeId}/`);

// car routing API
export const getCarRoutingApi = ({
    scenario_start,
    scenario_end,
    service_id,
}) =>
    get(`/simulation/car-routes/`, {
        scenario_start,
        scenario_end,
        service_id,
    });

//simulation operating economics APIs
export const getOperatingEconomicsDefaultsApi = ({ simulationId }) => {
    return get(
        `/simulation/operating-economics/patterns/?simulation_id=${simulationId}`
    );
};

//speed change APIs
export const getSpeedChangeDefaultsApi = ({ simulationId }) => {
    return get(`/simulation/travel-speed-changes/?simulation=${simulationId}`);
};

export const getUnionCalendarByDatesApi = ({ date, simulationID }) => {
    const qs = new URLSearchParams({
        date: String(date),
        simulation_id: String(simulationID),
    }).toString();
    return get(`/simulation/active-services/?${qs}`);
};

export const getSimulationInitDataApi = (id) =>
    get(`/simulation/init/?simulation_id=${id}`);

export const runSimulationApi = (file, data) => {
    const fd = new FormData();
    if (file) fd.append("file", file);

    fd.append("simulation_id", String(data.simulation_id));
    fd.append("service_date", String(data.service_date)); // "YYYY-MM-DD"

    const sids = data.service_ids ?? data.serviceIds ?? [];
    if (Array.isArray(sids)) {
        if (sids.length === 1) {
            fd.append("service_id", String(sids[0]));
        } else if (sids.length > 1) {
            fd.append("service_ids", sids.join(",")); // "平日,土曜"
        }
    } else if (typeof sids === "string" && sids.trim()) {
        fd.append("service_ids", sids.trim());
    }

    fd.append("epsilon_inc", String(data.epsilon_inc));
    fd.append("epsilon_dec", String(data.epsilon_dec));
    fd.append("cost_per_share", String(data.cost_per_share));
    fd.append("car_share", String(data.car_share));
    fd.append(
        "time_value_yen_per_min_per_vehicle",
        String(data.time_value_yen_per_min_per_vehicle)
    );
    fd.append("default_fare", String(data.default_fare));

    return post("/simulation/init/", fd);
};

export const getDetailCarRoutingApi = (simulationID) =>
    get(`/simulation/car-routes-detail/?simulation_id=${simulationID}`);

export const getDetailCarVolumeApi = (simulationID) =>
    get(`/simulation/car-volumes/?simulation_id=${simulationID}`);

export const getSimulationBenefitCalculationApi = (simulationID) =>
    get(`/simulation/benefit-calculations/?simulation=${simulationID}`);

export const getChangedRoutesApi = ({ simulation, service_id }) =>
    get(`/simulation/ridership-change/changed-routes/`, {
        simulation,
        service_id,
    });

export const getRidershipChangesApi = ({ simulation }) =>
    get(`/simulation/ridership-change/patterns/`, {
        simulation_id: simulation,
    });

export const getSimulationSummaryApi = ({ simulationID }) =>
    get(`/simulation/simulation-summary/?simulation_id=${simulationID}`);

export const renameSimulationScenarioApi = (id, name) =>
    patch(`/simulation/data/${id}/`, { name });
// --- CO2 (Block 7) ---
export const getCo2ByRouteApi = ({ simulation }) =>
    get(`/simulation/co2/by-route/patterns/`, { simulation_id: simulation });

export const getCo2TotalsApi = ({ simulation }) =>
    get(`/simulation/co2/totals/`, { simulation });

export const validateSimulationCsvApi = ({ simulationId, file }) => {
    const fd = new FormData();
    if (file) fd.append("file", file);
    return post("/simulation/init/diff/?simulation_id=" + simulationId, fd);
};

// csv validation

export const validateAndSaveSimulationCsvApi = ({
    simulationId,
    file,
    simulationInputId,
}) => {
    const fd = new FormData();
    if (file) fd.append("file", file);
    if (simulationInputId != null)
        fd.append("simulation_input_id", String(simulationInputId));
    return post(
        `/simulation/${simulationId}/validation/validate-and-save/`,
        fd
    );
};

export const getValidationResultApi = ({ simulationId }) => {
    return get(`/simulation/${simulationId}/validation-result/`);
};

export const deleteValidationResultApi = ({ simulationId }) => {
    return del(`/simulation/${simulationId}/validation-result/`);
};
