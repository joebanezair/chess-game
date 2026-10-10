CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "AdminActionType" AS ENUM ('DISABLE', 'ENABLE');
ALTER TABLE "User"
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER',
  ADD COLUMN "disabledAt" TIMESTAMP(3),
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "AdminAction" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "action" "AdminActionType" NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminAction_createdAt_idx" ON "AdminAction"("createdAt");
CREATE INDEX "AdminAction_targetId_createdAt_idx" ON "AdminAction"("targetId", "createdAt");
ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
