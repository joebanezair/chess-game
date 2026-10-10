import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CoinsService {
  constructor(private prisma: PrismaService) {}

  async wallet(userId: string) {
    const [user, history] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId }, select: { coinBalance: true },
      }),
      this.prisma.coinEntry.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true, gameId: true, amount: true, createdAt: true },
        take: 8,
      }),
    ]);
    return { balance: user.coinBalance, history };
  }
}
