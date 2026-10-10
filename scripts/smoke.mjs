import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { io } from 'socket.io-client';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

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
    headers: { Origin: 'http://localhost:3000', ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
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
    const timer = setTimeout(() => reject(new Error('WebSocket session-ready timed out')), 12000);
    socket.once('session:ready', () => { clearTimeout(timer); resolve(); });
    socket.once('connect_error', (error) => { clearTimeout(timer); reject(error); });
    socket.once('disconnect', (reason) => { clearTimeout(timer); reject(new Error('Disconnected before auth: ' + reason)); });
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
  // Wait for the server to authenticate each socket and join the room
  // before emitting the first move; otherwise CI can race connection setup.
  const redReady = event(aSocket, 'game:state', 12000);
  aSocket.emit('game:join', { gameId });
  await redReady;
  const blackReady = event(bSocket, 'game:state', 12000);
  bSocket.emit('game:join', { gameId });
  await blackReady;
  const nextState = event(bSocket, 'game:state', 12000);
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

  // Coins are private to the signed-in user and default to zero.
  const unauthCoins = await fetch(base + '/coins');
  assert.equal(unauthCoins.status, 401);
  assert.equal((await request('/coins', { cookie: a.cookie })).body.balance, 0);
  assert.equal((await request('/coins', { cookie: b.cookie })).body.balance, 0);

  // Arrange a legitimate last-capture victory by a RED piece. Only this
  // server-validated game ending—not a client request—can mint 20 coins.
  const victoryBoard = Array(64).fill(null);
  victoryBoard[42] = 'r'; // RED on a dark square
  victoryBoard[33] = 'b'; // final BLACK piece to be captured
  const rewardGame = await prisma.game.create({
    data: {
      redPlayerId: a.user.id, blackPlayerId: b.user.id,
      status: 'ACTIVE', turn: 'RED', board: victoryBoard,
    },
  });
  const victoryEvent = event(bSocket, 'game:state', 12000);
  aSocket.emit('game:move', { gameId: rewardGame.id, from: 42, to: 24 });
  const victory = await victoryEvent;
  assert.equal(victory.id, rewardGame.id);
  assert.equal(victory.status, 'FINISHED');
  assert.equal(victory.winnerId, a.user.id);
  assert.deepEqual(victory.coinReward, { userId: a.user.id, amount: 20 });
  const winWallet = (await request('/coins', { cookie: a.cookie })).body;
  assert.equal(winWallet.balance, 20);
  assert.equal(winWallet.history[0].gameId, rewardGame.id);
  assert.equal(winWallet.history[0].amount, 20);
  assert.equal((await request('/coins', { cookie: b.cookie })).body.balance, 0);
  // A duplicate client move cannot create a second payout.
  const repeatError = event(aSocket, 'game:error', 12000);
  aSocket.emit('game:move', { gameId: rewardGame.id, from: 42, to: 24 });
  await repeatError;
  assert.equal((await request('/coins', { cookie: a.cookie })).body.balance, 20);
  assert.equal(await prisma.coinEntry.count({ where: { gameId: rewardGame.id } }), 1);

  // A resignation finishes the match but never creates spendable credits.
  const resignedGame = await prisma.game.create({
    data: { redPlayerId: a.user.id, blackPlayerId: b.user.id, status: 'ACTIVE', board: victoryBoard },
  });
  await request('/games/' + resignedGame.id + '/resign', { method: 'POST', cookie: b.cookie });
  assert.equal((await request('/coins', { cookie: a.cookie })).body.balance, 20);
  assert.equal(await prisma.coinEntry.count({ where: { gameId: resignedGame.id } }), 0);

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
  // Only server-side access can promote a registered player to administrator.
  await prisma.user.update({ where: { id: a.user.id }, data: { role: 'ADMIN' } });
  const aAdmin = (await request('/auth/me', { cookie: a.cookie })).body.user;
  assert.equal(aAdmin.role, 'ADMIN');
  const denied = await fetch(base + '/admin/users', { headers: { Cookie: c.cookie } });
  assert.equal(denied.status, 403);
  const listing = await request('/admin/users?search=' + encodeURIComponent(b.user.username), { cookie: a.cookie });
  assert.equal(listing.body.users[0].id, b.user.id);
  assert.ok(!JSON.stringify(listing.body).includes('passwordHash'));

  const adminProtected = await fetch(base + '/admin/users/' + a.user.id + '/status', {
    method: 'PATCH', headers: { Cookie: a.cookie, Origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
    body: JSON.stringify({ disabled: true }),
  });
  assert.equal(adminProtected.status, 403);

  const socketDropped = event(bSocket, 'disconnect');
  await request('/admin/users/' + b.user.id + '/status', {
    method: 'PATCH', cookie: a.cookie, body: { disabled: true, reason: 'Smoke test' },
  });
  await socketDropped;
  const revoked = await fetch(base + '/auth/me', { headers: { Cookie: b.cookie } });
  assert.equal(revoked.status, 401);
  const blockedLogin = await fetch(base + '/auth/login', {
    method: 'POST', headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: b.user.username, password: 'CrownDemoPassword123!' }),
  });
  assert.equal(blockedLogin.status, 403);
  await request('/admin/users/' + b.user.id + '/status', {
    method: 'PATCH', cookie: a.cookie, body: { disabled: false },
  });
  // A re-enabled user must log in again, and old cookies remain revoked.
  assert.equal((await fetch(base + '/auth/me', { headers: { Cookie: b.cookie } })).status, 401);
  const relogin = await request('/auth/login', {
    method: 'POST', body: { identifier: b.user.username, password: 'CrownDemoPassword123!' },
  });
  assert.equal(relogin.body.user.id, b.user.id);
  const actions = await prisma.adminAction.findMany({ where: { targetId: b.user.id } });
  assert.equal(actions.length, 2);
  assert.ok(actions.some((entry) => entry.action === 'DISABLE' && entry.actorId === a.user.id));

  console.log('PASS: auth, private matches, coin rewards and idempotency, admin authorization, disabled sessions, audit log');
} catch (error) {
  console.error(error);
  console.error('API output:', serverOutput);
  process.exitCode = 1;
} finally {
  for (const socket of sockets) socket.disconnect();
  backend.kill('SIGTERM');
  await prisma.$disconnect();
}
