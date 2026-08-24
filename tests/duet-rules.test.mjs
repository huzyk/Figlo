import test from 'node:test';
import assert from 'node:assert/strict';
import { A, B, EMPTY, REL_DIFFERENT, REL_SAME } from '../src/duet/constants.js';
import { createBoard } from '../src/duet/model.js';
import { hasTriple, isPartialBoardValid, isSolved, respectsBalance } from '../src/duet/rules.js';

test('balance allows max three of each symbol', () => {
  assert.equal(respectsBalance([A,A,A,B,EMPTY,EMPTY]), true);
  assert.equal(respectsBalance([A,A,A,A,B,EMPTY]), false);
});

test('triple rule detects three equal neighbours', () => {
  assert.equal(hasTriple([A,A,A,B,B,A]), true);
  assert.equal(hasTriple([A,A,B,A,B,B]), false);
});

test('same and different relations are validated', () => {
  const board = createBoard();
  board[0] = A; board[1] = B; board[6] = A;
  assert.equal(isPartialBoardValid(board, { relations: [{ a:0,b:6,type:REL_SAME }] }), true);
  assert.equal(isPartialBoardValid(board, { relations: [{ a:0,b:1,type:REL_SAME }] }), false);
  assert.equal(isPartialBoardValid(board, { relations: [{ a:0,b:1,type:REL_DIFFERENT }] }), true);
});

test('known complete board is solved', () => {
  const board = [
    A,A,B,A,B,B,
    A,B,A,B,B,A,
    B,A,A,B,A,B,
    A,B,B,A,B,A,
    B,B,A,B,A,A,
    B,A,B,A,A,B
  ];
  assert.equal(isSolved(board, { relations: [] }), true);
});
