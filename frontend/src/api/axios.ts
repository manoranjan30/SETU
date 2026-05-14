import axios from "axios";
import { apiBaseUrl } from "./baseUrl";

let activeGlobalLoaderRequests = 0;

const dispatchLoaderEvent = (
  eventName:
    | "setu-api-loading-start"
    | "setu-api-loading-stop",
) => {
  window.dispatchEvent(new CustomEvent(eventName));
};

const shouldTrackGlobalLoader = (config: {
  headers?: Record<string, unknown>;
}) => {
  return config.headers?.["X-Setu-Silent-Loader"] !== "true";
};

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 120000, // Heavy project screens like schedule/WO/BOQ can legitimately take longer
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (shouldTrackGlobalLoader(config)) {
    activeGlobalLoaderRequests += 1;
    dispatchLoaderEvent("setu-api-loading-start");
    (config as typeof config & { __setuTrackGlobalLoader?: boolean }).__setuTrackGlobalLoader =
      true;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (
      (response.config as typeof response.config & {
        __setuTrackGlobalLoader?: boolean;
      }).__setuTrackGlobalLoader
    ) {
      activeGlobalLoaderRequests = Math.max(0, activeGlobalLoaderRequests - 1);
      dispatchLoaderEvent("setu-api-loading-stop");
    }

    return response;
  },
  (error) => {
    if (
      (error.config as
        | (typeof error.config & { __setuTrackGlobalLoader?: boolean })
        | undefined)?.__setuTrackGlobalLoader
    ) {
      activeGlobalLoaderRequests = Math.max(0, activeGlobalLoaderRequests - 1);
      dispatchLoaderEvent("setu-api-loading-stop");
    }

    if (error.response && error.response.status === 401) {
      // Prevent redirect loop if the 401 comes from the login endpoint itself
      if (!error.config.url?.includes("/auth/login")) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

export default api;
