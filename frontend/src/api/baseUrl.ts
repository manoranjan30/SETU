const rawApiUrl = (import.meta.env.VITE_API_URL || "").trim();

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const ensureApiSuffix = (value: string) => {
  const normalized = trimTrailingSlash(value);
  return /\/api$/i.test(normalized) ? normalized : `${normalized}/api`;
};

const stripApiSuffix = (value: string) =>
  trimTrailingSlash(value).replace(/\/api$/i, "");

export const apiBaseUrl = rawApiUrl ? ensureApiSuffix(rawApiUrl) : "/api";

export const getPublicOrigin = () => {
  if (!rawApiUrl) {
    return typeof window !== "undefined" ? window.location.origin : "";
  }

  if (/^https?:\/\//i.test(rawApiUrl)) {
    return stripApiSuffix(rawApiUrl);
  }

  return stripApiSuffix(rawApiUrl);
};

export const getPublicFileUrl = (path: string) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const origin = getPublicOrigin();

  return origin ? `${origin}${normalizedPath}` : normalizedPath;
};
