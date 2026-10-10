# Crown Checkers

A polished, **real-time two-player checkers web app** built with Next.js, TypeScript, shadcn-style UI components, NestJS/Fastify, Socket.IO, PostgreSQL, Prisma, and Redis.

**Current scope:** free-to-play American/English checkers. No real-money betting, payments, wallets, or wagering is implemented. Those require dedicated compliance, licensing, and financial controls before launch.

## Features

- Register with a username, email, and password; sign in/out with secure HTTP-only session cookies.
- Admin-only user management: search accounts, disable/re-enable players, disconnect disabled sessions, and record audit entries.
- Earn 20 **non-redeemable virtual coins** for a match won through normal gameplay. No coins for resignations, unfinished games, or losses; balance and reward history are stored securely in PostgreSQL.
- Queue for an automatically matched live opponent.
- Create a private challenge, share a link, and let another registered player accept.
- Play on a responsive board with highlighted legal moves, forced jumps, multi-captures, and king promotion.
- Server-authoritative rules, player authorization, atomic move writes, resignations, and game-history records.
- Games and moves persisted in PostgreSQL; Redis matchmaking, presence, and Socket.IO cross-instance broadcasting.
- Built-in throttling on authentication endpoints; polished dark UI with Next.js + Tailwind + shadcn-compatible button/card primitives.
- Tests for the rules engine and GitHub Actions build/test workflow.

## How to run locally

Everything needed to develop and run the game locally uses free software. You do **not** need a paid hosting account.

### 1. Install the prerequisites

