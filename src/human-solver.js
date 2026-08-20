const DIRECTIONS = [[1,0],[-1,0],[0,1],[0,-1]];

function sizeOf(regions) {
  if (!Array.isArray(regions) || regions.length < 1 || regions.some(row => !Array.isArray(row) || row.length !== regions.length)) {
    throw new Error('regions musi być kwadratową planszą');
  }
  return regions.length;
}

function rc(index, size) { return [Math.floor(index / size), index % size]; }
function idx(row, col, size) { return row * size + col; }
function allCells(size) { return Array.from({length:size * size}, (_, i) => i); }
function cellsInRow(row, size) { return Array.from({length:size}, (_, col) => idx(row, col, size)); }
function cellsInColumn(col, size) { return Array.from({length:size}, (_, row) => idx(row, col, size)); }
function cellsInRegion(region, regions) {
  const size = regions.length;
  return allCells(size).filter(index => {
    const [r,c] = rc(index,size);
    return regions[r][c] === region;
  });
}

function stateCopy(state = {}) {
  return {
    crowns: new Set(state.crowns || []),
    crossed: new Set(state.crossed || state.manualXs || [])
  };
}

function crownConflict(a, b, regions) {
  if (a === b) return false;
  const size = regions.length;
  const [ar, ac] = rc(a, size);
  const [br, bc] = rc(b, size);
  if (ar === br || ac === bc) return true;
  if (regions[ar][ac] === regions[br][bc]) return true;
  return Math.abs(ar - br) <= 1 && Math.abs(ac - bc) <= 1;
}

function hasCrownConflict(state, regions) {
  const crowns = [...state.crowns];
  for (let i = 0; i < crowns.length; i++) {
    for (let j = i + 1; j < crowns.length; j++) {
      if (crownConflict(crowns[i], crowns[j], regions)) return true;
    }
  }
  return false;
}

function blockedByCrowns(index, state, regions) {
  for (const crown of state.crowns) {
    if (crownConflict(index, crown, regions)) return true;
  }
  return false;
}

function isCandidate(index, state, regions) {
  return !state.crowns.has(index) && !state.crossed.has(index) && !blockedByCrowns(index, state, regions);
}

function unitDefinitions(regions) {
  const size = regions.length;
  const units = [];
  for (let row = 0; row < size; row++) units.push({type:'row', id:row, cells:cellsInRow(row,size)});
  for (let col = 0; col < size; col++) units.push({type:'col', id:col, cells:cellsInColumn(col,size)});
  for (let region = 0; region < size; region++) units.push({type:'region', id:region, cells:cellsInRegion(region,regions)});
  return units;
}

function unitLabel(unit) {
  if (unit.type === 'row') return `${unit.id + 1}. wierszu`;
  if (unit.type === 'col') return `${unit.id + 1}. kolumnie`;
  return `regionie ${unit.id + 1}`;
}

function unitOccupied(unit, state) {
  return unit.cells.some(cell => state.crowns.has(cell));
}

function unitCandidates(unit, state, regions) {
  if (unitOccupied(unit, state)) return [];
  return unit.cells.filter(cell => isCandidate(cell, state, regions));
}

function contradiction(state, regions) {
  if (hasCrownConflict(state, regions)) return {type:'conflict'};
  for (const unit of unitDefinitions(regions)) {
    if (!unitOccupied(unit, state) && unitCandidates(unit, state, regions).length === 0) {
      return {type:'empty-unit', unit};
    }
  }
  return null;
}

function isSolved(state, regions) {
  const size = regions.length;
  if (state.crowns.size !== size || hasCrownConflict(state, regions)) return false;
  return unitDefinitions(regions).every(unit => unitOccupied(unit, state));
}

function forcedCrown(state, regions) {
  const candidates = [];
  for (const unit of unitDefinitions(regions)) {
    const cells = unitCandidates(unit, state, regions);
    if (cells.length === 1) candidates.push({unit, cell:cells[0]});
  }
  if (!candidates.length) return null;

  const priority = {region:0,row:1,col:2};
  candidates.sort((a,b) => priority[a.unit.type] - priority[b.unit.type] || a.unit.id - b.unit.id);
  const {unit, cell} = candidates[0];
  return {
    rule:'forced-crown',
    action:'crown',
    cells:[cell],
    area:unit.cells,
    reason:`W ${unitLabel(unit)} zostało tylko jedno możliwe pole. Tutaj musi stanąć korona.`
  };
}

function combinations(values, k, start=0, prefix=[], out=[]) {
  if (prefix.length === k) { out.push([...prefix]); return out; }
  for (let i=start; i<=values.length-(k-prefix.length); i++) {
    prefix.push(values[i]);
    combinations(values,k,i+1,prefix,out);
    prefix.pop();
  }
  return out;
}

