export const N = 9;

export const regions = [
  [2,2,4,4,7,0,0,0,1],
  [2,4,4,4,7,0,0,1,1],
  [2,2,2,5,7,5,0,0,1],
  [2,2,5,5,5,5,0,0,1],
  [2,2,5,5,5,0,0,1,1],
  [2,2,2,5,5,0,0,0,8],
  [2,2,2,5,5,6,0,0,8],
  [2,2,2,6,6,6,0,0,8],
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

export function validatePuzzleDefinition(definition = regions, size = N) {
  const errors = [];
  if (!Array.isArray(definition) || definition.length !== size) errors.push(`regions musi mieć ${size} wierszy`);
  const rows = Array.isArray(definition) ? definition : [];
  if (rows.some(row => !Array.isArray(row) || row.length !== size)) errors.push(`każdy wiersz regions musi mieć ${size} pól`);

  const values = rows.flat();
  const unique = new Set(values);
  if (unique.size !== size) errors.push(`puzzle musi mieć dokładnie ${size} regionów`);

  return {valid: errors.length === 0, errors};
}
