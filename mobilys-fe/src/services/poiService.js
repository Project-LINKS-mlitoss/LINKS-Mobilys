// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import {
    getPoiList,
    checkPoiCsvBatch,
    commitPoiBatchesApi,
    deletePoiBatchApi,
    setActivePoiBatchApi,
} from "../api/poiApi";
import { useAuthStore } from "../state/authStore";
import { ApiError } from "../utils/errors/ApiError.js";
import { ERRORS as ERROR_MESSAGES } from "../constant";

const resolveProjectId = (override) => {
    const fromStore = useAuthStore?.getState?.().projectId;
    return override ?? fromStore ?? null;
};

export const getPoiData = async (type, projectIdOverride) => {
    const projectId = resolveProjectId(projectIdOverride);
    try {
        const response = await getPoiList(type, projectId);
        if (!response || !response.data) {
            return { total: 0, groups: [], active_batch_id: null };
        }
        if (response.status === 200) {
            return response.data.data;
        }
        return { total: 0, groups: [], active_batch_id: null };
    } catch {
        return { total: 0, groups: [], active_batch_id: null };
    }
};

export const getPoiDataStrict = async (type, projectIdOverride) => {
    const projectId = resolveProjectId(projectIdOverride);

    try {
        const response = await getPoiList(type, projectId);
        if (!response || !response.data) {
            throw new ApiError("No data received from server", {
                statusCode: 500,
                errorCode: "NO_DATA",
            });
        }
        if (response.status === 200) {
            return response.data.data;
        }
        throw new ApiError(ERROR_MESSAGES.poi.fetch, {
            statusCode: response.status,
            errorCode: "FETCH_FAILED",
        });
    } catch (err) {
        if (err instanceof ApiError) throw err;
        throw ApiError.fromAxiosError(err, ERROR_MESSAGES.poi.fetch);
    }
};

export const checkPoiFilesSvc = async (files) => {
    if (!Array.isArray(files) || files.length === 0) {
        throw new ApiError(ERROR_MESSAGES.poi.check, {
            errorCode: "INVALID_PARAMS",
        });
    }

    try {
        const res = await checkPoiCsvBatch(files);
        if (!res || !res.data) {
            throw new ApiError("No data received from server", {
                statusCode: 500,
                errorCode: "NO_DATA",
            });
        }
        return res.data?.data ?? res.data;
    } catch (err) {
        if (err instanceof ApiError) throw err;
        throw ApiError.fromAxiosError(err, ERROR_MESSAGES.poi.check);
    }
};

export const commitPoiBatchesSvc = async (payload, projectIdOverride) => {
    const projectId = resolveProjectId(projectIdOverride);
    if (!payload) {
        throw new ApiError(ERROR_MESSAGES.poi.commit, {
            errorCode: "INVALID_PARAMS",
        });
    }

    try {
        const res = await commitPoiBatchesApi(payload, projectId);
        if (!res || !res.data) {
            throw new ApiError("No data received from server", {
                statusCode: 500,
                errorCode: "NO_DATA",
            });
        }
        if (res.status === 200 || res.status === 201) {
            return res.data?.data ?? res.data;
        }
        throw new ApiError(ERROR_MESSAGES.poi.commit, {
            statusCode: res.status,
            errorCode: "COMMIT_FAILED",
        });
    } catch (err) {
        if (err instanceof ApiError) throw err;
        throw ApiError.fromAxiosError(err, ERROR_MESSAGES.poi.commit);
    }
};

export const deletePoiBatchSvc = async (batchId, projectIdOverride) => {
    const projectId = resolveProjectId(projectIdOverride);
    if (!batchId) {
        throw new ApiError(ERROR_MESSAGES.poi.deleteBatch, {
            errorCode: "INVALID_PARAMS",
        });
    }

    try {
        const res = await deletePoiBatchApi(batchId, projectId);
        if (!res || !res.data) {
            throw new ApiError("No data received from server", {
                statusCode: 500,
                errorCode: "NO_DATA",
            });
        }
        if (res.status === 200 || res.status === 204) {
            return res.data?.data ?? res.data;
        }
        throw new ApiError(ERROR_MESSAGES.poi.deleteBatch, {
            statusCode: res.status,
            errorCode: "DELETE_FAILED",
        });
    } catch (err) {
        if (err instanceof ApiError) throw err;
        throw ApiError.fromAxiosError(err, ERROR_MESSAGES.poi.deleteBatch);
    }
};

export const setActivePoiBatchSvc = async (batchId, projectIdOverride) => {
    const projectId = resolveProjectId(projectIdOverride);
    if (!batchId) {
        throw new ApiError(ERROR_MESSAGES.poi.setActiveBatch, {
            errorCode: "INVALID_PARAMS",
        });
    }

    try {
        const res = await setActivePoiBatchApi({ projectId, batchId });
        if (!res || !res.data) {
            throw new ApiError("No data received from server", {
                statusCode: 500,
                errorCode: "NO_DATA",
            });
        }
        if (res.status === 200 || res.status === 201) {
            return res.data?.data ?? res.data;
        }
        throw new ApiError(ERROR_MESSAGES.poi.setActiveBatch, {
            statusCode: res.status,
            errorCode: "UPDATE_FAILED",
        });
    } catch (err) {
        if (err instanceof ApiError) throw err;
        throw ApiError.fromAxiosError(err, ERROR_MESSAGES.poi.setActiveBatch);
    }
};
