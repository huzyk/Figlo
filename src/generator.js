const DEFAULT_SIZE = 9;
const GENERATOR_VERSION = 1;
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function hashSeed(value) {
  let hash = 2166136261 >>> 0;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value |= 0;
    value = (value + 0x6D2B79F5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function addFrontier(grid, frontier, row, col, size) {
  for (const [dr, dc] of DIRECTIONS) {
    const nextRow = row + dr;
    const nextCol = col + dc;
    if (
      nextRow >= 0 && nextRow < size &&
      nextCol >= 0 && nextCol < size &&
      grid[nextRow][nextCol] === -1
    ) {
      frontier.add(nextRow * size + nextCol);
    }
  }
}

function createRegionLayout(size, random) {
  const cellCount = size * size;
  const seedCells = shuffle(
    Array.from({ length: cellCount }, (_, index) => index),
    random
  ).slice(0, size);

  const grid = Array.from({ length: size }, () => Array(size).fill(-1));
  const regionSizes = Array(size).fill(0);
  const frontier = new Set();

  for (let region = 0; region < size; region++) {
    const cell = seedCells[region];
    const row = Math.floor(cell / size);
    const col = cell % size;
    grid[row][col] = region;
    regionSizes[region] = 1;
  }

  for (const cell of seedCells) {
    addFrontier(grid, frontier, Math.floor(cell / size), cell % size, size);
  }

  let remaining = cellCount - size;

  while (remaining > 0) {
    const options = [];

    for (const cell of frontier) {
      const row = Math.floor(cell / size);
      const col = cell % size;
      if (grid[row][col] !== -1) continue;

      const neighboringRegions = new Set();
      for (const [dr, dc] of DIRECTIONS) {
        const nextRow = row + dr;
        const nextCol = col + dc;
        if (nextRow < 0 || nextRow >= size || nextCol < 0 || nextCol >= size) continue;
        const region = grid[nextRow][nextCol];
        if (region >= 0) neighboringRegions.add(region);
      }

      for (const region of neighboringRegions) options.push({ cell, region });
    }

    if (!options.length) throw new Error('Generator regionów utknął bez dostępnego pola.');

    const weights = [];
    let totalWeight = 0;
    for (const option of options) {
      const weight = 1 / Math.sqrt(regionSizes[option.region] + 1);
      weights.push(weight);
      totalWeight += weight;
    }

    let roll = random() * totalWeight;
    let chosen = options[options.length - 1];
    for (let index = 0; index < options.length; index++) {
      roll -= weights[index];
      if (roll <= 0) {
        chosen = options[index];
        break;
      }
    }

    const row = Math.floor(chosen.cell / size);
    const col = chosen.cell % size;
    if (grid[row][col] !== -1) {
      frontier.delete(chosen.cell);
      continue;
    }

    grid[row][col] = chosen.region;
    regionSizes[chosen.region] += 1;
    frontier.delete(chosen.cell);
    addFrontier(grid, frontier, row, col, size);
    remaining -= 1;
  }

  return { regions: grid, regionSizes };
}

export function countRegionSolutions(regions, limit = 2) {
  const size = regions.length;
  let count = 0;
  let firstSolution = null;
  const usedColumns = new Uint8Array(size);
  const usedRegions = new Uint8Array(size);
  const columns = new Int16Array(size);

  function search(row) {
    if (count >= limit) return;
    if (row === size) {
      count += 1;
      if (!firstSolution) {
        firstSolution = Array.from(columns, (col, solutionRow) => solutionRow * size + col);
      }
      return;
    }

    for (let col = 0; col < size; col++) {
      if (usedColumns[col]) continue;
      const region = regions[row][col];
      if (region < 0 || region >= size || usedRegions[region]) continue;
      if (row > 0 && Math.abs(col - columns[row - 1]) <= 1) continue;

      usedColumns[col] = 1;
      usedRegions[region] = 1;
      columns[row] = col;
      search(row + 1);
      usedColumns[col] = 0;
      usedRegions[region] = 0;

      if (count >= limit) return;
    }
  }

  search(0);
  return { count, solution: firstSolution };
}

export function validateGeneratedRegions(regions) {
  const size = regions.length;
  if (!Number.isInteger(size) || size < 1) return false;
  if (regions.some(row => !Array.isArray(row) || row.length !== size)) return false;

  const counts = Array(size).fill(0);
  for (const row of regions) {
    for (const region of row) {
      if (!Number.isInteger(region) || region < 0 || region >= size) return false;
      counts[region] += 1;
    }
  }
  if (counts.some(count => count === 0)) return false;

  for (let region = 0; region < size; region++) {
    let start = null;
    for (let row = 0; row < size && !start; row++) {
      for (let col = 0; col < size; col++) {
        if (regions[row][col] === region) {
          start = [row, col];
          break;
        }
      }
    }

    const seen = new Set([start[0] * size + start[1]]);
    const queue = [start];
    while (queue.length) {
      const [row, col] = queue.pop();
      for (const [dr, dc] of DIRECTIONS) {
        const nextRow = row + dr;
        const nextCol = col + dc;
        if (nextRow < 0 || nextRow >= size || nextCol < 0 || nextCol >= size) continue;
        if (regions[nextRow][nextCol] !== region) continue;
        const key = nextRow * size + nextCol;
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push([nextRow, nextCol]);
      }
    }

    if (seen.size !== counts[region]) return false;
  }

  return true;
}

export function generatePuzzle(seed, {
  size = DEFAULT_SIZE,
  maxAttempts = 10000,
  minRegionSize = 2
} = {}) {
  if (!Number.isInteger(size) || size < 4) throw new Error('Rozmiar planszy musi być liczbą całkowitą >= 4.');
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new Error('maxAttempts musi być dodatnią liczbą całkowitą.');

  const normalizedSeed = String(seed);
  const random = seededRandom(hashSeed(`figlo:${GENERATOR_VERSION}:${normalizedSeed}:${size}`));

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { regions, regionSizes } = createRegionLayout(size, random);
    if (Math.min(...regionSizes) < minRegionSize) continue;

    const solved = countRegionSolutions(regions, 2);
    if (solved.count !== 1) continue;

    return {
      id: `practice-${GENERATOR_VERSION}-${normalizedSeed}`,
      generatorVersion: GENERATOR_VERSION,
      seed: normalizedSeed,
      size,
      regions,
      solution: solved.solution,
      attempts: attempt
    };
  }

  throw new Error(`Nie udało się wygenerować unikalnej planszy po ${maxAttempts} próbach.`);
}

export { GENERATOR_VERSION };