function formatNumbers(values) {
  const nums = values.map(v => String(v + 1));
  if (nums.length === 1) return nums[0];
  if (nums.length === 2) return `${nums[0]} i ${nums[1]}`;
  return `${nums.slice(0,-1).join(', ')} i ${nums.at(-1)}`;
}

function regionSubsetElimination(state, regions) {
  const size = regions.length;
  const unfilledRegions = Array.from({length:size}, (_,r)=>r).filter(region => {
    return !cellsInRegion(region, regions).some(cell => state.crowns.has(cell));
  });

  for (const axis of ['row','col']) {
    for (let k=1; k<=Math.min(4, unfilledRegions.length); k++) {
      for (const regionGroup of combinations(unfilledRegions,k)) {
        const group = new Set(regionGroup);
        const possibleAxes = new Set();
        let valid = true;

        for (const region of regionGroup) {
          const candidates = cellsInRegion(region, regions).filter(cell => isCandidate(cell,state,regions));
          if (!candidates.length) { valid = false; break; }
          for (const cell of candidates) {
            const [row,col] = rc(cell,size);
            possibleAxes.add(axis === 'row' ? row : col);
          }
        }
        if (!valid || possibleAxes.size !== k) continue;

        const eliminate = allCells(size).filter(cell => {
          if (!isCandidate(cell,state,regions)) return false;
          const [row,col] = rc(cell,size);
          const coordinate = axis === 'row' ? row : col;
          if (!possibleAxes.has(coordinate)) return false;
          return !group.has(regions[row][col]);
        });
        if (!eliminate.length) continue;

        const axisValues = [...possibleAxes].sort((a,b)=>a-b);
        const area = allCells(size).filter(cell => {
          const [row,col] = rc(cell,size);
          return possibleAxes.has(axis === 'row' ? row : col);
        });
        const axisWord = axis === 'row' ? (k === 1 ? 'wierszu' : 'wierszach') : (k === 1 ? 'kolumnie' : 'kolumnach');
        const regionWord = k === 1 ? 'Ten region musi mieć koronę' : `Te ${k} regiony muszą mieć korony`;

        return {
          rule:'region-subset',
          action:'cross',
          cells:eliminate,
          area,
          reason:`${regionWord} w ${axisWord} ${formatNumbers(axisValues)}. Pozostałe wyróżnione pola w ${axisWord} ${formatNumbers(axisValues)} możesz oznaczyć X.`
        };
      }
    }
  }
  return null;
}

function axisSubsetElimination(state, regions) {
  const size = regions.length;
  for (const axis of ['row','col']) {
    const values = Array.from({length:size}, (_,v)=>v).filter(v => {
      const cells = axis === 'row' ? cellsInRow(v,size) : cellsInColumn(v,size);
      return !cells.some(cell => state.crowns.has(cell));
    });

    for (let k=1; k<=Math.min(4,values.length); k++) {
      for (const groupValues of combinations(values,k)) {
        const coordinateSet = new Set(groupValues);
        const candidateRegions = new Set();
        let valid = true;
        for (const value of groupValues) {
          const cells = (axis === 'row' ? cellsInRow(value,size) : cellsInColumn(value,size)).filter(cell => isCandidate(cell,state,regions));
          if (!cells.length) { valid = false; break; }
          for (const cell of cells) {
            const [row,col] = rc(cell,size);
            candidateRegions.add(regions[row][col]);
          }
        }
        if (!valid || candidateRegions.size !== k) continue;

        const eliminate = allCells(size).filter(cell => {
          if (!isCandidate(cell,state,regions)) return false;
          const [row,col] = rc(cell,size);
          const coordinate = axis === 'row' ? row : col;
          return !coordinateSet.has(coordinate) && candidateRegions.has(regions[row][col]);
        });
        if (!eliminate.length) continue;

        const axisWord = axis === 'row' ? (k === 1 ? 'wiersz' : 'wiersze') : (k === 1 ? 'kolumna' : 'kolumny');
        const regionWord = k === 1 ? 'jeden region' : `${k} regiony`;
        const area = allCells(size).filter(cell => {
          const [row,col] = rc(cell,size);
          return coordinateSet.has(axis === 'row' ? row : col);
        });
        return {
          rule:'axis-subset',
          action:'cross',
          cells:eliminate,
          area,
          reason:`${axisWord[0].toUpperCase()+axisWord.slice(1)} ${formatNumbers(groupValues)} mogą korzystać tylko z ${regionWord}. Korony tych regionów muszą zostać w tym obszarze, więc wyróżnione pola poza nim możesz oznaczyć X.`
        };
      }
    }
  }
  return null;
}

