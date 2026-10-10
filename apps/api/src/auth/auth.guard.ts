import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';

export type AuthRequest = FastifyRequest & { userId: string };
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const id = await this.auth.verifySession(request.cookies?.crown_session);
    if (!id || !(await this.auth.me(id))) throw new UnauthorizedException('Please log in');
    request.userId = id;
    return true;
  }
}
