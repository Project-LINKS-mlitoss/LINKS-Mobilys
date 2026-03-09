// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { get, put, del } from "./middleware";
import { useAuthStore } from "../state/authStore";

export const fetchScenariosApi = (useProjectId = true) => {
    const { projectId } = useAuthStore.getState(); // string | null

    const base = "/gtfs/data/import/";
    // If we are not using project ID, fetch all scenarios
    if (!useProjectId) {
        return get(base);
    }
    // Only add project_id when we actually have one
    const url = projectId
        ? `${base}?project_id=${encodeURIComponent(projectId)}`
        : base;
    return get(url);
};

export const fetchScenarioDetailApi = (scenarioId) => {
    const { projectId } = useAuthStore.getState(); // string | null

    const base = `/gtfs/data/import/${scenarioId}/`;
    const url = projectId
        ? `${base}?project_id=${encodeURIComponent(projectId)}`
        : base;

    return get(url);
};

export const editScenarioApi = (scenarioId, data) =>
    put(`/gtfs/data/import/${scenarioId}/`, data);

export const deleteScenarioApi = (scenarioId) =>
    del(`/gtfs/data/import/${scenarioId}/`);

export const getScenarioEditContextApi = (scenarioId) =>
    get(`/gtfs/data/import/${scenarioId}/edit-context/`);

export const fetchDuplicateCandidatesApi = ({ scenarioId }) =>
    get(
        `/gtfs/data/import/${scenarioId}/duplication-candidates/?project_id=${encodeURIComponent(useAuthStore.getState().projectId)}`
    );
