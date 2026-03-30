export function getEnv(name, fallback = undefined) {
  const value = __ENV[name];
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return value;
}

export function getRequiredEnv(name) {
  const value = getEnv(name);
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getNumberEnv(name, fallback = undefined) {
  const raw = getEnv(name, fallback);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw new Error(`Environment variable ${name} must be numeric`);
  }
  return value;
}

export function getJsonEnv(name, fallback = []) {
  const raw = getEnv(name);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Environment variable ${name} is not valid JSON: ${error.message}`);
  }
}

export function buildApiUrl(path) {
  const base = getRequiredEnv('BASE_URL').replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}/api${normalizedPath}`;
}

export function buildRawUrl(path) {
  const base = getRequiredEnv('BASE_URL').replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
