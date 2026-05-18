const DEFAULT_SERVER_PORT =
  (typeof process !== 'undefined' && process.env?.REACT_APP_SERVER_PORT) || '7778';
const LOCAL_STORAGE_SERVER_URI_KEY = 'poker_server_uri';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

const normalizeHostname = (hostname = '') =>
  String(hostname).trim().toLowerCase().replace(/^\[|\]$/g, '');

const isLoopbackHost = (hostname) => LOOPBACK_HOSTS.has(normalizeHostname(hostname));

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

const shouldUseCurrentOrigin = (value) => {
  if (typeof window === 'undefined' || !value) return false;

  try {
    const configured = new URL(value);
    const current = new URL(window.location.origin);
    const currentIsLocal = isLoopbackHost(current.hostname);

    return (
      !currentIsLocal && (
        isLoopbackHost(configured.hostname) ||
        (
          configured.hostname === current.hostname &&
          Boolean(current.port) &&
          !configured.port &&
          configured.origin !== current.origin
        )
      )
    );
  } catch (err) {
    return false;
  }
};

const alignWithCurrentOrigin = (value) => {
  const normalized = normalizeBaseUrl(value);
  if (!shouldUseCurrentOrigin(normalized)) {
    return normalized;
  }

  try {
    const configured = new URL(normalized);
    const current = new URL(window.location.origin);

    if (isLoopbackHost(configured.hostname) && !isLoopbackHost(current.hostname)) {
      configured.hostname = current.hostname;
      configured.port = configured.port || DEFAULT_SERVER_PORT;
      return normalizeBaseUrl(configured.toString());
    }

    return normalizeBaseUrl(`${window.location.origin}${configured.pathname}`);
  } catch (err) {
    return normalizeBaseUrl(window.location.origin);
  }
};

const getStoredServerUri = () => {
  if (typeof window === 'undefined') return '';
  try {
    const stored = window.localStorage.getItem(LOCAL_STORAGE_SERVER_URI_KEY) || '';
    const normalized = alignWithCurrentOrigin(stored);
    if (stored && normalized !== normalizeBaseUrl(stored)) {
      window.localStorage.setItem(LOCAL_STORAGE_SERVER_URI_KEY, normalized);
    }
    return normalized;
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

  const normalized = alignWithCurrentOrigin(fromQuery);
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

export const getServerBaseUrl = () => {
  const url = alignWithCurrentOrigin(
    getRuntimeServerUri() ||
      getEnvVar('REACT_APP_SERVER_URI') ||
      getEnvVar('REACT_APP_SERVER_URL') ||
      getFallbackServerUri()
  );

  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    console.log('[serverConfig] Server base URL resolved:', url);
    console.log('  - runtimeUri:', getRuntimeServerUri());
    console.log('  - env SERVER_URI:', getEnvVar('REACT_APP_SERVER_URI'));
    console.log('  - env SERVER_URL:', getEnvVar('REACT_APP_SERVER_URL'));
    console.log('  - fallback:', getFallbackServerUri());
  }

  return url;
};

export const getSocketBaseUrl = () =>
  alignWithCurrentOrigin(getEnvVar('REACT_APP_SOCKET_URI') || getServerBaseUrl());

export const buildApiUrl = (path = '') => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getServerBaseUrl()}${normalizedPath}`;
};

export const getServerConfigDebug = () => ({
  apiBaseUrl: getServerBaseUrl(),
  socketBaseUrl: getSocketBaseUrl(),
});
