export const SIZE = 6;
export const HALF = SIZE / 2;
export const CELL_COUNT = SIZE * SIZE;

export const EMPTY = 0;
export const A = 1;
export const B = 2;

export const REL_SAME = 'same';
export const REL_DIFFERENT = 'different';

export function opposite(value) {
  if (value === A) return B;
  if (value === B) return A;
  return EMPTY;
}
