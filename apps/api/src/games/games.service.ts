import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { GameStatus, PlayerColor, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { initialBoard, legalMoves, playMove, type Board, type Color } from '../game/rules';

const participants = {
  redPlayer: { select: { id: true, username: true } },
  blackPlayer: { select: { id: true, username: true } },
} as const;

@Injectable()
export class GamesService {
  constructor(private prisma: PrismaService) {}

  async createInvite(redId: string) {
    return this.prisma.game.create({ data: { redPlayerId: redId, board: initialBoard() } });
  }

  async startMatch(redId: string, blackId: string) {
    if (redId === blackId) throw new BadRequestException('You cannot play against yourself');
    const count = await this.prisma.user.count({
      where: { id: { in: [redId, blackId] }, disabledAt: null },
    });
    if (count !== 2) throw new ForbiddenException('A player is disabled.');
    return this.prisma.game.create({
      data: { redPlayerId: redId, blackPlayerId: blackId, status: 'ACTIVE', board: initialBoard() },
    });
  }

  async joinInvite(gameId: string, userId: string) {
    const existing = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!existing) throw new NotFoundException('Game not found');
    if (!(await this.prisma.user.findFirst({ where: { id: existing.redPlayerId, disabledAt: null } }))) {
      throw new BadRequestException('The host account is disabled');
    }
    if (existing.blackPlayerId === userId) return existing;
    if (existing.redPlayerId === userId) throw new BadRequestException('You cannot join your own challenge');
    const result = await this.prisma.game.updateMany({
      where: { id: gameId, status: 'WAITING', blackPlayerId: null },
      data: { blackPlayerId: userId, status: 'ACTIVE', version: { increment: 1 } },
    });
    if (!result.count) throw new BadRequestException('This challenge is no longer available');
    return this.prisma.game.findUniqueOrThrow({ where: { id: gameId } });
  }

  async listMine(userId: string) {
    return this.prisma.game.findMany({
      where: { OR: [{ redPlayerId: userId }, { blackPlayerId: userId }] },
      include: participants,
      orderBy: { createdAt: 'desc' },
      take: 12,
    });
  }

  async snapshot(gameId: string, userId: string) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId }, include: participants });
    if (!game) throw new NotFoundException('Game not found');
    const mine = game.redPlayerId === userId ? 'RED' : game.blackPlayerId === userId ? 'BLACK' : null;
    if (!mine && game.status !== 'WAITING') throw new ForbiddenException('You are not in this game');
    return {
      id: game.id, status: game.status, board: game.board as Board,
      turn: game.turn, forcedFrom: game.forcedFrom, winnerId: game.winnerId,
      red: game.redPlayer, black: game.blackPlayer, meColor: mine,
      version: game.version, createdAt: game.createdAt,
      legalMoves: mine === game.turn && game.status === 'ACTIVE'
        ? legalMoves(game.board as Board, game.turn as Color, game.forcedFrom)
        : [],
    };
  }

  async playerIds(gameId: string) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId }, select: { redPlayerId: true, blackPlayerId: true } });
    if (!game) throw new NotFoundException('Game not found');
    return [game.redPlayerId, game.blackPlayerId].filter((id): id is string => Boolean(id));
  }

  async move(gameId: string, userId: string, from: number, to: number) {
    return this.prisma.$transaction(async (tx) => {
      const game = await tx.game.findUnique({ where: { id: gameId } });
      if (!game) throw new NotFoundException('Game not found');
      const players = await tx.user.count({
        where: {
          id: { in: [game.redPlayerId, game.blackPlayerId!].filter(Boolean) },
          disabledAt: null,
        },
      });
      if (players !== 2) throw new ForbiddenException('This match contains a disabled account');
      if (game.status !== GameStatus.ACTIVE) throw new BadRequestException('This game is not active');
      const color: Color | null = game.redPlayerId === userId ? 'RED' : game.blackPlayerId === userId ? 'BLACK' : null;
      if (!color) throw new ForbiddenException('You are not a player in this game');
      if (game.turn !== color) throw new BadRequestException("It's not your turn");
      let next: ReturnType<typeof playMove>;
      try { next = playMove(game.board as Board, color, game.forcedFrom, from, to); }
      catch (error) { throw new BadRequestException((error as Error).message); }
      const updated = await tx.game.updateMany({
        where: { id: gameId, version: game.version, status: 'ACTIVE' },
        data: {
          board: next.board as Prisma.InputJsonValue,
          turn: next.turn as PlayerColor,
          forcedFrom: next.forcedFrom,
          status: next.winner ? 'FINISHED' : 'ACTIVE',
          winnerId: next.winner === 'RED' ? game.redPlayerId : next.winner === 'BLACK' ? game.blackPlayerId : null,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new BadRequestException('Board changed. Refresh and try again.');
      await tx.move.create({
        data: {
          gameId, playerId: userId, ply: game.version + 1,
          from, to, captured: next.captures, promoted: next.promoted,
        },
      });
      return { id: gameId };
    });
  }

  async resign(gameId: string, userId: string) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game || game.status !== 'ACTIVE') throw new BadRequestException('This game is not active');
    const opponentId = game.redPlayerId === userId ? game.blackPlayerId
      : game.blackPlayerId === userId ? game.redPlayerId : null;
    if (!opponentId) throw new ForbiddenException('You are not in this game');
    const result = await this.prisma.game.updateMany({
      where: { id: gameId, status: 'ACTIVE', version: game.version },
      data: { status: 'FINISHED', winnerId: opponentId, version: { increment: 1 } },
    });
    if (result.count !== 1) throw new BadRequestException('Game changed. Refresh and try again.');
  }
}
