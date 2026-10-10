import { Module } from '@nestjs/common';
import { CoinsController } from './coins/coins.controller';
import { CoinsService } from './coins/coins.service';
import { AdminController, AdminRoleGuard } from './admin/admin.controller';
import { AdminService } from './admin/admin.service';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { AuthService } from './auth/auth.service';
import { GameGateway } from './games/game.gateway';
import { GamesController } from './games/games.controller';
import { GamesService } from './games/games.service';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';

@Module({
  imports: [JwtModule.register({
    secret: process.env.JWT_SECRET,
    signOptions: { expiresIn: '7d', issuer: 'crown-checkers' },
    verifyOptions: { issuer: 'crown-checkers' },
  })],
  controllers: [AuthController, GamesController, AdminController, CoinsController],
  providers: [AuthService, AuthGuard, AdminRoleGuard, AdminService, CoinsService, GameGateway, GamesService, PrismaService, RedisService],
})
export class AppModule {}
