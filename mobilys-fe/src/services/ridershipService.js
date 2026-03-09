// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import {
	uploadRidershipFileApi,
	listRidershipUploadsAllApi,
	listRidershipUploadsByScenarioApi,
	getRidershipUploadDetailApi,
	deleteRidershipUploadApi,
	listRidershipRecordsApi,
	exportRidershipRecordsApi,
	exportRidershipUploadApi,
	convertOneDetailedToBoardingAlightingWithMetadataApi,
	convertOneDetailedToBoardingAlightingCsvApi,
	convertOneDetailedToOdCsvApi,
} from "../api/ridershipApi";
import { ApiError } from "../utils/errors/ApiError.js";
import { ERRORS as ERROR_MESSAGES } from "../constant";

const normalizeList = (payload) => {
	const data = payload?.data ?? payload;
	if (Array.isArray(data)) {
		return { items: data, pagination: payload?.pagination ?? null };
	}
	if (Array.isArray(data?.data)) {
		return { items: data.data, pagination: data?.pagination ?? payload?.pagination ?? null };
	}
	return { items: [], pagination: payload?.pagination ?? null };
};

const parseFilenameFromDisposition = (contentDisposition) => {
	if (!contentDisposition) return "";
	const raw = String(contentDisposition);
	// filename*=UTF-8''...
	const utf8Match = raw.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
	if (utf8Match?.[1]) {
		try {
			return decodeURIComponent(utf8Match[1].trim().replace(/^"|"$/g, ""));
		} catch {
			return utf8Match[1].trim().replace(/^"|"$/g, "");
		}
	}
	const match = raw.match(/filename\s*=\s*([^;]+)/i);
	if (match?.[1]) return match[1].trim().replace(/^"|"$/g, "");
	return "";
};

export const uploadRidershipFileSvc = async (scenarioId, req) => {
	try {
		const res = await uploadRidershipFileApi(scenarioId, req);
		if (!res || !res.data) {
			throw new ApiError("No data received from server", {
				statusCode: 500,
				errorCode: "NO_DATA",
			});
		}
		return res.data;
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.ridership.uploadFile);
	}
};

export const listRidershipUploadsSvc = async ({ scenarioId = null, params = {} } = {}) => {
	try {
		const res = scenarioId
			? await listRidershipUploadsByScenarioApi(scenarioId, params)
			: await listRidershipUploadsAllApi(params);
		return normalizeList(res?.data);
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.ridership.listUploads);
	}
};

export const getRidershipUploadDetailSvc = async ({
	scenarioId,
	uploadId,
	params = {},
} = {}) => {
	try {
		const res = await getRidershipUploadDetailApi(scenarioId, uploadId, params);
		if (!res || !res.data) {
			throw new ApiError("No data received from server", {
				statusCode: 500,
				errorCode: "NO_DATA",
			});
		}
		return res?.data?.data ?? res?.data;
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.ridership.uploadDetail);
	}
};

export const deleteRidershipUploadSvc = async ({ scenarioId, uploadId } = {}) => {
	try {
		const res = await deleteRidershipUploadApi(scenarioId, uploadId);
		if (!res || !res.data) {
			throw new ApiError("No data received from server", {
				statusCode: 500,
				errorCode: "NO_DATA",
			});
		}
		return res?.data;
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.ridership.deleteUpload);
	}
};

export const listRidershipRecordsSvc = async ({ scenarioId, params = {} } = {}) => {
	try {
		const res = await listRidershipRecordsApi(scenarioId, params);
		return normalizeList(res?.data);
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.ridership.listRecords);
	}
};

export const exportRidershipRecordsSvc = async ({ scenarioId, params = {} } = {}) => {
	const res = await exportRidershipRecordsApi(scenarioId, params);
	const filename =
		parseFilenameFromDisposition(res?.headers?.["content-disposition"]) || "";
	const recordCount = Number(res?.headers?.["x-record-count"] || 0) || 0;
	return { blob: res?.data, filename, recordCount };
};

export const exportRidershipUploadSvc = async ({
	scenarioId,
	uploadId,
	params = {},
} = {}) => {
	try {
		const res = await exportRidershipUploadApi(scenarioId, uploadId, params);
		const filename =
			parseFilenameFromDisposition(res?.headers?.["content-disposition"]) || "";
		const recordCount = Number(res?.headers?.["x-record-count"] || 0) || 0;
		return { blob: res?.data, filename, recordCount };
	} catch (err) {
		// Axios errors for blob responses can contain response.data as Blob
		const blob = err?.response?.data;
		let messageFromBlob = null;
		if (blob instanceof Blob) {
			try {
				const text = await blob.text();
				const json = JSON.parse(text);
				messageFromBlob = json?.message || json?.detail || null;
			} catch {
				messageFromBlob = null;
			}
		}
		if (messageFromBlob) {
			throw new ApiError(messageFromBlob, {
				statusCode: err?.response?.status ?? null,
				originalError: err,
				errorCode: err?.response?.data?.code ?? null,
			});
		}

		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.ridership.exportUpload);
	}
};

