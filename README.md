# Crown Checkers

A polished, **real-time two-player checkers web app** built with Next.js, TypeScript, shadcn-style UI components, NestJS/Fastify, Socket.IO, PostgreSQL, Prisma, and Redis.

**Current scope:** free-to-play American/English checkers. No real-money betting, payments, wallets, or wagering is implemented. Those require dedicated compliance, licensing, and financial controls before launch.

## Features

- Register with a username, email, and password; sign in/out with secure HTTP-only session cookies.
- Queue for an automatically matched live opponent.
- Create a private challenge, share a link, and let another registered player accept.
- Play on a responsive board with highlighted legal moves, forced jumps, multi-captures, and king promotion.
- Server-authoritative rules, player authorization, atomic move writes, resignations, and game-history records.
- Games and moves persisted in PostgreSQL; Redis matchmaking, presence, and Socket.IO cross-instance broadcasting.
- Built-in throttling on authentication endpoints; polished dark UI with Next.js + Tailwind + shadcn-compatible button/card primitives.
- Tests for the rules engine and GitHub Actions build/test workflow.

## Local setup (free software; no hosted services required)

Install **Node.js 22+**, npm, and Docker Desktop (or Docker Engine and Compose).

```bash
git clone https://github.com/joebanezair/chess-game.git
cd chess-game
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
docker compose up -d
npm run db:generate
npm run db:migrate
npm run dev
```

For Windows PowerShell, replace the two `cp` commands with `Copy-Item`.

Open **http://localhost:3000** in two different browsers or private windows. Register two separate accounts. Choose **Find a match** in each browser, or create a room on one account and use its shared link on the other. The API runs on **http://localhost:4000**, and `GET /health` provides a simple health endpoint.

**Important:** Change `JWT_SECRET` before publishing any server. Never commit your `.env` files. PostgreSQL and Redis are provided locally by Docker Compose, not free cloud infrastructure.

## Project structure

```text
apps/
  web/                 Next.js App Router, Tailwind, UI and Socket.IO client
    src/app/page.tsx
    src/components/ui/
  api/                 NestJS on Fastify, JWT cookie auth and multiplayer
    prisma/schema.prisma
    src/auth/
    src/game/rules.ts  Pure, tested checkers rule engine
    src/games/         Game APIs, matchmaking, game sockets
    src/redis-io.adapter.ts
docker-compose.yml
.github/workflows/ci.yml
```

## Gameplay rules

The game follows **American/English checkers** (8×8 board): red moves first, ordinary pieces move diagonally forward, kings move one square diagonally in either direction, jumps are compulsory, consecutive jumps must be completed, and a piece crowned during a jump ends its turn. A player wins when the opponent has no legal moves (including no pieces). Draw rules and match clocks are **not yet implemented**, and should be specified before any ranked or regulated competition.

## API and socket events

Authenticated REST endpoints:

- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- `GET /games` — recent games; `POST /games` — invite room
- `GET /games/:id` — snapshot; `POST /games/:id/join` — accept invite
- `POST /games/:id/resign` — resign

Socket.IO client messages: `presence:ping`, `queue:join`, `queue:leave`, `game:join`, `game:move`.

Server events: `queue:waiting`, `queue:left`, `queue:matched`, `game:state`, `game:error`. The server—not the browser—checks that the sender belongs to the game and that a proposed move is legal.

## Deployment / scaling notes

All application libraries are free or open-source, but **hosting 100,000 active users isn't free**. For an initial deployment, use managed PostgreSQL and Redis and independent deployments for the web and API. Run the NestJS server on a host with persistent WebSocket support (not a serverless request handler). Place the web and API under the same registrable domain and use HTTPS; set `WEB_ORIGIN` and `NEXT_PUBLIC_API_URL` accordingly to preserve secure, same-site cookies. Ensure reverse proxies support WebSocket upgrades.

Redis coordinates matchmaking and broadcasts Socket.IO events between API instances. PostgreSQL uses optimistic version checks for moves. **Before a major production launch**, add load tests, per-user socket limits, stronger queue crash recovery, reconnection handling, active-game cleanup, structured logging/metrics, audit review, backups, and a complete draw/disconnect policy. Load capacity has **not** been benchmarked for 100,000 concurrent users.

## Future wagering

Keep wallet/ledger, financial settlement, and bet placement **out of the game engine**. Do not take real-money wagers without jurisdiction-specific legal advice, licensing, age/identity verification, AML controls, responsible-gaming protections, and a double-entry ledger with idempotent settlement. This initial application does **not** include those features.

## Commands

```bash
npm run dev
npm test
npm run build
npm run db:generate
npm run db:migrate
```
