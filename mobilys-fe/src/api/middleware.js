import axios from "axios";
import { useAuthStore } from "../state/authStore";
import { useSnackbarStore } from "../state/snackbarStore";

const DEFAULT_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const api = axios.create({
  baseURL: DEFAULT_API_BASE_URL,
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

// Attach access token on every request
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().access;
    if (typeof token === "string" && token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config || {};
    const status = error?.response?.status;
    const data = error?.response?.data || {};

    const is401 = status === 401;
    const tokenError =
      (data.code && data.code === "token_not_valid") ||
      (typeof data.detail === "string" && data.detail.toLowerCase().includes("token"));

    // Handle expired/invalid token: try refresh once, then retry the original request
    if (is401 && tokenError && !originalRequest._retry) {
      originalRequest._retry = true;
      originalRequest._handledInternally = true;

      // If a refresh is already in-flight, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (newToken) => {
              const cfg = { ...originalRequest };
              cfg.headers = cfg.headers ?? {};
              cfg.headers.Authorization = "Bearer " + newToken;
              resolve(api(cfg));
            },
            reject,
          });
        });
      }

      isRefreshing = true;
      const refreshToken = useAuthStore.getState().refresh;

      try {
        const res = await axios.post(`${DEFAULT_API_BASE_URL}/user/refresh/`, {
          refresh: refreshToken,
        });
        const newAccessToken = res?.data?.access;

        // Rehydrate store tokens
        const {
          projectId,
          roleLevel,
          userId,
          username,
          email,
          accessCodes,
          setTokens,
          setMapUrl,
        } = useAuthStore.getState();

        setTokens({
          access: newAccessToken,
          refresh: refreshToken,
          projectId,
          roleLevel,
          userId,
          username,
          email,
          accessCodes,
          user: roleLevel ? { role: { level: roleLevel } } : undefined,
        });

        if (res?.data?.map_url) {
          setMapUrl(res.data.map_url);
        }

        // Update headers for subsequent requests
        api.defaults.headers["Authorization"] = "Bearer " + newAccessToken;

        // Retry the original request with the new token
        const retryConfig = {
          ...originalRequest,
          headers: {
            ...(originalRequest.headers || {}),
            Authorization: "Bearer " + newAccessToken,
          },
        };

        processQueue(null, newAccessToken);
        isRefreshing = false;

        delete retryConfig._retry;
        delete retryConfig.transformRequest;
        delete retryConfig.transformResponse;

        return api(retryConfig);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;

        useAuthStore.getState().logout();
        setTimeout(() => {
          useSnackbarStore.getState().showSnackbar({
            title: "セッションが切れました",
            detail: "セッションが期限切れです。再度ログインしてください。",
            severity: "error",
          });
        }, 400);
        window.location.href = "/login";

        return Promise.reject(refreshError);
      }
    }

    if (originalRequest?._retry) {
      return Promise.reject(error);
    }

    // Suppress intermediate 401 while refresh flow is ongoing
    if (is401 && tokenError) {
      return new Promise(() => {});
    }

    return Promise.reject(error);
  }
);

// ---------- HTTP helpers ----------
export const get = (url, params = {}) => {
  const query = new URLSearchParams(params).toString();
  const fullUrl = query ? `${url}?${query}` : url;
  return api.get(fullUrl);
};

// For file downloads (Blob)
export const getBlob = (url, params = {}, config = {}) => {
  const query = new URLSearchParams(params).toString();
  const fullUrl = query ? `${url}?${query}` : url;
  return api.get(fullUrl, { ...config, responseType: "blob" });
};

export const post = (url, data = {}, config = {}) => api.post(url, data, config);
export const put = (url, data = {}, config = {}) => api.put(url, data, config);
export const patch = (url, data = {}, config = {}) => api.patch(url, data, config);
export const del = (url, config = {}) => api.delete(url, config);

export default { get, post, put, del, patch };