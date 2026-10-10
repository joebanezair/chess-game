import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { randomBytes } from 'node:crypto';
import { io } from 'socket.io-client';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Verify the actual shared frontend API helper; the bug was caused by its
// default JSON header, not by the NestJS game endpoints.
async function verifyBrowserApiHelper() {
  const source = readFileSync(new URL('../apps/web/src/lib/api.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const requests = [];
  const exports = {};
  runInNewContext(output, {
    exports, process: { env: { NEXT_PUBLIC_API_URL: '/api' } }, Headers,
    fetch: async (url, init) => {
      requests.push({ url, init });
      return { ok: true, json: async () => ({ ok: true }) };
    },
  });
  for (const path of ['/games', '/games/friend-game/join', '/games/friend-game/resign', '/auth/logout']) {
    await exports.api(path, { method: 'POST' });
  }
  for (const req of requests) {
    assert.equal(new Headers(req.init.headers).has('content-type'), false,
      'Bodyless ' + req.url + ' must not send a JSON content type');
    assert.equal(req.init.body, undefined);
  }
  await exports.api('/auth/login', {
    method: 'POST', body: JSON.stringify({ identifier: 'test', password: 'testpass123' }),
  });
  assert.equal(new Headers(requests.at(-1).init.headers).get('content-type'), 'application/json');
  await exports.api('/games', { headers: { Accept: 'application/json' } });
  assert.equal(new Headers(requests.at(-1).init.headers).has('content-type'), false);
  console.log('PASS: shared frontend API helper uses JSON content type only with a body');
}

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
  await verifyBrowserApiHelper();
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

  // Reproduce the two-friend flow via the same-origin proxy, including
  // three bodyless POSTs; users must be able to create, accept, and resign.
  const otherName = 'buddy' + randomBytes(4).toString('hex');
  const registeredFriend = await fetch(base + '/api/auth/register', {
    method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: otherName, email: otherName + '@example.com', password: 'SecurePassword123!',
    }),
  });
  assert.equal(registeredFriend.status, 201, await registeredFriend.clone().text());
  const friendCookie = registeredFriend.headers.get('set-cookie')?.split(';')[0];
  assert.ok(friendCookie, 'Friend must receive a session cookie');

  const makeRoom = await fetch(base + '/api/games', {
    method: 'POST', headers: { Origin: base, Cookie: cookie },
  });
  assert.equal(makeRoom.status, 201, await makeRoom.clone().text());
  const { id: gameId } = await makeRoom.json();
  assert.ok(gameId);

  const join = await fetch(base + '/api/games/' + encodeURIComponent(gameId) + '/join', {
    method: 'POST', headers: { Origin: base, Cookie: friendCookie },
  });
  assert.equal(join.status, 201, await join.clone().text());
  const active = await fetch(base + '/api/games/' + encodeURIComponent(gameId), {
    headers: { Cookie: cookie },
  });
  assert.equal(active.status, 200);
  const activeGame = await active.json();
  assert.equal(activeGame.status, 'ACTIVE');
  assert.equal(activeGame.black.username, otherName);

  const resign = await fetch(base + '/api/games/' + encodeURIComponent(gameId) + '/resign', {
    method: 'POST', headers: { Origin: base, Cookie: friendCookie },
  });
  assert.equal(resign.status, 201, await resign.clone().text());
  const finished = await fetch(base + '/api/games/' + encodeURIComponent(gameId), {
    headers: { Cookie: cookie },
  });
  assert.equal((await finished.json()).status, 'FINISHED');

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
    console.log('PASS: same-origin /api/health, two-player private invite creation/join/resign, session cookies, Socket.IO');
  } finally { socket.disconnect(); }
} catch(error) {
  console.error(error);
  console.error(logs.slice(-6000));
  process.exitCode = 1;
} finally {
  for(const proc of processes)proc.kill('SIGTERM');
}
