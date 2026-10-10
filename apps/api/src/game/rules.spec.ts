import { describe, expect, it } from 'vitest';
import { initialBoard, legalMoves, playMove, type Board } from './rules';

const empty = (): Board => Array(64).fill(null);

describe('server-authoritative American checkers', () => {
  it('starts with 12 pieces each and seven red opening moves', () => {
    const board = initialBoard();
    expect(board.filter((p) => p === 'r')).toHaveLength(12);
    expect(board.filter((p) => p === 'b')).toHaveLength(12);
    expect(legalMoves(board, 'RED')).toHaveLength(7);
  });
  it('rejects non-diagonal or out-of-turn moves', () => {
    expect(() => playMove(initialBoard(), 'RED', null, 40, 24)).toThrow();
  });
  it('requires captures instead of ordinary moves', () => {
    const board = empty(); board[42] = 'r'; board[33] = 'b'; board[46] = 'r';
    expect(legalMoves(board, 'RED')).toEqual([{ from: 42, to: 24, captures: [33] }]);
  });
  it('keeps the same turn during a capture chain', () => {
    const board = empty(); board[42] = 'r'; board[33] = 'b'; board[17] = 'b';
    const first = playMove(board, 'RED', null, 42, 24);
    expect(first.turn).toBe('RED');
    expect(first.forcedFrom).toBe(24);
    expect(legalMoves(first.board, 'RED', 24)).toEqual([{ from: 24, to: 10, captures: [17] }]);
  });
  it('crowns red pieces and ends the turn after promotion', () => {
    const board = empty(); board[17] = 'r'; board[10] = 'b'; board[19] = 'b';
    const result = playMove(board, 'RED', null, 17, 3);
    expect(result.board[3]).toBe('R');
    expect(result.promoted).toBe(true);
    expect(result.forcedFrom).toBeNull();
  });
  it('detects victory if the opponent has no remaining moves', () => {
    const board = empty(); board[42] = 'r'; board[33] = 'b';
    expect(playMove(board, 'RED', null, 42, 24).winner).toBe('RED');
  });
});
