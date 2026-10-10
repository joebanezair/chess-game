import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthRequest } from '../auth/auth.guard';
import { GamesService } from './games.service';
import { GameGateway } from './game.gateway';

@UseGuards(AuthGuard)
@Controller('games')
export class GamesController {
  constructor(private games: GamesService, private gateway: GameGateway) {}

  @Get()
  async mine(@Req() req: AuthRequest) { return this.games.listMine(req.userId); }

  @Post()
  async create(@Req() req: AuthRequest) {
    const game = await this.games.createInvite(req.userId);
    return { id: game.id };
  }

  @Get(':id')
  async get(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.games.snapshot(id, req.userId);
  }

  @Post(':id/join')
  async join(@Param('id') id: string, @Req() req: AuthRequest) {
    const game = await this.games.joinInvite(id, req.userId);
    await this.gateway.publishState(game.id);
    return { id: game.id };
  }

  @Post(':id/resign')
  async resign(@Param('id') id: string, @Req() req: AuthRequest) {
    await this.games.resign(id, req.userId);
    await this.gateway.publishState(id);
    return { ok: true };
  }
}
