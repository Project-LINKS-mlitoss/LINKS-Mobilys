import {
	createNewStopChildApi,
	createNewStopParentApi,
	deleteStopApi,
	updateStopApi,
	fetchStopsApi,
	patchStopGroupNameApi,
	patchStopGroupIdApi,
} from "../api/stopApi";
import {
	fetchStopGroupsApi,
	updateStopGroupsApi,
	updateStopGroupingMethodApi,
} from "../api/stopsApi";
import { groupingMethodMap } from "../constant/gtfs";
import { ApiError } from "../utils/errors/ApiError.js";
import { ERRORS as ERROR_MESSAGES } from "../constant";

export const fetchStopGroups = async (scenarioId) => {
	if (!scenarioId) {
		throw new ApiError(ERROR_MESSAGES.stop.fetchGroups, {
			errorCode: "INVALID_PARAMS",
		});
	}

	try {
		const response = await fetchStopGroupsApi(scenarioId);
		if (!response || !response.data) {
			throw new ApiError("No data received from server", {
				statusCode: 500,
				errorCode: "NO_DATA",
			});
		}
		return response.data?.data ?? response.data;
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.stop.fetchGroups);
	}
};

export const updateStopGrouping = async (scenarioId, groupChanges, method) => {
	if (
		!scenarioId ||
		!Array.isArray(groupChanges) ||
		!method ||
		![
			groupingMethodMap.GROUPING_BY_NAME,
			groupingMethodMap.GROUPING_BY_ID,
		].includes(method)
	) {
		throw new ApiError(ERROR_MESSAGES.stop.updateGrouping, {
			errorCode: "INVALID_PARAMS",
		});
	}

	const stop_grouping_method =
		method === groupingMethodMap.GROUPING_BY_NAME ? "stop_names" : "stop_id";

	const group_changes = groupChanges.map((change) => {
		const base = { stop_id: change.stop_id };
		if (method === groupingMethodMap.GROUPING_BY_NAME) {
			return {
				...base,
				new_stop_names_group_id: change.new_group,
			};
		} else {
			return {
				...base,
				new_stop_id_group_id: change.new_group,
			};
		}
	});

	try {
		const response = await updateStopGroupsApi(scenarioId, {
			stop_grouping_method,
			group_changes,
		});
		if (response?.status === 200 || response?.status === 201) {
			return response.data?.data ?? response.data;
		}
		throw new ApiError(ERROR_MESSAGES.stop.updateGrouping, {
			statusCode: response?.status ?? null,
			errorCode: "UPDATE_FAILED",
		});
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.stop.updateGrouping);
	}
};

export const updateStopGroupingMethod = async (scenarioId, method) => {
	if (!scenarioId || !method) {
		throw new ApiError(ERROR_MESSAGES.stop.updateGroupingMethod, {
			errorCode: "INVALID_PARAMS",
		});
	}
	const grouping_method =
		method === groupingMethodMap.GROUPING_BY_NAME
			? groupingMethodMap.GROUPING_BY_NAME
			: groupingMethodMap.GROUPING_BY_ID;

	try {
		const response = await updateStopGroupingMethodApi(scenarioId, {
			grouping_method,
		});
		if (response?.status === 200 || response?.status === 201) {
			return response.data?.data ?? response.data;
		}
		throw new ApiError(ERROR_MESSAGES.stop.updateGroupingMethod, {
			statusCode: response?.status ?? null,
			errorCode: "UPDATE_FAILED",
		});
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.stop.updateGroupingMethod);
	}
};

export const addStopParentSvc = async (data) => {
	if (!data) {
		throw new ApiError(ERROR_MESSAGES.stop.createStop, {
			errorCode: "INVALID_PARAMS",
		});
	}

	try {
		const response = await createNewStopParentApi(data);
		if (!response || !response.data) {
			throw new ApiError("No data received from server", {
				statusCode: 500,
				errorCode: "NO_DATA",
			});
		}
		return response.data?.data ?? response.data;
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.stop.createStop);
	}
};

export const addStopChildSvc = async (data) => {
	if (!data) {
		throw new ApiError(ERROR_MESSAGES.stop.createStop, {
			errorCode: "INVALID_PARAMS",
		});
	}

	try {
		const response = await createNewStopChildApi(data);
		if (!response || !response.data) {
			throw new ApiError("No data received from server", {
				statusCode: 500,
				errorCode: "NO_DATA",
			});
		}
		return response.data?.data ?? response.data;
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.stop.createStop);
	}
};

export const editStopSvc = async (scenarioId, stopId, data) => {
	if (!scenarioId || !stopId || !data) {
		throw new ApiError(ERROR_MESSAGES.stop.updateStop, {
			errorCode: "INVALID_PARAMS",
		});
	}

	try {
		const response = await updateStopApi(scenarioId, stopId, data);
		if (!response || !response.data) {
			throw new ApiError("No data received from server", {
				statusCode: 500,
				errorCode: "NO_DATA",
			});
		}
		return response.data?.data ?? response.data;
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.stop.updateStop);
	}
};

export const deleteStopSvc = async (scenarioId, stopId) => {
	if (!scenarioId || !stopId) {
		throw new ApiError(ERROR_MESSAGES.stop.deleteStop, {
			errorCode: "INVALID_PARAMS",
		});
	}

	try {
		const response = await deleteStopApi(scenarioId, stopId);

		// 204 No Content is a success
		if (response?.status === 204) {
			return true;
		}

		if (!response || !response.data) {
			throw new ApiError("No data received from server", {
				statusCode: 500,
				errorCode: "NO_DATA",
			});
		}
		return response.data?.data ?? response.data;
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.stop.deleteStop);
	}
};

export const getStops = async (scenarioId) => {
	if (!scenarioId) {
		throw new ApiError(ERROR_MESSAGES.stop.fetchStops, {
			errorCode: "INVALID_PARAMS",
		});
	}

	try {
		const response = await fetchStopsApi(scenarioId);
		if (response?.status === 200) {
			return response.data;
		}
		throw new ApiError(ERROR_MESSAGES.stop.fetchStops, {
			statusCode: response?.status ?? null,
			errorCode: "FETCH_FAILED",
		});
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.stop.fetchStops);
	}
};


export const patchStopGroupName = async (stop_group_id, data) => {
	if (!data) {
		throw new ApiError(ERROR_MESSAGES.stop.patchGroupName, {
			errorCode: "INVALID_PARAMS",
		});
	}

	try {
		const response = await patchStopGroupNameApi(stop_group_id, data);
		if (!response || !response.data) {
			throw new ApiError("No data received from server", {
				statusCode: 500,
				errorCode: "NO_DATA",
			});
		}
		return response.data?.data ?? response.data;
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.stop.patchGroupName);
	}
};

export const patchStopGroupId = async (stop_group_id, data) => {
	if (!data) {
		throw new ApiError(ERROR_MESSAGES.stop.patchGroupId, {
			errorCode: "INVALID_PARAMS",
		});
	}

	try {
		const response = await patchStopGroupIdApi(stop_group_id, data);
		if (!response || !response.data) {
			throw new ApiError("No data received from server", {
				statusCode: 500,
				errorCode: "NO_DATA",
			});
		}
		return response.data?.data ?? response.data;
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.stop.patchGroupId);
	}
};
