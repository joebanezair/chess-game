import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });

  async onModuleDestroy() { await this.client.quit(); }

  async withLock<T>(key: string, action: () => Promise<T>): Promise<T> {
    const token = randomUUID();
    const acquired = await this.client.set(key, token, 'PX', 10000, 'NX');
    if (!acquired) throw new Error('Matchmaking is busy; please try again.');
    try { return await action(); }
    finally {
      await this.client.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        1, key, token,
      );
    }
  }
}
