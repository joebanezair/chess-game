import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma, UserRole } from '@prisma/client';
import { z } from 'zod';

export const statusSchema = z.object({
  disabled: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});
export const searchSchema = z.object({
  search: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});

const visibleFields = {
  id: true, username: true, email: true, role: true, disabledAt: true, createdAt: true,
} as const;

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async listUsers(input: unknown) {
    const { search = '', page } = searchSchema.parse(input);
    const where: Prisma.UserWhereInput = search
      ? { OR: [
          { username: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ] }
      : {};
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where, select: visibleFields, skip: (page - 1) * 20, take: 20,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.user.count({ where }),
    ]);
    return { users, total, page, pageSize: 20 };
  }

  async setStatus(actorId: string, userId: string, input: unknown) {
    const { disabled, reason } = statusSchema.parse(input);
    if (actorId === userId) throw new ForbiddenException('You cannot disable your own account');
    if (!userId || userId.length > 100) throw new BadRequestException('Invalid user ID');
    const result = await this.prisma.$transaction(async (tx) => {
      const actor = await tx.user.findUnique({ where: { id: actorId }, select: { role: true, disabledAt: true } });
      if (!actor || actor.role !== UserRole.ADMIN || actor.disabledAt) {
        throw new ForbiddenException('Administrator access is required');
      }
      const target = await tx.user.findUnique({ where: { id: userId }, select: { role: true, disabledAt: true } });
      if (!target) throw new NotFoundException('User not found');
      // Safeguard: no admin can lock out another admin (including the final administrator).
      if (target.role === UserRole.ADMIN) throw new ForbiddenException('Administrator accounts cannot be disabled here');
      if (Boolean(target.disabledAt) === disabled) {
        throw new ConflictException(disabled ? 'Account is already disabled' : 'Account is already active');
      }
      const written = await tx.user.updateMany({
        where: { id: userId, role: 'USER', disabledAt: disabled ? null : { not: null } },
        data: {
          disabledAt: disabled ? new Date() : null,
          sessionVersion: { increment: 1 },
        },
      });
      if (written.count !== 1) throw new ConflictException('Account was updated by another administrator');
      await tx.adminAction.create({
        data: { actorId, targetId: userId, action: disabled ? 'DISABLE' : 'ENABLE', reason: reason || null },
      });
      return tx.user.findUniqueOrThrow({ where: { id: userId }, select: visibleFields });
    });
    return result;
  }
}