- **Node.js 22 or newer** (includes npm) — [nodejs.org](https://nodejs.org/)
- **Docker Desktop** (Windows/macOS) or Docker Engine with Compose (Linux) — [docker.com](https://www.docker.com/products/docker-desktop/)
- **Git** — [git-scm.com](https://git-scm.com/)

Make sure Docker Desktop is **running** before starting the database.

### 2. Download the project

Open a terminal (PowerShell on Windows, or Terminal on macOS/Linux):

```bash
git clone https://github.com/joebanezair/chess-game.git
cd chess-game
npm install
```

If you've already cloned the repository, update it with `git pull origin main` instead of cloning again.

### 3. Create your environment files

**Windows — PowerShell:**

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
```

**macOS / Linux / Git Bash:**

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

The example files contain the correct **local** database, Redis, frontend, and API URLs. Open `apps/api/.env` and replace `JWT_SECRET` with your own long, random secret. To generate one:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Copy the generated value after `JWT_SECRET=` in `apps/api/.env`. **Never commit** `.env` or `.env.local` files.

### 4. Start PostgreSQL and Redis

From the project's root folder:

```bash
docker compose up -d --wait
```

This starts the local database on port **5432** and Redis on port **6379**. Initial Docker image downloads need internet access.

### 5. Initialize the database

```bash
npm run db:generate
npm run db:migrate
```

You need to do this for the first setup, and again after pulling code with new database migrations.

### 6. Start the game

```bash
npm run dev
```

Leave that terminal open. It runs the frontend and the multiplayer API together.

| Service | Local URL |
| --- | --- |
| **Play the game (Next.js frontend)** | **http://localhost:3000** |
| Multiplayer API (internal NestJS) | http://localhost:4000 |
| API health check (via frontend proxy) | http://localhost:3000/api/health |

Open **http://localhost:3000** in your browser, register an account, and start playing.

### 7. Test multiplayer with two accounts

1. Open the game in **two separate browsers** (or one normal window and one incognito/private window).
2. Register a **different account** in each browser.
3. For **automatic matchmaking**, click **Find a match** in both accounts. The game starts when they pair.
4. For a **private match**, click **Create a room** in the first account, copy its invitation link, then open it in the second account and click **Accept challenge**.
5. Play moves on the board; both players should see updates in real time.

Both players can use the same computer for testing. To connect another device, you'll need to configure reachable frontend/API addresses instead of `localhost`.

### Stop and restart

- Press **Ctrl+C** in the terminal running `npm run dev` to stop the application.
- To stop the database and Redis containers without deleting saved games: `docker compose down`
- To start the containers again: `docker compose up -d --wait`, then `npm run dev`.
- **Do not use `docker compose down -v` unless you intend to delete the local PostgreSQL and Redis data.**

### Troubleshooting

| Issue | What to check |
| --- | --- |
| `docker` command not found / cannot connect | Install and start Docker Desktop; verify `docker compose version`. |
| Database connection error | Run `docker compose ps` and check that PostgreSQL is healthy; verify `DATABASE_URL` in `apps/api/.env`. |
| Redis connection error / matchmaking unavailable | Verify Redis is running with `docker compose ps` and check `REDIS_URL`. |
| `JWT_SECRET` error | Generate a secret of at least 32 characters and set it in `apps/api/.env`. |
| Ports 3000, 4000, 5432, or 6379 are busy | Stop the conflicting program or change the relevant port configuration. |
| Changes to environment variables are not reflected | Stop and restart `npm run dev`. |
| Game loads but live moves do not update | Confirm the API is running and `/api/health` works; in local development use `/api` and the same-origin `/socket.io` proxy. |

### Run checks

```bash
npm test       # Checkers rules tests
npm run build  # Build the API and frontend
```

## Reset the development database

> **Warning — destructive commands:** Only use these steps for your **local development/test database**. They delete registered users, passwords, saved games, moves, admin roles, and the admin audit log. Back up any data you need beforehand. Stop the running application with **Ctrl+C** first.

### Option A: Reset only PostgreSQL using Prisma

This clears and recreates the database schema using the committed Prisma migrations; Docker volumes and Redis are preserved.

**Windows PowerShell, macOS, Linux, or Codespaces** (from the repository root):

```bash
docker compose up -d --wait
cd apps/api
npx prisma migrate reset --force
cd ../..
npm run dev
```

`prisma migrate reset --force` reapplies all migrations and runs configured seed scripts, if any. There is currently no configured seed script. Existing Redis matchmaking and presence data are **not** cleared by this option. Restarting Redis also preserves its persisted data; use the complete reset below if you need to clear Redis too.

### Option B: Completely erase PostgreSQL **and Redis** volumes

Use this only if you want a **full clean slate**. Docker Compose removes its project volumes with `-v`, permanently deleting local game data and Redis data.

**Windows PowerShell, macOS, Linux, or Codespaces** (from the repository root):

```bash
# Stop the application (Ctrl+C) first
docker compose down -v
docker compose up -d --wait
npm run db:generate
npm run db:migrate
npm run dev
```

### Restore an admin after either reset

Once the app is running, register your account again at `http://localhost:3000` (or your forwarded Codespaces port 3000 URL). From a **second terminal in the repository root**, run:

```bash
npm run admin:promote -- your_username_or_email
```

Sign out and back in to refresh your role, then open `/admin`. The reset deletes **all previous admin assignments**, so promotion must be repeated.

## Virtual coins (free to play)

Crown Coins are **virtual progress points only**: they cannot be purchased, transferred, wagered, redeemed, converted to money, or cashed out. New accounts start with **0 coins**.

- Win a game by the normal checkers rules (eliminate or block the other player): **+20 coins**.
- Lose, resign, win because the opponent resigned, or leave a match unfinished: **0 coins**.
- Each naturally completed game can issue **at most one reward**, enforced by a database uniqueness constraint and an atomic transaction with the game result.
- The lobby and game room show your balance; the lobby also shows your recent coin rewards.
- Your own account's wallet is available from the authenticated `GET /coins` API. There is no client-side API for granting, spending, or transferring coins.
- The migration creates coin balances and a persistent coin history without removing existing players or games. **Old finished games are not retroactively rewarded.**

When pulling the feature, run:

```bash
git pull origin main
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

**Do not run a database reset** to activate coins; the migration preserves your existing data. These rewards are for casual gameplay only, not financial wagering or prizes.

## Administrator setup and account disabling

Regular registration creates only **USER** accounts. There is **no public admin-registration endpoint** or default administrator password.

1. Start the database and apply migrations with `docker compose up -d --wait`, `npm run db:generate`, and `npm run db:migrate`.
2. Register your own user in the browser at `http://localhost:3000`.
3. From the **server terminal** (where you have database access), promote that user using:

   ```bash
   npm run admin:promote -- your_username_or_email
   ```

4. Sign out and sign in again to refresh the role shown in the interface.
5. Click **Admin** in the header or open `http://localhost:3000/admin`.

In the admin panel, search by username/email and choose **Disable** or **Enable** for a regular account. Disabling an account blocks login and authenticated API access, invalidates existing authentication tokens, removes the user from matchmaking, and disconnects their live sockets. Re-enabling does not restore their previous sessions: they must sign in again. All status changes are recorded in `AdminAction` with the administrator identity, action, optional reason, and timestamp.

**Safety:** Admins cannot disable their own accounts or other administrators from this panel. Only trusted server/database operators can grant ADMIN roles using the CLI above. Keep database credentials secret, never expose the promotion command to end users, and review the audit log when investigating abuse. Disabled users' game and user records remain stored for audit/history; they are not deleted.

## GitHub Codespaces / cloud development

**Fix for `Cannot reach the game API on http://localhost:4000`:** The browser might be accessing a forwarded Codespaces URL, while the game code was previously calling `localhost:4000` in *your browser*. That is not the Codespace backend.

The development server now uses a **same-origin proxy**: HTTP routes under `/api/*` and multiplayer WebSockets under `/socket.io/*` are forwarded from the frontend on **port 3000** to the backend on port 4000 *inside the Codespace*. Only forward/open **port 3000**. Cookies, user registration, the admin panel, and live games all use the same browser origin.

From your Codespace terminal (or local dev terminal), run:

```bash
git pull origin main
npm install
test -f apps/api/.env || cp apps/api/.env.example apps/api/.env
test -f apps/web/.env.local || cp apps/web/.env.example apps/web/.env.local
docker compose up -d --wait
npm run db:generate
npm run db:migrate
npm run dev
```

**Windows PowerShell** uses `Test-Path` / `Copy-Item` instead of `test` / `cp`.

Before running, update `JWT_SECRET` in `apps/api/.env` to a strong random secret. If you already copied the old `NEXT_PUBLIC_API_URL=http://localhost:4000` environment variable, the dev frontend will automatically use `/api` instead. You can also replace it explicitly with `NEXT_PUBLIC_API_URL=/api`. **Restart** Next.js after modifying `.env.local`.

Open the forwarded Codespace URL for **port 3000** and append **`/api/health`**, for example:
`https://YOUR-CODESPACE-3000.app.github.dev/api/health`.

It must return `{"ok":true}`. You should not need to make port 4000 public or expose a separate forwarded API URL.

**Important:** this proxy runs via `npm run dev` (the custom development server). In production, use a real reverse proxy with HTTPS that routes `/api/*` and `/socket.io/*` to the NestJS backend, or configure explicit production API/socket URLs and matching secure cookie and CORS policies.

## If the API is refusing connections on port 4000

A `net::ERR_CONNECTION_REFUSED` error can mean the NestJS backend is stopped **or** your browser is using the wrong hostname (e.g., using `localhost` when accessing Codespaces). The React DevTools console message is unrelated. Use the same-origin `/api/health` URL to test the new development proxy.

In separate terminals from the repository root:

```bash
# First terminal: start required services and initialize the database
docker compose up -d --wait
npm run db:generate
npm run db:migrate
npm run dev -w @crown/api

# Second terminal: start Next.js (while the first stays open)
npm run dev -w @crown/web
```

Open `http://localhost:3000/api/health` and verify it returns `{"ok":true}`. If it does not, check the backend terminal's exact startup error, and confirm `apps/api/.env` exists and `JWT_SECRET` is at least 32 characters.

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
- `GET /coins` — authenticated user's virtual coin balance and latest rewards
- `GET /admin/users?search=&page=1` — ADMIN-only paginated user search
- `PATCH /admin/users/:id/status` — ADMIN-only disable/re-enable (JSON: `{ "disabled": true, "reason": "optional" }`)

Socket.IO client messages: `presence:ping`, `queue:join`, `queue:leave`, `game:join`, `game:move`.

Server events: `queue:waiting`, `queue:left`, `queue:matched`, `game:state`, `game:error`. The server—not the browser—checks that the sender belongs to the game and that a proposed move is legal.

## Deployment / scaling notes

All application libraries are free or open-source, but **hosting 100,000 active users isn't free**. For an initial deployment, use managed PostgreSQL and Redis and independent deployments for the web and API. Run the NestJS server on a host with persistent WebSocket support (not a serverless request handler). Place the web and API under the same registrable domain and use HTTPS; set `WEB_ORIGIN` and `NEXT_PUBLIC_API_URL` accordingly to preserve secure, same-site cookies. Ensure reverse proxies support WebSocket upgrades.

Redis coordinates matchmaking and broadcasts Socket.IO events between API instances. PostgreSQL uses optimistic version checks for moves. **Before a major production launch**, add load tests, per-user socket limits, stronger queue crash recovery, reconnection handling, active-game cleanup, structured logging/metrics, audit review, backups, and a complete draw/disconnect policy. Load capacity has **not** been benchmarked for 100,000 concurrent users.

## Future wagering

Keep wallet/ledger, financial settlement, and bet placement **out of the game engine**. Do not take real-money wagers without jurisdiction-specific legal advice, licensing, age/identity verification, AML controls, responsible-gaming protections, and a double-entry ledger with idempotent settlement. This initial application does **not** include those features.

## Complete command reference

Run these from the **`chess-game` project root**, unless a section explicitly says otherwise. **Do not paste every command at once**: pick the task you need.

### Git and dependencies

```bash
# First-time clone
git clone https://github.com/joebanezair/chess-game.git
cd chess-game
npm install

# Existing clone: update to the latest main branch
git checkout main
git pull origin main
npm install
```

### Create environment files (first-time setup)

**Windows PowerShell:**

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
```

**macOS / Linux / Git Bash / Codespaces:**

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

**Generate your own strong JWT secret** and put its value in `apps/api/.env` under `JWT_SECRET`:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Do not commit your actual secrets. If the env files already exist, **do not overwrite them** just to rerun the game.

### Docker and database

| Command | Purpose | Deletes saved data? |
| --- | --- | --- |
| `docker compose up -d --wait` | Start PostgreSQL and Redis, waiting for healthy containers | No |
| `docker compose ps` | Check running containers | No |
| `docker compose logs postgres` | Inspect PostgreSQL errors | No |
| `docker compose logs redis` | Inspect Redis errors | No |
| `docker compose down` | Stop containers while preserving data volumes | No |
| `docker compose down -v` | **Delete** local PostgreSQL and Redis Docker volumes | **Yes** |
| `npm run db:generate` | Regenerate the Prisma client | No |
| `npm run db:migrate` | Apply existing database migrations | No (migrations can modify schema/data) |

To reset **only the database**, follow [Option A](#option-a-reset-only-postgresql-using-prisma). For a complete destructive reset of **both PostgreSQL and Redis**, follow [Option B](#option-b-completely-erase-postgresql-and-redis-volumes).

### Run servers

```bash
# Start both API and frontend (recommended)
npm run dev

# Or run each in a separate terminal:
npm run dev -w @crown/api
npm run dev -w @crown/web

# Stop the current development server: Ctrl+C
```

The app runs at `http://localhost:3000` (port 3000 forwarded URL in Codespaces); the internal API runs on port 4000. **Use the frontend's `/api/health`** URL to check connectivity:

```text
http://localhost:3000/api/health
```

Expected response: `{"ok":true}`. In Codespaces, append `/api/health` to your forwarded **port 3000** URL rather than visiting `localhost:4000` from the browser. See [Codespaces instructions](#github-codespaces--cloud-development) if you get connection errors.

### Tests, build, and server

```bash
npm test                # Checkers rules unit tests
npm run build           # Prisma generation + API/frontend production builds
npm run db:generate     # Recreate generated Prisma client
npm run db:migrate      # Apply pending database migrations
```

### Admin controls

```bash
# Promote an account that already registered; run only as a trusted server operator
npm run admin:promote -- your_username_or_email
```

Open `http://localhost:3000/admin` after signing out and signing back in. Do not expose the admin promotion command or database credentials to users.

### Quick start after pulling changes

If the environment is already configured, you can usually start everything with:

```bash
git pull origin main
npm install
docker compose up -d --wait
npm run db:generate
npm run db:migrate
npm run dev
```

If you are on Windows PowerShell and prefer step-by-step instructions, follow [How to run locally](#how-to-run-locally). Database reset commands are **not** part of everyday startup.
