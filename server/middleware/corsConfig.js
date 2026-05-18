const LOCAL_ORIGIN_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function getConfiguredOrigins() {
  return new Set(
    (process.env.CORS_ORIGINS || '')
      .split(',')
      .map(origin => origin.trim())
      .filter(Boolean),
  );
}

function splitList(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function extractHostname(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  try {
    return new URL(raw.includes('://') ? raw : `http://${raw}`).hostname;
  } catch (err) {
    return raw.split(':')[0] || null;
  }
}

// Get the server's own hostname from runtime env.
// SERVER_HOST/PUBLIC_HOST are intentionally runtime-only so shared config files
// can be reused on different deployed machines without hardcoding one IP.
function getServerHostnames() {
  const hostnames = [
    ...splitList(process.env.SERVER_HOSTNAME),
    ...splitList(process.env.SERVER_HOST),
    ...splitList(process.env.PUBLIC_HOST),
  ].map(extractHostname).filter(Boolean);

  if (process.env.ALLOWED_ORIGINS) {
    hostnames.push(...process.env.ALLOWED_ORIGINS.split(',').map(o => {
      try { return new URL(o.trim()).hostname; } catch { return null; }
    }).filter(Boolean));
  }

  return [...new Set(hostnames.map(h => h.toLowerCase()))];
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

    // Only allow Cloudflare Tunnel origins when explicitly configured
    const allowedTunnelHosts = process.env.CORS_TUNNEL_HOSTS || '';
    if (allowedTunnelHosts && normalizedHost.endsWith('.trycloudflare.com')) {
      const allowedList = allowedTunnelHosts.split(',').map(h => h.trim().toLowerCase());
      if (allowedList.includes(normalizedHost) || allowedList.includes('*')) {
        return true;
      }
    }

    // Allow requests from the server's own public IP / hostname
    // This supports production deployments where frontend and backend are on the same server
    const serverHosts = getServerHostnames();
    if (serverHosts.length > 0 && serverHosts.includes(normalizedHost)) {
      return true;
    }

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
