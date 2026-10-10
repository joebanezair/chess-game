export type Color = 'RED' | 'BLACK';
export type Piece = 'r' | 'R' | 'b' | 'B' | null;
export type Board = Piece[];
export type LegalMove = { from: number; to: number; captures: number[] };
export type Position = { board: Board; turn: Color; forcedFrom: number | null; winner: Color | null; promoted: boolean; captures: number[] };

export function initialBoard(): Board {
  return Array.from({ length: 64 }, (_, index) => {
    const row = Math.floor(index / 8);
    const col = index % 8;
    if ((row + col) % 2 === 0) return null;
    if (row <= 2) return 'b';
    if (row >= 5) return 'r';
    return null;
  });
}

export function pieceColor(piece: Piece): Color | null {
  if (piece === 'r' || piece === 'R') return 'RED';
  if (piece === 'b' || piece === 'B') return 'BLACK';
  return null;
}

function movesFrom(board: Board, from: number): LegalMove[] {
  const piece = board[from];
  if (!piece) return [];
  const color = pieceColor(piece)!;
  const row = Math.floor(from / 8);
  const col = from % 8;
  const directions = piece === 'R' || piece === 'B' ? [-1, 1] : [color === 'RED' ? -1 : 1];
  const moves: LegalMove[] = [];
  for (const dr of directions) {
    for (const dc of [-1, 1]) {
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
      const middle = r * 8 + c;
      if (!board[middle]) {
        moves.push({ from, to: middle, captures: [] });
      } else if (pieceColor(board[middle]) !== color) {
        const jr = row + 2 * dr;
        const jc = col + 2 * dc;
        if (jr >= 0 && jr < 8 && jc >= 0 && jc < 8 && !board[jr * 8 + jc]) {
          moves.push({ from, to: jr * 8 + jc, captures: [middle] });
        }
      }
    }
  }
  return moves;
}

// American/English checkers: captures are compulsory, kings move one step,
// a capture chain must finish, and a piece crowned by a jump ends its turn.
export function legalMoves(board: Board, turn: Color, forcedFrom: number | null = null): LegalMove[] {
  if (forcedFrom !== null) {
    if (pieceColor(board[forcedFrom]) !== turn) return [];
    return movesFrom(board, forcedFrom).filter((move) => move.captures.length > 0);
  }
  const all: LegalMove[] = [];
  for (let index = 0; index < 64; index++) {
    if (pieceColor(board[index]) === turn) all.push(...movesFrom(board, index));
  }
  return all.some((move) => move.captures.length > 0)
    ? all.filter((move) => move.captures.length > 0)
    : all;
}

export function playMove(board: Board, turn: Color, forcedFrom: number | null, from: number, to: number): Position {
  if (![from, to].every((n) => Number.isInteger(n) && n >= 0 && n < 64)) throw new Error('Invalid board square');
  const move = legalMoves(board, turn, forcedFrom).find((item) => item.from === from && item.to === to);
  if (!move) throw new Error('Illegal move. Captures and continued jumps are mandatory.');
  const next = [...board];
  const piece = next[from]!;
  next[from] = null;
  for (const capture of move.captures) next[capture] = null;
  const row = Math.floor(to / 8);
  const promoted = (piece === 'r' && row === 0) || (piece === 'b' && row === 7);
  next[to] = promoted ? (turn === 'RED' ? 'R' : 'B') : piece;
  if (move.captures.length && !promoted && legalMoves(next, turn, to).length) {
    return { board: next, turn, forcedFrom: to, winner: null, promoted, captures: move.captures };
  }
  const opponent: Color = turn === 'RED' ? 'BLACK' : 'RED';
  const winner = legalMoves(next, opponent).length === 0 ? turn : null;
  return { board: next, turn: opponent, forcedFrom: null, winner, promoted, captures: move.captures };
}
