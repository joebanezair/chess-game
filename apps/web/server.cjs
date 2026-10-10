// Development-only same-origin reverse proxy for API and Socket.IO.
// Avoids browser localhost:4000 errors and cross-host session cookies in Codespaces.
const http = require('node:http');
const next = require('next');
const { createProxyServer } = require('http-proxy');

const port = Number(process.env.PORT || 3000);
const hostname = '0.0.0.0';
const apiTarget = process.env.INTERNAL_API_URL || 'http://127.0.0.1:4000';
const app = next({ dev: true, hostname, port, dir: __dirname });
const handle = app.getRequestHandler();
const proxy = createProxyServer({
  target: apiTarget, ws: true, xfwd: true, changeOrigin: false,
  timeout: 10000, proxyTimeout: 10000,
});
proxy.on('error', (err, req, res) => {
  console.error('[crown/proxy] API connection failed:', err.message);
  if (res && typeof res.writeHead === 'function') {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    if (!res.writableEnded) res.end(JSON.stringify({
      statusCode: 502,
      message: 'The game API is offline. Start the backend with npm run dev -w @crown/api, then reload.',
    }));
  } else if (res && typeof res.destroy === 'function') {
    res.destroy();
  }
});

function originMatchesHost(req) {
  if (!req.headers.origin) return true;
  try {
    return new URL(req.headers.origin).host === req.headers.host;
  } catch { return false; }
}

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    const path = new URL(req.url || '/', 'http://localhost').pathname;
    if (path === '/api' || path.startsWith('/api/')) {
      if (!originMatchesHost(req)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ statusCode: 403, message: 'Request origin does not match the game site' }));
        return;
      }
      // The API's admin guard validates the frontend origin. Verify the real
      // browser origin before normalizing it for the local backend.
      if (req.headers.origin) req.headers.origin = process.env.INTERNAL_WEB_ORIGIN || 'http://localhost:3000';
      req.url = req.url.replace(/^\/api(?=\/|\?|$)/, '') || '/';
      proxy.web(req, res);
      return;
    }
    if (path === '/socket.io' || path.startsWith('/socket.io/')) {
      if (!originMatchesHost(req)) {
        res.writeHead(403).end();
        return;
      }
      proxy.web(req, res);
      return;
    }
    handle(req, res);
  });
  server.on('upgrade', (req, socket, head) => {
    const path = new URL(req.url || '/', 'http://localhost').pathname;
    if (path !== '/socket.io' && !path.startsWith('/socket.io/')) return;
    if (!originMatchesHost(req)) { socket.destroy(); return; }
    proxy.ws(req, socket, head);
  });
  server.listen(port, hostname, () => {
    console.log('[crown] Frontend http://localhost:' + port);
    console.log('[crown] API and live games are available at the same frontend origin');
    console.log('[crown] Proxied backend: ' + apiTarget);
  });
}).catch((error) => { console.error(error); process.exit(1); });
