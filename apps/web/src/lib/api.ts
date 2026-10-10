// Use same-origin reverse proxy in development, even if an older .env.local
// still contains the legacy localhost:4000 value. This works in Codespaces,
const apiUrlSetting = process.env.NEXT_PUBLIC_API_URL?.trim() || '';
const configuredApiUrl = apiUrlSetting.endsWith('/') ? apiUrlSetting.slice(0, -1) : apiUrlSetting;
const legacyLocalUrl = configuredApiUrl === 'http://localhost:4000' || configuredApiUrl === 'http://127.0.0.1:4000';
export const API_URL = !configuredApiUrl || legacyLocalUrl ? '/api' : configuredApiUrl;
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || (API_URL === '/api' ? '' : API_URL);

export type User = { id: string; username: string; email: string; role: 'ADMIN' | 'USER' };
export type CoinWallet = {
  balance: number;
  history: Array<{ id: string; gameId: string; amount: number; createdAt: string }>;
};
export type Piece = 'r' | 'R' | 'b' | 'B' | null;
export type LegalMove = { from: number; to: number; captures: number[] };
export type Game = {
  id: string;
  status: 'WAITING' | 'ACTIVE' | 'FINISHED';
  board: Piece[];
  turn: 'RED' | 'BLACK';
  forcedFrom: number | null;
  winnerId: string | null;
  red: Pick<User, 'id' | 'username'>;
  black: Pick<User, 'id' | 'username'> | null;
  meColor: 'RED' | 'BLACK' | null;
  legalMoves: LegalMove[];
  version: number;
  coinReward: { userId: string; amount: number } | null;
  createdAt: string;
};
export type GameListItem = {
  id: string;
  status: Game['status'];
  winnerId: string | null;
  redPlayerId: string;
  blackPlayerId: string | null;
  redPlayer: Pick<User, 'id' | 'username'>;
  blackPlayer: Pick<User, 'id' | 'username'> | null;
  coinReward: { userId: string; amount: number } | null;
  createdAt: string;
};

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Fastify rejects an empty POST/PATCH when Content-Type: application/json
  // is sent without a body. Only advertise JSON for actual JSON payloads.
  // Headers also preserves caller-provided values without changing FormData types.
  const headers = new Headers(init.headers);
  if (typeof init.body === 'string' && init.body.length > 0 && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(API_URL + path, {
      ...init,
      credentials: 'include',
      headers,
      cache: 'no-store',
    });
  } catch {
    throw new Error('Cannot reach the game API. Start the backend with npm run dev -w @crown/api and check /api/health.');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body.message === 'string' ? body.message : 'Request failed. Please try again.';
    throw new Error(message);
  }
  return body as T;
}
