import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { INestApplicationContext } from '@nestjs/common';
import Redis from 'ioredis';
import type { ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  private pubClient?: Redis;
  private subClient?: Redis;
  constructor(app: INestApplicationContext) { super(app); }
  async connectToRedis() {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    this.pubClient = new Redis(url);
    this.subClient = this.pubClient.duplicate();
    await Promise.all([
      new Promise<void>((resolve, reject) => this.pubClient!.once('ready', resolve).once('error', reject)),
      new Promise<void>((resolve, reject) => this.subClient!.once('ready', resolve).once('error', reject)),
    ]);
    this.adapterConstructor = createAdapter(this.pubClient, this.subClient);
  }
  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) server.adapter(this.adapterConstructor);
    return server;
  }
}
