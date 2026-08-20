import { N, allCells, rc, regionAt } from './puzzle.js';

export function createGameState(crowns = [], manualXs = []) {
  return { crowns: new Set(crowns), manualXs: new Set(manualXs) };
}

export function cloneState(state) {
  return createGameState(state.crowns, state.manualXs);
}

export function snapshot(state) {
  return { crowns: [...state.crowns], manualXs: [...state.manualXs] };
}

export function restore(snapshotValue) {
  return createGameState(snapshotValue.crowns, snapshotValue.manualXs);
}

export function cellsConflict(a, b) {
  if (a === b) return false;
  const [r1, c1] = rc(a);
  const [r2, c2] = rc(b);
  return r1 === r2 || c1 === c2 || regionAt(a) === regionAt(b) ||
    (Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1);
}

export function conflicts(crowns) {
  const crownList = [...crowns];
  const bad = new Set();
  for (let a = 0; a < crownList.length; a++) {
    for (let b = a + 1; b < crownList.length; b++) {
      if (cellsConflict(crownList[a], crownList[b])) {
        bad.add(crownList[a]);
        bad.add(crownList[b]);
      }
    }
  }
  return bad;
}

export function isBlockedByCrowns(index, crowns) {
  for (const crown of crowns) {
    if (crown !== index && cellsConflict(index, crown)) return true;
  }
  return false;
}

export function calculateAutoXs(crowns) {
  const autoXs = new Set();
  for (const index of allCells) {
    if (!crowns.has(index) && isBlockedByCrowns(index, crowns)) autoXs.add(index);
  }
  return autoXs;
}

export function visibleXs(state, autoXEnabled) {
  const result = new Set(state.manualXs);
  if (autoXEnabled) {
    for (const index of calculateAutoXs(state.crowns)) result.add(index);
  }
  for (const crown of state.crowns) result.delete(crown);
  return result;
}

export function cycleCell(state, index) {
  const next = cloneState(state);
  if (next.crowns.has(index)) {
    next.crowns.delete(index);
    return next;
  }
  if (next.manualXs.has(index)) {
    next.manualXs.delete(index);
    next.crowns.add(index);
    return next;
  }
  next.manualXs.add(index);
  return next;
}

export function clearManualXs(state) {
  return createGameState(state.crowns, []);
}

export function isSolved(state) {
  if (state.crowns.size !== N || conflicts(state.crowns).size) return false;
  const rows = new Set();
  const cols = new Set();
  const regs = new Set();
  for (const index of state.crowns) {
    const [row, col] = rc(index);
    rows.add(row);
    cols.add(col);
    regs.add(regionAt(index));
  }
  return rows.size === N && cols.size === N && regs.size === N;
}
