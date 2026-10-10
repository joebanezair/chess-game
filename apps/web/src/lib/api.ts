export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export type User = { id: string; username: string; email: string };
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
  createdAt: string;
};

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(API_URL + path, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body.message === 'string' ? body.message : 'Request failed. Please try again.';
    throw new Error(message);
  }
  return body as T;
}
