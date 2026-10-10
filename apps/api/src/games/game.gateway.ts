import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as cookie from 'cookie';
import { AuthService } from '../auth/auth.service';
import { GamesService } from './games.service';
import { RedisService } from '../redis.service';

type GameSocket = Socket & { data: { userId?: string; sessionToken?: string } };

@WebSocketGateway({
  transports: ['websocket'],
  cors: { origin: process.env.WEB_ORIGIN || 'http://localhost:3000', credentials: true },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  constructor(private auth: AuthService, private games: GamesService, private redis: RedisService) {}

  private async user(socket: GameSocket): Promise<string> {
    const id = socket.data.userId;
    if (!id || !(await this.auth.verifySession(socket.data.sessionToken))) {
      socket.emit('account:disabled', { message: 'Your session is no longer valid or your account is disabled.' });
      socket.disconnect(true);
      throw new Error('Your session is no longer valid or your account is disabled.');
    }
    return id;
  }
  private error(socket: GameSocket, error: unknown) {
    const message = error instanceof Error ? error.message : 'Something went wrong';
    socket.emit('game:error', { message });
  }
  async handleConnection(socket: GameSocket) {
    const rawCookie = socket.handshake.headers.cookie || '';
    const session = cookie.parse(rawCookie).crown_session;
    const userId = await this.auth.verifySession(session);
    if (!userId || !(await this.auth.me(userId))) { socket.disconnect(true); return; }
    socket.data.userId = userId;
    socket.data.sessionToken = session;
    socket.join('user:' + userId);
    await this.redis.client.set('online:' + userId, '1', 'EX', 60);
    socket.emit('session:ready', { userId });
  }
  handleDisconnect(_socket: GameSocket) {
    // Presence expires automatically. Multiple tabs/devices may still be online.
  }

  @SubscribeMessage('presence:ping')
  async ping(@ConnectedSocket() socket: GameSocket) {
    try { await this.redis.client.set('online:' + await this.user(socket), '1', 'EX', 60); }
    catch (error) { this.error(socket, error); }
  }

  @SubscribeMessage('queue:join')
  async joinQueue(@ConnectedSocket() socket: GameSocket) {
    try {
      const me = await this.user(socket);
      const match = await this.redis.withLock('lock:matchmaking', async () => {
        const redis = this.redis.client;
        await redis.set('online:' + me, '1', 'EX', 60);
        await redis.zrem('queue:checkers', me);
        const queued = await redis.zrange('queue:checkers', 0, 100);
        for (const opponent of queued) {
          if (opponent === me) continue;
          const online = await redis.exists('online:' + opponent);
          if (!online || !(await this.auth.activeUser(opponent))) {
            await redis.zrem('queue:checkers', opponent); continue;
          }
          const game = await this.games.startMatch(opponent, me);
          await redis.zrem('queue:checkers', opponent, me);
          return { gameId: game.id, opponent };
        }
        await redis.zadd('queue:checkers', 'NX', Date.now(), me);
        return null;
      });
      if (match) {
        this.server.to('user:' + me).to('user:' + match.opponent).emit('queue:matched', { gameId: match.gameId });
      } else socket.emit('queue:waiting');
    } catch (error) { this.error(socket, error); }
  }

  @SubscribeMessage('queue:leave')
  async leaveQueue(@ConnectedSocket() socket: GameSocket) {
    try {
      await this.redis.client.zrem('queue:checkers', await this.user(socket));
      socket.emit('queue:left');
    } catch (error) { this.error(socket, error); }
  }

  @SubscribeMessage('game:join')
  async joinGame(@ConnectedSocket() socket: GameSocket, @MessageBody() body: { gameId?: string }) {
    try {
      if (typeof body?.gameId !== 'string') throw new Error('Game ID required');
      const snapshot = await this.games.snapshot(body.gameId, await this.user(socket));
      if (!snapshot.meColor) throw new Error('Join the challenge to play');
      await socket.join('game:' + body.gameId);
      socket.emit('game:state', snapshot);
    } catch (error) { this.error(socket, error); }
  }

  @SubscribeMessage('game:move')
  async move(@ConnectedSocket() socket: GameSocket, @MessageBody() body: { gameId?: string; from?: number; to?: number }) {
    try {
      if (typeof body?.gameId !== 'string' || typeof body.from !== 'number' || typeof body.to !== 'number') {
        throw new Error('Invalid move data');
      }
      await this.games.move(body.gameId, await this.user(socket), body.from, body.to);
      await this.publishState(body.gameId);
    } catch (error) { this.error(socket, error); }
  }

  async disconnectAccount(userId: string) {
    await this.redis.client.zrem('queue:checkers', userId);
    await this.redis.client.del('online:' + userId);
    this.server.in('user:' + userId).emit('account:disabled', {
      message: 'Your account has been disabled by an administrator.',
    });
    this.server.in('user:' + userId).disconnectSockets(true);
  }

  async publishState(gameId: string) {
    const ids = await this.games.playerIds(gameId);
    await Promise.all(ids.map(async (id) => {
      const snapshot = await this.games.snapshot(gameId, id);
      this.server.to('user:' + id).emit('game:state', snapshot);
    }));
  }
}
