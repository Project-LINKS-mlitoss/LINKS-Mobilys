import { getCalendarApi, previewShapeApi } from '../api/utilApi';
import { ApiError } from "../utils/errors/ApiError.js";
import { ERRORS as ERROR_MESSAGES } from "../constant";

export const getCalendar = async (scenarioId) => {
  if (!scenarioId) {
    throw new Error("Scenario ID is required to fetch Calendar data");
  }

  const response = await getCalendarApi(scenarioId);
  if (response.status === 200) {
    return response.data;
  } else {
    throw new Error("Failed to fetch Calendar data");
  }
};

export const previewShape = async (data) => {
  try {
    const response = await previewShapeApi(data);
    if (response?.status !== 200) {
      throw new ApiError(ERROR_MESSAGES.shape.preview, {
        statusCode: response?.status ?? null,
        errorCode: "PREVIEW_FAILED",
      });
    }

    return response.data.data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.fromAxiosError(err, ERROR_MESSAGES.shape.preview);
  }
};
