import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { io } from 'socket.io-client';

const base = 'http://localhost:4000';
const suffix = Date.now().toString(36) + randomBytes(3).toString('hex');
const backend = spawn(process.execPath, ['apps/api/dist/main.js'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: '4000' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOutput = '';
backend.stdout.on('data', (data) => { serverOutput += String(data).slice(-3000); });
backend.stderr.on('data', (data) => { serverOutput += String(data).slice(-3000); });
const sockets = [];

async function request(path, { method = 'GET', cookie, body } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(method + ' ' + path + ' failed: ' + JSON.stringify(json));
  return { body: json, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

async function register(label) {
  const username = label + suffix;
  const response = await request('/auth/register', {
    method: 'POST', body: { username, email: username + '@example.com', password: 'CrownDemoPassword123!' },
  });
  assert.ok(response.body.user.id);
  assert.ok(response.cookie?.startsWith('crown_session='));
  return { user: response.body.user, cookie: response.cookie };
}

async function connect(session) {
  const socket = io(base, { transports: ['websocket'], reconnection: false, extraHeaders: { Cookie: session.cookie } });
  sockets.push(socket);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WebSocket connect timed out')), 8000);
    socket.once('connect', () => { clearTimeout(timer); resolve(); });
    socket.once('connect_error', (error) => { clearTimeout(timer); reject(error); });
  });
  return socket;
}

async function event(socket, name, timeoutMs = 7000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(name, onEvent); reject(new Error(name + ' timed out')); }, timeoutMs);
    function onEvent(value) { clearTimeout(timer); resolve(value); }
    socket.once(name, onEvent);
  });
}

try {
  let ready = false;
  for (let i = 0; i < 45; i++) {
    if (backend.exitCode !== null) throw new Error('API exited unexpectedly: ' + serverOutput);
    try {
      const response = await fetch(base + '/health');
      if (response.ok) { ready = true; break; }
    } catch {}
    await delay(300);
  }
  assert.ok(ready, 'API did not start: ' + serverOutput);

  const a = await register('ra');
  const b = await register('rb');
  const created = await request('/games', { method: 'POST', cookie: a.cookie });
  const gameId = created.body.id;
  assert.ok(gameId);
  const pending = await request('/games/' + gameId, { cookie: a.cookie });
  assert.equal(pending.body.status, 'WAITING');
  await request('/games/' + gameId + '/join', { method: 'POST', cookie: b.cookie });
  const state = (await request('/games/' + gameId, { cookie: a.cookie })).body;
  assert.equal(state.status, 'ACTIVE');
  assert.equal(state.legalMoves.length, 7);
  const aSocket = await connect(a);
  const bSocket = await connect(b);
  const nextState = event(bSocket, 'game:state');
  const first = state.legalMoves[0];
  aSocket.emit('game:move', { gameId, from: first.from, to: first.to });
  const updated = await nextState;
  assert.equal(updated.id, gameId);
  assert.equal(updated.version, 2); // accepting a challenge increments version once
  assert.equal(updated.turn, 'BLACK');
  assert.equal(updated.board[first.from], null);
  assert.equal(updated.board[first.to]?.toLowerCase(), 'r');
  const history = (await request('/games', { cookie: b.cookie })).body;
  assert.equal(history[0].id, gameId);

  const c = await register('rc');
  const d = await register('rd');
  const cSocket = await connect(c);
  const dSocket = await connect(d);
  const waiting = event(cSocket, 'queue:waiting');
  cSocket.emit('queue:join');
  await waiting;
  const matched = event(cSocket, 'queue:matched');
  dSocket.emit('queue:join');
  const pairing = await matched;
  assert.ok(pairing.gameId);
  const matchedGame = (await request('/games/' + pairing.gameId, { cookie: c.cookie })).body;
  assert.equal(matchedGame.status, 'ACTIVE');
  assert.equal(matchedGame.black.id, d.user.id);
  console.log('PASS: registration, challenge acceptance, live WebSocket move, history, Redis matchmaking');
} catch (error) {
  console.error(error);
  console.error('API output:', serverOutput);
  process.exitCode = 1;
} finally {
  for (const socket of sockets) socket.disconnect();
  backend.kill('SIGTERM');
}
