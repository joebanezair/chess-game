import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const identifier = process.argv[2]?.trim().toLowerCase();
if (!identifier || identifier.length > 254) {
  console.error('Usage: npm run admin:promote -- <registered-username-or-email>');
  process.exit(1);
}
const prisma = new PrismaClient();
try {
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }] },
  });
  if (!user) throw new Error('User not found. Register in the app first.');
  if (user.disabledAt) throw new Error('Cannot promote a disabled account.');
  if (user.role === 'ADMIN') {
    console.log('This user is already an administrator:', user.username);
  } else {
    await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
    console.log('Administrator granted to:', user.username);
  }
  console.log('Protect this operator-only command and the database credentials.');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
