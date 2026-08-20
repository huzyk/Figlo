export const N = 9;

export const regions = [
  [2,2,4,4,7,0,0,0,1],
  [2,4,4,7,7,0,0,1,1],
  [2,2,2,7,7,7,0,0,1],
  [2,2,5,5,5,0,0,0,1],
  [2,2,5,5,0,0,0,1,1],
  [2,2,2,5,5,0,0,0,8],
  [2,2,2,5,6,6,6,0,8],
  [2,2,2,6,6,6,3,0,0],
  [2,2,2,2,2,2,3,0,0]
];

export const cellCount = N * N;
export const allCells = Array.from({length: cellCount}, (_, i) => i);

export function rc(index) {
  return [Math.floor(index / N), index % N];
}

export function regionAt(index) {
  const [row, col] = rc(index);
  return regions[row][col];
}

export function cellsInRow(row) {
  return Array.from({length: N}, (_, col) => row * N + col);
}

export function cellsInColumn(col) {
  return Array.from({length: N}, (_, row) => row * N + col);
}

export function cellsInRegion(region) {
  return allCells.filter(index => regionAt(index) === region);
}
