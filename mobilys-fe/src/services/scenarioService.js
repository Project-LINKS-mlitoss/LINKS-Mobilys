import {
    deleteScenarioApi,
    editScenarioApi,
    fetchScenarioDetailApi,
    fetchScenariosApi,
    getScenarioEditContextApi,
    fetchDuplicateCandidatesApi,
} from "../api/scenariosApi";
import { ApiError } from "../utils/errors/ApiError.js";
import { ERRORS as ERROR_MESSAGES } from "../constant";

export async function getUserScenarios(useProjectId = true) {
    try {
        const response = await fetchScenariosApi(useProjectId);
        if (!response || !response.data) {
            throw new ApiError("No data received from server", {
                statusCode: 500,
                errorCode: "NO_DATA",
            });
        }
        return response.data.data;
    } catch (err) {
        const fallbackMessage = useProjectId
            ? ERROR_MESSAGES.fetch.scenarios
            : ERROR_MESSAGES.fetch.scenariosOwnedByUser;
        if (err instanceof ApiError) throw err;
        throw ApiError.fromAxiosError(err, fallbackMessage);
    }
}

export async function getScenarioDetail(scenarioId) {
    try {
        const response = await fetchScenarioDetailApi(scenarioId);
        if (!response || !response.data) {
            throw new ApiError("No data received from server", {
                statusCode: 500,
                errorCode: "NO_DATA",
            });
        }
        return response.data.data;
    } catch (err) {
        if (err instanceof ApiError) throw err;
        throw ApiError.fromAxiosError(err, ERROR_MESSAGES.fetch.scenarioDetail);
    }
}

export async function editScenario(scenarioId, data, options = {}) {
    const fallbackMessage =
        options?.fallbackMessage ?? ERROR_MESSAGES.scenario.update;

    if (!scenarioId || !data) {
        throw new ApiError(fallbackMessage, { errorCode: "INVALID_PARAMS" });
    }

    try {
        const response = await editScenarioApi(scenarioId, data);
        if (!response || !response.data) {
            throw new ApiError("No data received from server", {
                statusCode: 500,
                errorCode: "NO_DATA",
            });
        }
        return response.data?.data ?? response.data;
    } catch (err) {
        if (err instanceof ApiError) throw err;
        throw ApiError.fromAxiosError(err, fallbackMessage);
    }
}

export async function deleteScenarioSvc(scenarioId) {
    try {
        const response = await deleteScenarioApi(scenarioId);
        if (!response || !response.data) {
            throw new ApiError("No data received from server", {
                statusCode: 500,
                errorCode: "NO_DATA",
            });
        }
    } catch (err) {
        if (err instanceof ApiError) throw err;
        throw ApiError.fromAxiosError(err, ERROR_MESSAGES.scenario.delete);
    }
}

export async function getEditScenarioContextSvc(scenarioId) {
    if (!scenarioId) {
        throw new ApiError(ERROR_MESSAGES.fetch.scenarioEditContext, {
            errorCode: "INVALID_PARAMS",
        });
    }

    try {
        const response = await getScenarioEditContextApi(scenarioId);
        if (!response || !response.data) {
            throw new ApiError("No data received from server", {
                statusCode: 500,
                errorCode: "NO_DATA",
            });
        }
        return response.data.data;
    } catch (err) {
        if (err instanceof ApiError) throw err;
        throw ApiError.fromAxiosError(
            err,
            ERROR_MESSAGES.fetch.scenarioEditContext,
        );
    }
}

export async function fetchDuplicateCandidates(scenarioId) {
    try {
        const response = await fetchDuplicateCandidatesApi({ scenarioId });
        return response.data.data;
    } catch (err) {
        throw new Error(
            err.response?.data?.message ||
                "シミュレーションシナリオ詳細の取得に失敗しました",
        );
    }
}
