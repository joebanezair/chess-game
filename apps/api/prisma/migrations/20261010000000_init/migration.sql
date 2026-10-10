CREATE TYPE "GameStatus" AS ENUM ('WAITING', 'ACTIVE', 'FINISHED');
CREATE TYPE "PlayerColor" AS ENUM ('RED', 'BLACK');

CREATE TABLE "User" (
 "id" TEXT NOT NULL,
 "username" TEXT NOT NULL,
 "email" TEXT NOT NULL,
 "passwordHash" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Game" (
 "id" TEXT NOT NULL,
 "redPlayerId" TEXT NOT NULL,
 "blackPlayerId" TEXT,
 "status" "GameStatus" NOT NULL DEFAULT 'WAITING',
 "turn" "PlayerColor" NOT NULL DEFAULT 'RED',
 "board" JSONB NOT NULL,
 "forcedFrom" INTEGER,
 "winnerId" TEXT,
 "version" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Move" (
 "id" TEXT NOT NULL,
 "gameId" TEXT NOT NULL,
 "playerId" TEXT NOT NULL,
 "ply" INTEGER NOT NULL,
 "from" INTEGER NOT NULL,
 "to" INTEGER NOT NULL,
 "captured" JSONB NOT NULL,
 "promoted" BOOLEAN NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Move_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "Game_redPlayerId_createdAt_idx" ON "Game"("redPlayerId","createdAt");
CREATE INDEX "Game_blackPlayerId_createdAt_idx" ON "Game"("blackPlayerId","createdAt");
CREATE UNIQUE INDEX "Move_gameId_ply_key" ON "Move"("gameId","ply");
CREATE INDEX "Move_playerId_idx" ON "Move"("playerId");
ALTER TABLE "Game" ADD CONSTRAINT "Game_redPlayerId_fkey" FOREIGN KEY ("redPlayerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Game" ADD CONSTRAINT "Game_blackPlayerId_fkey" FOREIGN KEY ("blackPlayerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Move" ADD CONSTRAINT "Move_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Move" ADD CONSTRAINT "Move_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
