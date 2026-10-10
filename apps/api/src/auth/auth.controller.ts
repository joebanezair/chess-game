import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthGuard, type AuthRequest } from './auth.guard';
import { AuthService } from './auth.service';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
};

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  async register(@Body() body: unknown, @Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.auth.throttle('auth:register:' + request.ip, 5, 3600);
    const user = await this.auth.register(body);
    reply.setCookie('crown_session', this.auth.issueSession(user.id, user.sessionVersion), cookieOptions);
    return { user };
  }

  @Post('login')
  async login(@Body() body: unknown, @Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.auth.throttle('auth:login:' + request.ip, 20, 600);
    const user = await this.auth.login(body);
    reply.setCookie('crown_session', this.auth.issueSession(user.id, user.sessionVersion), cookieOptions);
    return { user };
  }

  @UseGuards(AuthGuard)
  @Get('me')
  async me(@Req() request: AuthRequest) {
    return { user: await this.auth.me(request.userId) };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) reply: FastifyReply) {
    reply.clearCookie('crown_session', { path: '/' });
    return { ok: true };
  }
}
