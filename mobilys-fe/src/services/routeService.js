// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import {
	fetchRouteGroupsApi,
	updateRouteGroupsApi,
	updateRouteGroupsApiColor,
	createRouteGroupApi,
	fetchRoutePatternApi,
	createRoutePatternApi,
	deleteRoutePatternApi,
	deleteRouteGroupApi,
	createExistingRoutePatternApi,
	updateRoutePatternApi,
	updateRouteGroupNameApi,
} from "../api/routesApi";
import { ApiError } from "../utils/errors/ApiError.js";
import { ERRORS as ERROR_MESSAGES } from "../constant";

export const fetchRouteGroups = async (scenarioId) => {
	try {
		const response = await fetchRouteGroupsApi(scenarioId);
		if (!response || !response.data) {
			throw new ApiError("No data received from server", {
				statusCode: 500,
				errorCode: "NO_DATA",
			});
		}
		return response.data.data;
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.route.fetchGroups);
	}
};

export const updateRouteGrouping = async (scenarioId, groupChanges) => {
	if (!scenarioId || !Array.isArray(groupChanges)) {
		throw new ApiError(ERROR_MESSAGES.route.updateGrouping, {
			errorCode: "INVALID_PARAMS",
		});
	}

	const group_changes = groupChanges.map((change) => ({
		route_id: change.route_id,
		new_keyword_id: change.new_group,
	}));

	try {
		const response = await updateRouteGroupsApi(scenarioId, { group_changes });
		if (response?.status === 200 || response?.status === 201) {
			return response.data?.data ?? response.data;
		}
		throw new ApiError(ERROR_MESSAGES.route.updateGrouping, {
			statusCode: response?.status ?? null,
			errorCode: "UPDATE_FAILED",
		});
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.route.updateGrouping);
	}
};

export const updateRouteGroupColor = async (routeGroupKeywordId, color) => {
	if (!routeGroupKeywordId || !color) {
		throw new ApiError(ERROR_MESSAGES.route.updateGroupColor, {
			errorCode: "INVALID_PARAMS",
		});
	}

	try {
		const response = await updateRouteGroupsApiColor(routeGroupKeywordId, color);
		if (response?.status === 200 || response?.status === 201) {
			return response.data?.data ?? response.data;
		}
		throw new ApiError(ERROR_MESSAGES.route.updateGroupColor, {
			statusCode: response?.status ?? null,
			errorCode: "UPDATE_FAILED",
		});
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.route.updateGroupColor);
	}
};

export const fetchRoutePattern = async (scenarioId) => {
	try {
		const response = await fetchRoutePatternApi(scenarioId);
		if (!response || !response.data) {
			throw new ApiError("No data received from server", {
				statusCode: 500,
				errorCode: "NO_DATA",
			});
		}
		return response.data.data;
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.route.fetchPatterns);
	}
};

export const createRoutePattern = async (data) => {
	try {
		const response = await createRoutePatternApi(data);
		if (response.status === 201) {
			return response.data;
		}
		throw new ApiError(ERROR_MESSAGES.route.createPattern, {
			statusCode: response?.status ?? null,
			errorCode: "CREATE_FAILED",
		});
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.route.createPattern);
	}
};

export const createRouteGroupKeyword = async (data) => {
  try {
    const resp = await createRouteGroupApi(data);

    // Support axios/fetch-like shapes
    const status =
      resp?.status ?? resp?.statusCode ?? resp?.status_code ?? null;
    const payload = resp?.data ?? resp;

    // Only 201 is success
    if (status === 201) return payload;

    // Non-201: throw with backend message (covers 409 duplicate, 200-with-error payloads, etc.)
    const msg = payload?.message || ERROR_MESSAGES.route.createGroup;
    throw new ApiError(msg, { statusCode: status, errorCode: "CREATE_FAILED" });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.fromAxiosError(err, ERROR_MESSAGES.route.createGroup);
  }
};


export const createExistingRoutePattern = async (data) => {
	try {
		const response = await createExistingRoutePatternApi(data);
		if (response.status === 201) {
			return response.data;
		}
		throw new ApiError(ERROR_MESSAGES.route.updatePattern, {
			statusCode: response?.status ?? null,
			errorCode: "UPDATE_FAILED",
		});
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.route.updatePattern);
	}
};

export const deleteRoutePattern = async (scenarioId, data) => {
	try {
		const response = await deleteRoutePatternApi(scenarioId, data);
		if (response.status === 200) {
			return response.data;
		}
		throw new ApiError(ERROR_MESSAGES.route.deletePattern, {
			statusCode: response?.status ?? null,
			errorCode: "DELETE_FAILED",
		});
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.route.deletePattern);
	}
};

export const deleteRouteGroup = async (scenarioId, data) => {
	try {
		const response = await deleteRouteGroupApi(scenarioId, data);
		if (response.status === 200) {
			return response.data;
		}
		throw new ApiError(ERROR_MESSAGES.route.deleteGroup, {
			statusCode: response?.status ?? null,
			errorCode: "DELETE_FAILED",
		});
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.route.deleteGroup);
	}
};

export const updateRoutePattern = async (scenarioId, data) => {
	try {
		const response = await updateRoutePatternApi(scenarioId, data);
		if (response.status === 200) {
			return response.data;
		}
		throw new ApiError(ERROR_MESSAGES.route.updatePattern, {
			statusCode: response?.status ?? null,
			errorCode: "UPDATE_FAILED",
		});
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.route.updatePattern);
	}
};
export const updateRouteGroupName = async (keyword_id, keyword) => {
  try {
    const response = await updateRouteGroupNameApi(keyword_id, keyword);
    if (response?.status === 200 || response?.status === 201) {
      return response.data?.data ?? response.data;
    }
    throw new ApiError(ERROR_MESSAGES.route.renameGroup, {
      statusCode: response?.status ?? null,
      errorCode: "UPDATE_FAILED",
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.fromAxiosError(err, ERROR_MESSAGES.route.renameGroup);
  }
};