function contradictionReason(contradictionValue) {
  if (!contradictionValue || contradictionValue.type === 'conflict') return 'powstałby konflikt z inną koroną';
  return `w ${unitLabel(contradictionValue.unit)} nie zostałoby żadne miejsce na koronę`;
}

function directHypotheticalCrossout(state, regions) {
  const size = regions.length;
  for (const cell of allCells(size)) {
    if (!isCandidate(cell,state,regions)) continue;
    const test = stateCopy(state);
    test.crowns.add(cell);
    const problem = contradiction(test,regions);
    if (!problem) continue;
    return {
      rule:'hypothetical-crossout',
      action:'cross',
      cells:[cell],
      area:problem.unit?.cells || [cell],
      reason:`Gdyby stanęła tu korona, ${contradictionReason(problem)}. To pole możesz oznaczyć X.`
    };
  }
  return null;
}

function basicPropagation(state, regions, maxSteps=200) {
  const working = stateCopy(state);
  for (let i=0; i<maxSteps; i++) {
    const problem = contradiction(working,regions);
    if (problem) return {status:'contradiction', state:working, contradiction:problem};
    if (isSolved(working,regions)) return {status:'solved', state:working};
    const step = forcedCrown(working,regions) || regionSubsetElimination(working,regions) || axisSubsetElimination(working,regions) || directHypotheticalCrossout(working,regions);
    if (!step) return {status:'stuck', state:working};
    applyStep(working,step);
  }
  return {status:'stuck', state:working};
}

function lookahead(state, regions) {
  const size = regions.length;
  for (const cell of allCells(size)) {
    if (!isCandidate(cell,state,regions)) continue;

    const crownTry = stateCopy(state);
    crownTry.crowns.add(cell);
    const crownResult = basicPropagation(crownTry,regions,80);
    if (crownResult.status === 'contradiction') {
      return {
        rule:'lookahead-crossout',
        action:'cross',
        cells:[cell],
        area:[cell],
        reason:'Po sprawdzeniu konsekwencji tego pola powstaje sprzeczność. To pole możesz oznaczyć X.'
      };
    }

    const crossTry = stateCopy(state);
    crossTry.crossed.add(cell);
    const crossResult = basicPropagation(crossTry,regions,80);
    if (crossResult.status === 'contradiction') {
      return {
        rule:'lookahead-crown',
        action:'crown',
        cells:[cell],
        area:[cell],
        reason:'Wykluczenie tego pola prowadzi do sprzeczności. Tutaj musi stanąć korona.'
      };
    }
  }
  return null;
}

export function nextHumanDeduction(regions, inputState = {}, {allowLookahead=false} = {}) {
  sizeOf(regions);
  const state = stateCopy(inputState);
  const problem = contradiction(state,regions);
  if (problem) {
    return {
      rule:'contradiction',
      action:'error',
      cells:problem.unit?.cells || [],
      area:problem.unit?.cells || [],
      reason:problem.type === 'conflict' ? 'Na planszy są korony, które łamią zasady.' : `W ${unitLabel(problem.unit)} nie zostało żadne możliwe pole dla korony.`
    };
  }
  if (isSolved(state,regions)) return null;

  return forcedCrown(state,regions)
    || regionSubsetElimination(state,regions)
    || axisSubsetElimination(state,regions)
    || directHypotheticalCrossout(state,regions)
    || (allowLookahead ? lookahead(state,regions) : null);
}

export function applyStep(state, step) {
  if (!step) return state;
  if (step.action === 'crown') for (const cell of step.cells) state.crowns.add(cell);
  if (step.action === 'cross') for (const cell of step.cells) state.crossed.add(cell);
  return state;
}

export function solveByHumanDeductions(regions, inputState = {}, {allowLookahead=false, maxSteps=500} = {}) {
  sizeOf(regions);
  const state = stateCopy(inputState);
  const deductions = [];
  for (let i=0; i<maxSteps; i++) {
    const problem = contradiction(state,regions);
    if (problem) return {status:'contradiction', state, deductions, contradiction:problem};
    if (isSolved(state,regions)) return {status:'solved', state, deductions};
    const step = nextHumanDeduction(regions,state,{allowLookahead});
    if (!step || step.action === 'error') return {status:'stuck', state, deductions};
    deductions.push(step);
    applyStep(state,step);
  }
  return {status:'stuck', state, deductions};
}

export function validateHumanSolvable(regions, options={}) {
  const result = solveByHumanDeductions(regions,{},options);
  return {solvable:result.status === 'solved', deductions:result.deductions, status:result.status};
}
