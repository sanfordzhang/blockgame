const DEFAULT_SERVER_PORT =
  (typeof process !== 'undefined' && process.env?.REACT_APP_SERVER_PORT) || '7778';
const LOCAL_STORAGE_SERVER_URI_KEY = 'poker_server_uri';

const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

const withProtocol = (value) => {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) {
    const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
    return `${protocol}${value}`;
  }
  return `http://${value}`;
};

const normalizeBaseUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const candidate = trimTrailingSlash(withProtocol(raw));
  try {
    const parsed = new URL(candidate);
    return trimTrailingSlash(`${parsed.protocol}//${parsed.host}${parsed.pathname}`);
  } catch (err) {
    return candidate;
  }
};

const getEnvVar = (name) => {
  if (typeof process !== 'undefined' && process.env?.[name]) {
    return process.env[name];
  }
  return '';
};

const getStoredServerUri = () => {
  if (typeof window === 'undefined') return '';
  try {
    return normalizeBaseUrl(window.localStorage.getItem(LOCAL_STORAGE_SERVER_URI_KEY) || '');
  } catch (err) {
    return '';
  }
};

const getRuntimeServerUri = () => {
  if (typeof window === 'undefined') return '';

  const params = new URLSearchParams(window.location.search);
  const fromQuery =
    params.get('serverUri') ||
    params.get('server') ||
    params.get('socketServer');

  if (!fromQuery) {
    return getStoredServerUri();
  }

  const normalized = normalizeBaseUrl(fromQuery);
  if (!normalized) {
    return getStoredServerUri();
  }

  try {
    window.localStorage.setItem(LOCAL_STORAGE_SERVER_URI_KEY, normalized);
  } catch (err) {
    // Ignore storage failures and still use the explicit query-string override.
  }

  return normalized;
};

const getFallbackServerUri = () => {
  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:${DEFAULT_SERVER_PORT}`;
  }
  return `http://localhost:${DEFAULT_SERVER_PORT}`;
};

export const getServerBaseUrl = () =>
  normalizeBaseUrl(
    getRuntimeServerUri() ||
      getEnvVar('REACT_APP_SERVER_URI') ||
      getEnvVar('REACT_APP_SERVER_URL') ||
      getFallbackServerUri()
  );

export const getSocketBaseUrl = () =>
  normalizeBaseUrl(getEnvVar('REACT_APP_SOCKET_URI') || getServerBaseUrl());

export const buildApiUrl = (path = '') => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getServerBaseUrl()}${normalizedPath}`;
};

export const getServerConfigDebug = () => ({
  apiBaseUrl: getServerBaseUrl(),
  socketBaseUrl: getSocketBaseUrl(),
});
