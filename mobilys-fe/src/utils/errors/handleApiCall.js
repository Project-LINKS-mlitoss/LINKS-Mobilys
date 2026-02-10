/**
 * handleApiCall
 *
 * Purpose: wrap API calls so error handling is consistent and response extraction
 * stays uniform across services/hooks.
 */

import { ApiError } from "./ApiError.js";

export async function handleApiCall(apiCall, errorMessage, options = {}) {
  const { extractData = true, validateResponse = true } = options;

  try {
    const response = await apiCall();
    if (validateResponse && (!response || !response.data)) {
      throw new ApiError("No data received from server", {
        statusCode: 500,
        errorCode: "NO_DATA",
      });
    }
    return extractData ? (response.data.data ?? response.data) : response;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw ApiError.fromAxiosError(error, errorMessage);
  }
}
