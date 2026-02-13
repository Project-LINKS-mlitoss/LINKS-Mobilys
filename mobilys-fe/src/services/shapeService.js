// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import {
  bulkUpdateShape,
  generateShapeFromStops as generateShapeFromStopsApi,
  generateShapeFromCoordinatesOnly as generateShapeFromCoordinatesOnlyApi,
  addNewShapeAndApplyToPatterns as addNewShapeAndApplyToPatternsApi,
} from "../api/shapeApi";
import { ApiError } from "../utils/errors/ApiError.js";
import { ERRORS as ERROR_MESSAGES } from "../constant";

export const updateShapesBulk = async (scenarioId, shapeData) => {
  try {
    const response = await bulkUpdateShape(scenarioId, shapeData);
    if (response?.status === 200 || response?.status === 201) {
      return response.data;
    }
    throw new ApiError(ERROR_MESSAGES.shape.updateBulk, {
      statusCode: response?.status ?? null,
      errorCode: "UPDATE_FAILED",
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.fromAxiosError(err, ERROR_MESSAGES.shape.updateBulk);
  }
};

export const addNewShapeAndApplyToPatterns = async (payload) => {
  try {
    const response = await addNewShapeAndApplyToPatternsApi(payload);
    if (response.status === 200) {
      return response.data;
    }
    return response.data;
  } catch (err) {
    const msg =
      err?.response?.data?.message ||
      err?.message ||
      "シェイプの追加に失敗しました";
    throw new Error(msg);
  }
};

// SHAPE GENERATOR (NO DB ACCESS)
export const generateShapeFromStops = async (payload) => {
  try {
    const response = await generateShapeFromStopsApi(payload);
    if (response.status === 200) {
      return response.data;
    }
    return response.data;
  } catch (err) {
    const msg =
      err?.response?.data?.message ||
      err?.message ||
      "シェイプの自動生成に失敗しました";
    throw new Error(msg);
  }
};

export const generateShapeFromCoordinatesOnly = async (payload) => {
  try {
    const response = await generateShapeFromCoordinatesOnlyApi(payload);
    if (response.status === 200) {
      return response.data;
    }
    return response.data;
  } catch (err) {
    const msg =
      err?.response?.data?.message ||
      err?.message ||
      "シェイプの自動生成に失敗しました";
    throw new Error(msg);
  }
};
