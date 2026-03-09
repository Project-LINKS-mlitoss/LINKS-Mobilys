// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { get, getBlob, post, del } from "./middleware";

const BASE = "/gtfs/data/ridership";
const CONVERT_BASE = "/gtfs/data/ridership/convert";
const OD_CONVERT_PATH = "/gtfs/data/ridership/convert/one-detailed-to-od/";

export const uploadRidershipFileApi = (
	scenarioId,
	{ file, ridership_record_name, description, validation_mode, max_tolerance_time }
) => {
	const formData = new FormData();
	formData.append("file", file);
	formData.append("ridership_record_name", ridership_record_name);
	if (typeof description === "string") formData.append("description", description);
	if (typeof validation_mode === "string")
		formData.append("validation_mode", validation_mode);
	if (Number.isFinite(max_tolerance_time))
		formData.append("max_tolerance_time", String(max_tolerance_time));

	return post(`${BASE}/${scenarioId}/upload/`, formData, {
		headers: { "Content-Type": "multipart/form-data" },
	});
};

export const listRidershipUploadsAllApi = (params = {}) =>
	get(`${BASE}/uploads/`, params);

export const listRidershipUploadsByScenarioApi = (scenarioId, params = {}) =>
	get(`${BASE}/${scenarioId}/uploads/`, params);

export const getRidershipUploadDetailApi = (scenarioId, uploadId, params = {}) =>
	get(`${BASE}/${scenarioId}/uploads/${uploadId}/`, params);

export const deleteRidershipUploadApi = (scenarioId, uploadId) =>
	del(`${BASE}/${scenarioId}/uploads/${uploadId}/`);

export const listRidershipRecordsApi = (scenarioId, params = {}) =>
	get(`${BASE}/${scenarioId}/records/`, params);

export const exportRidershipRecordsApi = (scenarioId, params = {}) =>
	getBlob(`${BASE}/${scenarioId}/export/`, params);

export const exportRidershipUploadApi = (scenarioId, uploadId, params = {}) =>
	getBlob(`${BASE}/${scenarioId}/uploads/${uploadId}/export/`, params);

export const convertOneDetailedToBoardingAlightingWithMetadataApi = ({
	scenario_id,
	ridership_upload_id,
} = {}) => {
	const formData = new FormData();
	formData.append("scenario_id", scenario_id);
	formData.append("ridership_upload_id", ridership_upload_id);

	return post(
		`${CONVERT_BASE}/one-detailed-to-boarding-alighting/with-metadata/`,
		formData,
		{
			headers: { "Content-Type": "multipart/form-data" },
		}
	);
};

export const convertOneDetailedToBoardingAlightingCsvApi = ({
	scenario_id,
	ridership_upload_id,
} = {}) => {
	const formData = new FormData();
	formData.append("scenario_id", scenario_id);
	formData.append("ridership_upload_id", ridership_upload_id);

	return post(`${CONVERT_BASE}/one-detailed-to-boarding-alighting/`, formData, {
		headers: { "Content-Type": "multipart/form-data" },
		responseType: "blob",
	});
};

export const convertOneDetailedToOdCsvApi = ({
	scenario_id,
	file,
	ridership_upload_id,
} = {}) => {
	const formData = new FormData();
	formData.append("scenario_id", scenario_id);
	if (file) formData.append("file", file);
	if (ridership_upload_id) formData.append("ridership_upload_id", ridership_upload_id);

	return post(`${OD_CONVERT_PATH}`, formData, {
		headers: { "Content-Type": "multipart/form-data" },
		responseType: "blob",
	});
};
