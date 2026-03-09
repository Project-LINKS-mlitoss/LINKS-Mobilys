// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import {
	postGTFSDataImportApi,
	postGTFSDataImportLocalApi,
	postGTFSDataImportValidationApi,
	postGTFSDataImportApiValidation,
	cloneGTFSDataImportApi,
} from "../api/importApi";
import { ApiError } from "../utils/errors/ApiError.js";
import { ERRORS as ERROR_MESSAGES } from "../constant";

export const postGTFSDataImport = async (data) => {
	if (!data || !data.feed_id || !data.scenario_name) {
		throw new Error("Missing feed_id or scenario_name");
	}

	const response = await postGTFSDataImportApi(
		data.organization_id,
		data.feed_id,
		data.scenario_name,
		data.start_date || null,
		data.end_date || null,
		data.gtfs_file_uid || null
	);

	// Accept both 200 and 201 as success
	if (!response.status || (response.status !== 200 && response.status !== 201)) {
		throw new Error(response);
	}

	return response.data;
};

export const postGTFSDataImportValidationApiService = async (data) => {
	if (!data || !data.feed_id || !data.scenario_name) {
		throw new Error("Missing feed_id or scenario_name");
	}

	const response = await postGTFSDataImportApiValidation(
		data.organization_id,
		data.feed_id,
		data.scenario_name,
		data.start_date || null,
		data.end_date || null,
		data.gtfs_file_uid || null
	);

	// Accept both 200 and 201 as success
	if (!response.status || (response.status !== 200 && response.status !== 201)) {
		throw new Error(response);
	}

	return response.data;
};

export const postGTFSDataImportLocal = async (file, data) => {
	if (!file) {
		throw new Error("Missing file");
	}

	if (!data || !data.scenarioName) {
		data = { scenarioName: "default" };
	}

	if (!data.scenarioName) {
		throw new Error("Missing scenarioName in data");
	}

	const response = await postGTFSDataImportLocalApi(file, data);

	// Accept both 200 and 201 as success
	if (!response.status || (response.status !== 200 && response.status !== 201)) {
		throw new Error(response);
	}

	return response.data;
};

export const postGTFSDataImportValidation = async (file, data) => {
	if (!file) {
		throw new Error("Missing file");
	}

	if (!data || !data.scenarioName) {
		data = { scenarioName: "default" };
	}

	if (!data.scenarioName) {
		throw new Error("Missing scenarioName in data");
	}

	const response = await postGTFSDataImportValidationApi(file, data);

	// Accept both 200 and 201 as success
	if (!response.status || (response.status !== 200 && response.status !== 201)) {
		throw new Error(response);
	}

	return response.data;
};

export const cloneGTFSDataImport = async (data) => {
	if (!data || !data.scenario_name || !data.source_scenario_id) {
		throw new Error("Missing scenario_name or source_scenario_id");
	}

	try {
		const response = await cloneGTFSDataImportApi(
			data.scenario_name,
			data.source_scenario_id
		);

		// Accept both 200 and 201 as success
		if (!response.status || (response.status !== 200 && response.status !== 201)) {
			throw new ApiError(ERROR_MESSAGES.gtfs.cloneScenario, {
				statusCode: response?.status ?? null,
				errorCode: "CLONE_FAILED",
			});
		}

		return response.data;
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.gtfs.cloneScenario);
	}
};