export const convertOneDetailedToBoardingAlightingWithMetadataSvc = async ({
	scenarioId,
	ridershipUploadId,
} = {}) => {
	if (!scenarioId || !ridershipUploadId) {
		throw new ApiError(ERROR_MESSAGES.ridership.convertBoardingAlightingWithMetadata, {
			errorCode: "INVALID_PARAMS",
		});
	}

	try {
		const res = await convertOneDetailedToBoardingAlightingWithMetadataApi({
			scenario_id: scenarioId,
			ridership_upload_id: ridershipUploadId,
		});
		if (!res || !res.data) {
			throw new ApiError("No data received from server", {
				statusCode: 500,
				errorCode: "NO_DATA",
			});
		}
		return res?.data;
	} catch (err) {
		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.ridership.convertBoardingAlightingWithMetadata);
	}
};

export const convertOneDetailedToBoardingAlightingCsvSvc = async ({
	scenarioId,
	ridershipUploadId,
} = {}) => {
	if (!scenarioId || !ridershipUploadId) {
		throw new ApiError(ERROR_MESSAGES.ridership.convertBoardingAlightingCsv, {
			errorCode: "INVALID_PARAMS",
		});
	}

	try {
		const res = await convertOneDetailedToBoardingAlightingCsvApi({
			scenario_id: scenarioId,
			ridership_upload_id: ridershipUploadId,
		});

		const filename = parseFilenameFromDisposition(res?.headers?.["content-disposition"]) || "";
		const totalInputRows = Number(res?.headers?.["x-total-input-rows"] || 0) || 0;
		const totalOutputRows = Number(res?.headers?.["x-total-output-rows"] || 0) || 0;
		const errorCount = Number(res?.headers?.["x-error-count"] || 0) || 0;
		const sourceType = String(res?.headers?.["x-source-type"] || "");

		return {
			blob: res?.data,
			filename,
			totalInputRows,
			totalOutputRows,
			errorCount,
			sourceType,
		};
	} catch (err) {
		const blob = err?.response?.data;
		let messageFromBlob = null;
		if (blob instanceof Blob) {
			try {
				const text = await blob.text();
				const json = JSON.parse(text);
				messageFromBlob = json?.message || json?.detail || null;
			} catch {
				messageFromBlob = null;
			}
		}
		if (messageFromBlob) {
			throw new ApiError(messageFromBlob, {
				statusCode: err?.response?.status ?? null,
				originalError: err,
				errorCode: err?.response?.data?.code ?? null,
			});
		}

		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.ridership.convertBoardingAlightingCsv);
	}
};

export const convertOneDetailedToOdCsvSvc = async ({
	scenarioId,
	file = null,
	ridershipUploadId = null,
} = {}) => {
	const hasFile = !!file;
	const hasUpload = !!ridershipUploadId;
	if (!scenarioId) {
		throw new ApiError(ERROR_MESSAGES.ridership.convertOdCsv, { errorCode: "INVALID_PARAMS" });
	}
	if (hasFile === hasUpload) {
		throw new ApiError(ERROR_MESSAGES.ridership.convertOdCsv, { errorCode: "INVALID_PARAMS" });
	}

	try {
		const res = await convertOneDetailedToOdCsvApi({
			scenario_id: scenarioId,
			file: hasFile ? file : undefined,
			ridership_upload_id: hasUpload ? ridershipUploadId : undefined,
		});

		const contentType = String(res?.headers?.["content-type"] || "").toLowerCase();
		if (contentType.includes("application/json")) {
			const text = res?.data instanceof Blob ? await res.data.text() : "";
			let msg = text;
			try {
				const json = JSON.parse(text);
				msg = json?.message || json?.detail || msg;
			} catch {
				// ignore
			}
			throw new ApiError(msg || ERROR_MESSAGES.ridership.convertOdCsv, {
				statusCode: res?.status ?? null,
				errorCode: "UNEXPECTED_JSON_RESPONSE",
			});
		}

		const filename =
			parseFilenameFromDisposition(res?.headers?.["content-disposition"]) || "";
		const totalInputRows = Number(res?.headers?.["x-total-input-rows"] || 0) || 0;
		const totalOutputRows = Number(res?.headers?.["x-total-output-rows"] || 0) || 0;
		const errorCount = Number(res?.headers?.["x-error-count"] || 0) || 0;
		const sourceType = String(res?.headers?.["x-source-type"] || "");

		return {
			blob: res?.data,
			filename,
			totalInputRows,
			totalOutputRows,
			errorCount,
			sourceType,
		};
	} catch (err) {
		const blob = err?.response?.data;
		let messageFromBlob = null;
		if (blob instanceof Blob) {
			try {
				const text = await blob.text();
				const json = JSON.parse(text);
				messageFromBlob = json?.message || json?.detail || null;
			} catch {
				messageFromBlob = null;
			}
		}
		if (messageFromBlob) {
			throw new ApiError(messageFromBlob, {
				statusCode: err?.response?.status ?? null,
				originalError: err,
				errorCode: err?.response?.data?.code ?? null,
			});
		}

		if (err instanceof ApiError) throw err;
		throw ApiError.fromAxiosError(err, ERROR_MESSAGES.ridership.convertOdCsv);
	}
};
