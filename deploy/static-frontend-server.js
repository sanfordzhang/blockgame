const express = require('express');
const httpProxy = require('http-proxy');
const fs = require('fs');
const path = require('path');

const app = express();
const port = Number(process.env.FRONTEND_PORT || process.env.PORT || 3001);
const buildDir = process.env.BUILD_DIR || path.join(__dirname, '..', 'build-testnet');
const backendTarget = process.env.BACKEND_TARGET || 'http://127.0.0.1:7778';
const proxy = httpProxy.createProxyServer({ changeOrigin: true, ws: true });
const staticAssetPattern = /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|map|json)$/i;

proxy.on('error', (err, req, res) => {
  console.error(`[static-frontend] Proxy error for ${req?.url || 'unknown'}:`, err.message);
  if (res && !res.headersSent) {
    res.statusCode = 502;
    res.end('Bad gateway');
  }
});

app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('Connection', 'close');
  next();
});

app.use('/api', (req, res) => proxy.web(req, res, { target: backendTarget + '/api' }));
app.use('/socket.io', (req, res) => proxy.web(req, res, { target: backendTarget + '/socket.io' }));

app.get('/service-worker.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.type('application/javascript');
  res.send(`
self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    if (self.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    }
    await self.clients.claim();
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => client.navigate(client.url));
  })());
});
`);
});

app.get(/\.(js|css|json|map|svg)$/, (req, res, next) => {
  const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  if (!acceptsGzip) return next();

  const normalizedPath = path.normalize(decodeURIComponent(req.path)).replace(/^(\.\.[/\\])+/, '');
  const sourcePath = path.join(buildDir, normalizedPath);
  const gzipPath = `${sourcePath}.gz`;
  if (!gzipPath.startsWith(buildDir) || !fs.existsSync(gzipPath)) return next();

  res.setHeader('Content-Encoding', 'gzip');
  res.setHeader('Vary', 'Accept-Encoding');
  res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
  if (sourcePath.endsWith('.js')) {
    res.type('application/javascript');
  } else if (sourcePath.endsWith('.css')) {
    res.type('text/css');
  } else if (sourcePath.endsWith('.json') || sourcePath.endsWith('.map')) {
    res.type('application/json');
  } else if (sourcePath.endsWith('.svg')) {
    res.type('image/svg+xml');
  }
  res.sendFile(gzipPath);
});

app.use(express.static(buildDir, {
  etag: true,
  maxAge: '30d',
  immutable: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html') || filePath.endsWith('service-worker.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

app.get(staticAssetPattern, (req, res) => {
  res.status(404).type('text/plain').send('Static asset not found');
});

app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(buildDir, 'index.html'));
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`[static-frontend] Serving ${buildDir} on :${port}, proxying API/socket to ${backendTarget}`);
});

server.on('upgrade', (req, socket, head) => {
  if (req.url && req.url.startsWith('/socket.io')) {
    proxy.ws(req, socket, head, { target: backendTarget + '/socket.io' });
    return;
  }
  socket.destroy();
});
