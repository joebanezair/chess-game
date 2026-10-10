import {
  Body, CanActivate, Controller, ExecutionContext, ForbiddenException,
  Get, Injectable, Param, Patch, Query, Req, UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthRequest } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { AdminService } from './admin.service';
import { GameGateway } from '../games/game.gateway';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(private auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const user = await this.auth.me(req.userId);
    if (!user || user.role !== 'ADMIN') throw new ForbiddenException('Admin access required');
    if (req.method !== 'GET') {
      // Cross-origin requests cannot change account status using browser cookies.
      if (req.headers.origin !== (process.env.WEB_ORIGIN || 'http://localhost:3000')) {
        throw new ForbiddenException('Invalid request origin');
      }
    }
    return true;
  }
}

@UseGuards(AuthGuard, AdminRoleGuard)
@Controller('admin')
export class AdminController {
  constructor(private admin: AdminService, private games: GameGateway) {}

  @Get('users')
  async users(@Query() query: Record<string, unknown>) {
    return this.admin.listUsers(query);
  }

  @Patch('users/:id/status')
  async status(@Param('id') id: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const user = await this.admin.setStatus(request.userId, id, body);
    if (user.disabledAt) await this.games.disconnectAccount(id);
    return { user };
  }
}
