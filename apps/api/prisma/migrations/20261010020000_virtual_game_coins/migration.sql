-- Virtual reward points only; never a payment, transferable, or wagering balance.
ALTER TABLE "User" ADD COLUMN "coinBalance" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "CoinEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoinEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CoinEntry_positive_amount" CHECK ("amount" > 0)
);
CREATE UNIQUE INDEX "CoinEntry_gameId_key" ON "CoinEntry"("gameId");
CREATE INDEX "CoinEntry_userId_createdAt_idx" ON "CoinEntry"("userId", "createdAt");
ALTER TABLE "CoinEntry" ADD CONSTRAINT "CoinEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CoinEntry" ADD CONSTRAINT "CoinEntry_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
