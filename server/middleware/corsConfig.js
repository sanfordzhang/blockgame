const LOCAL_ORIGIN_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function getConfiguredOrigins() {
  return new Set(
    (process.env.CORS_ORIGINS || '')
      .split(',')
      .map(origin => origin.trim())
      .filter(Boolean),
  );
}

function isPrivateNetworkHost(hostname) {
  if (!hostname) return false;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;

  const match = hostname.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (!match) return false;

  const secondOctet = Number(match[1]);
  return secondOctet >= 16 && secondOctet <= 31;
}

function isAllowedOrigin(origin) {
  if (!origin) return true;

  const configuredOrigins = getConfiguredOrigins();
  if (configuredOrigins.has('*') || configuredOrigins.has(origin)) {
    return true;
  }

  try {
    const { hostname } = new URL(origin);
    const normalizedHost = hostname.toLowerCase();

    if (LOCAL_ORIGIN_HOSTS.has(normalizedHost)) return true;
    if (isPrivateNetworkHost(normalizedHost)) return true;
    if (normalizedHost.endsWith('.trycloudflare.com')) return true;

    return false;
  } catch (error) {
    return false;
  }
}

function validateOrigin(origin, callback) {
  if (isAllowedOrigin(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error(`CORS not allowed for origin: ${origin}`), false);
}

const corsOptions = {
  origin: validateOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-wallet-address'],
};

const socketCorsOptions = {
  origin: validateOrigin,
  methods: ['GET', 'POST'],
  credentials: true,
};

module.exports = {
  corsOptions,
  isAllowedOrigin,
  socketCorsOptions,
};
