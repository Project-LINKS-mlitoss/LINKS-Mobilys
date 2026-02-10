import {
	getTripFrequencyApi,
	postTripFrequencyApi,
	getTripApi,
	getDetailTripApi,
	bulkDeleteTripApi,
	createTripApi,
	editTripApi,
	getDetailTripFrequencyApi,
	getDetailMapFrequencyApi,
} from "../api/tripApi";
import { ApiError } from "../utils/errors/ApiError.js";
import { ERRORS as ERROR_MESSAGES } from "../constant";

export const getTripFrequency = async (scenarioId) => {
	if (!scenarioId) {
		throw new ApiError(ERROR_MESSAGES.trip.fetchFrequency, { errorCode: "NO_SCENARIO" });
	}

	try {
		const response = await getTripFrequencyApi(scenarioId);
		if (response?.status === 200) {
			return response.data.data;
		}
		throw new ApiError(ERROR_MESSAGES.trip.fetchFrequency, {
			statusCode: response?.status ?? null,
			errorCode: "FETCH_FAILED",
		});
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.trip.fetchFrequency);
	}
};

export const saveTripFrequency = async (data) => {
	try {
		const response = await postTripFrequencyApi(data);
		if (response?.status === 200) {
			return response.data;
		}
		throw new ApiError(ERROR_MESSAGES.trip.saveFrequency, {
			statusCode: response?.status ?? null,
			errorCode: "SAVE_FAILED",
		});
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.trip.saveFrequency);
	}
};

export const getDetailTripFrequency = async (scenarioId, route_id, service_id, trip_headsign, shape_id, direction_id, pattern_hash) => {
	if (
		!scenarioId ||
		!route_id ||
		!service_id ||
		!trip_headsign ||
		!shape_id ||
		direction_id === undefined ||
		direction_id === null
	) {
		throw new ApiError(ERROR_MESSAGES.trip.fetchFrequencyDetail, {
			errorCode: "INVALID_PARAMS",
		});
	}

	try {
		const response = await getDetailTripFrequencyApi(
			scenarioId,
			route_id,
			service_id,
			trip_headsign,
			shape_id,
			direction_id,
			pattern_hash
		);
		if (response?.status === 200) {
			return response.data;
		}
		throw new ApiError(ERROR_MESSAGES.trip.fetchFrequencyDetail, {
			statusCode: response?.status ?? null,
			errorCode: "FETCH_FAILED",
		});
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.trip.fetchFrequencyDetail);
	}
};

export const getDetailMapFrequency = async (scenarioId, shape_id) => {
	if (!scenarioId || !shape_id) {
		throw new ApiError(ERROR_MESSAGES.trip.fetchMapFrequency, {
			errorCode: "INVALID_PARAMS",
		});
	}

	try {
		const response = await getDetailMapFrequencyApi(scenarioId, shape_id);
		if (response?.status === 200) {
			return response.data;
		}
		throw new ApiError(ERROR_MESSAGES.trip.fetchMapFrequency, {
			statusCode: response?.status ?? null,
			errorCode: "FETCH_FAILED",
		});
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.trip.fetchMapFrequency);
	}
};

export const bulkDeleteTrips = async (scenarioId, tripIds) => {
	if (!scenarioId || !Array.isArray(tripIds) || tripIds.length === 0) {
		throw new ApiError(ERROR_MESSAGES.trip.deleteTrips, { errorCode: "INVALID_PARAMS" });
	}

	try {
		const response = await bulkDeleteTripApi(scenarioId, tripIds);
		if (response?.status === 200) {
			return response.data;
		}
		throw new ApiError(ERROR_MESSAGES.trip.deleteTrips, {
			statusCode: response?.status ?? null,
			errorCode: "DELETE_FAILED",
		});
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.trip.deleteTrips);
	}
};

export const getTrip = async (scenarioId) => {
	if (!scenarioId) {
		throw new ApiError(ERROR_MESSAGES.trip.fetchTrips, { errorCode: "NO_SCENARIO" });
	}

	try {
		const response = await getTripApi(scenarioId);
		if (response?.status === 200) {
			return response.data;
		}
		throw new ApiError(ERROR_MESSAGES.trip.fetchTrips, {
			statusCode: response?.status ?? null,
			errorCode: "FETCH_FAILED",
		});
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.trip.fetchTrips);
	}
};


export const getDetailTrip = async (scenarioId, tripId) => {
	if (!scenarioId || !tripId) {
		throw new ApiError(ERROR_MESSAGES.trip.fetchTripDetail, {
			errorCode: "INVALID_PARAMS",
		});
	}

	try {
		const response = await getDetailTripApi(scenarioId, tripId);
		if (response?.status === 200) {
			return response.data;
		}
		throw new ApiError(ERROR_MESSAGES.trip.fetchTripDetail, {
			statusCode: response?.status ?? null,
			errorCode: "FETCH_FAILED",
		});
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.trip.fetchTripDetail);
	}
};


export const createTrip = async (data) => {
	if (!data) {
		throw new ApiError(ERROR_MESSAGES.trip.createTrip, { errorCode: "INVALID_PARAMS" });
	}

	try {
		const response = await createTripApi(data);
		if (response?.status === 201) {
			return response.data;
		}
		throw new ApiError(ERROR_MESSAGES.trip.createTrip, {
			statusCode: response?.status ?? null,
			errorCode: "CREATE_FAILED",
		});
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.trip.createTrip);
	}
};


export const editTrip = async (scenarioId, tripId, data) => {
	if (!scenarioId || !tripId || !data) {
		throw new ApiError(ERROR_MESSAGES.trip.updateTrip, { errorCode: "INVALID_PARAMS" });
	}

	try {
		const response = await editTripApi(scenarioId, tripId, data);
		if (response?.status === 200) {
			return response.data;
		}
		throw new ApiError(ERROR_MESSAGES.trip.updateTrip, {
			statusCode: response?.status ?? null,
			errorCode: "UPDATE_FAILED",
		});
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.trip.updateTrip);
	}
};

