import { postGTFSExportApi } from "../api/exportApi";
import { ApiError } from "../utils/errors/ApiError.js";
import { ERRORS as ERROR_MESSAGES } from "../constant";

/**
 * Export GTFS (uses same-origin HTTPS in prod, keeps axios/middleware in dev)
 */
export const exportGTFS = async ({
  scenarioId,
  startDate = null,
  endDate = null,
  fileTypes = [],
  onProgress,
}) => {
  if (!scenarioId) throw new ApiError(ERROR_MESSAGES.gtfs.export, { errorCode: "NO_SCENARIO" });

  const body = {
    start_date: startDate,
    end_date: endDate,
    files: fileTypes,
  };

  try {
    const response = await postGTFSExportApi(scenarioId, body, {
      responseType: "blob",
      onDownloadProgress: (evt) => {
        if (onProgress && evt?.total) {
          const pct = Math.round((evt.loaded / evt.total) * 100);
          onProgress(pct);
        }
      },
    });

    if (!response || (response.status !== 200 && response.status !== 201)) {
      throw new ApiError(ERROR_MESSAGES.gtfs.export, {
        statusCode: response?.status ?? null,
        errorCode: "EXPORT_FAILED",
      });
    }

    return response.data; // axios blob
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.fromAxiosError(err, ERROR_MESSAGES.gtfs.export);
  }
};
