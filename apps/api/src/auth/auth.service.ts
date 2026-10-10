import { ConflictException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { RedisService } from '../redis.service';
import { compare, hash } from 'bcryptjs';
import { z } from 'zod';

export const registrationSchema = z.object({
  username: z.string().trim().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  email: z.email().max(254),
  password: z.string().min(8).max(72),
});
export const loginSchema = z.object({
  identifier: z.string().trim().min(3),
  password: z.string().min(1),
});

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService, private redis: RedisService) {}

  async throttle(key: string, limit: number, seconds: number) {
    const count = await this.redis.client.incr(key);
    if (count === 1) await this.redis.client.expire(key, seconds);
    if (count > limit) throw new HttpException('Too many attempts. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }

  async register(input: unknown) {
    const { username, email, password } = registrationSchema.parse(input);
    try {
      const user = await this.prisma.user.create({
        data: { username: username.toLowerCase(), email: email.toLowerCase(), passwordHash: await hash(password, 12) },
      });
      return { id: user.id, username: user.username, email: user.email };
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Username or email is already registered');
      throw error;
    }
  }

  async login(input: unknown) {
    const { identifier, password } = loginSchema.parse(input);
    const name = identifier.toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: name }, { username: name }] },
    });
    if (!user || !(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Incorrect username/email or password');
    }
    return { id: user.id, username: user.username, email: user.email };
  }

  issueSession(userId: string): string { return this.jwt.sign({ sub: userId }); }

  async verifySession(token?: string): Promise<string | null> {
    if (!token) return null;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      return typeof payload.sub === 'string' ? payload.sub : null;
    } catch { return null; }
  }

  async me(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: { id: true, username: true, email: true } });
  }
}
