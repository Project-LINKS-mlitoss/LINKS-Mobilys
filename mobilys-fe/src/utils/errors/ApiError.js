/**
 * ApiError
 *
 * Purpose: standardize errors coming from the API layer (especially Axios) so
 * errors thrown to features/UI have a consistent shape (statusCode, errorCode, context).
 */

export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ApiError";
    this.statusCode = options.statusCode ?? null;
    this.originalError = options.originalError ?? null;
    this.errorCode = options.errorCode ?? null;
    this.context = options.context ?? {};
  }

  static fromAxiosError(error, fallbackMessage) {
    const statusCode = error?.response?.status ?? null;
    const serverMessage =
      error?.response?.data?.message ?? error?.response?.data?.detail ?? null;
    const errorCode = error?.response?.data?.code ?? null;

    return new ApiError(serverMessage || fallbackMessage, {
      statusCode,
      originalError: error,
      errorCode,
      context: {
        url: error?.config?.url,
        method: error?.config?.method,
      },
    });
  }
}
