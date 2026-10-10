import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { randomBytes } from 'node:crypto';
import { io } from 'socket.io-client';

const base = 'http://127.0.0.1:3000';
const processes = [];
let logs = '';
function start(path) {
  const processRef = spawn(process.execPath, [path], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...(path.includes('apps/api') ? { PORT: '4000' } : { PORT: '3000' }),
    },
    stdio: ['ignore','pipe','pipe'],
  });
  processes.push(processRef);
  processRef.stdout.on('data', (data) => { logs += String(data).slice(-1500); });
  processRef.stderr.on('data', (data) => { logs += String(data).slice(-1500); });
  return processRef;
}
async function ready(url) {
  for (let i=0; i<110; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (res.ok) return res;
    } catch {}
    await sleep(300);
  }
  throw new Error('Server not ready at ' + url + '\n' + logs.slice(-4000));
}
try {
  start('apps/api/dist/main.js');
  await ready('http://127.0.0.1:4000/health');
  start('apps/web/server.cjs');
  const health = await ready(base + '/api/health');
  assert.deepEqual(await health.json(), { ok: true });

  const name = 'proxy' + randomBytes(4).toString('hex');
  const response = await fetch(base + '/api/auth/register', {
    method: 'POST',
    headers: { Origin: base, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: name, email: name + '@example.com', password: 'SecurePassword123!' }),
  });
  const result = await response.json();
  assert.equal(response.status, 201, JSON.stringify(result));
  assert.equal(result.user.username, name);
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie?.startsWith('crown_session='), 'Proxy should preserve session cookie');
  const mine = await fetch(base + '/api/auth/me', { headers: { Cookie: cookie } });
  assert.equal(mine.status, 200);
  assert.equal((await mine.json()).user.id, result.user.id);

  const socket = io(base, {
    transports: ['websocket'], reconnection: false, timeout: 12000,
    extraHeaders: { Cookie: cookie, Origin: base },
  });
  try {
    await new Promise((resolve,reject) => {
      const timer = setTimeout(() => reject(new Error('Same-origin WebSocket session-ready timeout')), 12000);
      socket.once('session:ready', () => { clearTimeout(timer); resolve(); });
      socket.once('connect_error', (error) => { clearTimeout(timer); reject(error); });
    });
    console.log('PASS: same-origin /api/health, account registration, session cookie and Socket.IO proxy');
  } finally { socket.disconnect(); }
} catch(error) {
  console.error(error);
  console.error(logs.slice(-6000));
  process.exitCode = 1;
} finally {
  for(const proc of processes)proc.kill('SIGTERM');
}
