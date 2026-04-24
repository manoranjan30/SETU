import axios from "axios";
import { apiBaseUrl } from "./baseUrl";

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000, // Increased timeout for PDF processing
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
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
