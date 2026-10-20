// One shared scoring formula for preview/local progression and future server verification.
// Local scores are provisional and MUST NOT be treated as server-verified leaderboard entries.
export const VERIFIED_SCORING_VERSION = 2;
export const DAILY_SET_BONUS = 20;
export const GAME_IDS = Object.freeze(['korony','duet','bloki','latarnie','memory','zip','sudoku']);
export const TARGET_SECONDS = Object.freeze({
  korony: 240, duet: 210, bloki: 270,
  latarnie: 270, memory: 100, zip: 210, sudoku: 300,
});
export const PERIODS = Object.freeze(['week','month','year','all']);

export function targetSeconds(gameId, difficulty='medium') {
  const base = TARGET_SECONDS[gameId];
  if (!base) throw new Error('Unknown game');
  const multiplier = {gentle:0.75,easy:0.85,medium:1,hard:1.2,challenge:1.35}[difficulty] ?? 1;
  return Math.round(base * multiplier);
}
export function speedPoints(elapsedMs, targetSecs) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 3000 ||
      !Number.isInteger(targetSecs) || targetSecs < 30) return 0;
  // Ten tiers distinguish sub-minute solves without rewarding impossible times.
  // Ratio is measured against each game's target, so a 30s Duet and Sudoku
  // are rewarded fairly even though their reference times differ.
  const ratio = elapsedMs / (targetSecs * 1000);
  const tiers = [0.10, 0.20, 0.34, 0.50, 0.70, 1, 1.30, 1.60, 1.90, 2.30];
  const tier = tiers.findIndex(limit => ratio <= limit);
  return tier === -1 ? 0 : 10 - tier;
}
export function calculateVerifiedPoints({elapsedMs, targetSecs, hintsUsed}) {
  if (!Number.isInteger(hintsUsed) || hintsUsed < 0) throw new Error('Missing verified hint count');
  if (!Number.isFinite(elapsedMs) || elapsedMs < 3000) throw new Error('Invalid measured time');
  const base = 10, speed = speedPoints(elapsedMs,targetSecs), clean = hintsUsed === 0 ? 5 : 0;
  return {base,speed,clean,total:base+speed+clean};
}
export function periodStart(dateKey,period) {
  if (!PERIODS.includes(period) || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error('Invalid period/date');
  const date = new Date(dateKey+'T12:00:00Z');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0,10)!==dateKey) throw new Error('Invalid date');
  if(period==='all') return '2026-01-01';
  if(period==='year') return dateKey.slice(0,4)+'-01-01';
  if(period==='month') return dateKey.slice(0,7)+'-01';
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay()+6)%7));
  return date.toISOString().slice(0,10);
}
// The proof contains only player moves. Never trust a client-supplied board,
// target time, points, hint count or claimed completion.
export function validateSolvedProof(gameId,submitted,canonical) {
  if (!GAME_IDS.includes(gameId) || !Array.isArray(submitted) || !Array.isArray(canonical)) return false;
  if (submitted.length!==canonical.length || submitted.length>100) return false;
  if (gameId==='bloki') {
    const format = value => {
      if(!value || typeof value!=='object' || typeof value.clueId!=='string' || !value.rect) return null;
      const r=value.rect;
      if(![r.row,r.col,r.width,r.height].every(n=>Number.isInteger(n)&&n>=0&&n<=9))return null;
      return [value.clueId,r.row,r.col,r.width,r.height].join(':');
    };
    const a=submitted.map(format),b=canonical.map(format);
    return !a.includes(null)&&!b.includes(null)&&a.sort().every((value,index)=>value===b.sort()[index]);
  }
  const limit = gameId==='duet'||gameId==='sudoku'?36:gameId==='zip'?49:81;
  if(submitted.length>limit) return false;
  const validValues = values => values.every(n=>Number.isInteger(n) && n>=0 && n<=80);
  if (!validValues(submitted)||!validValues(canonical)) return false;
  if(gameId==='korony'||gameId==='latarnie'){
    if(new Set(submitted).size!==submitted.length)return false;
    return [...submitted].sort((a,b)=>a-b).every((v,i)=>v===[...canonical].sort((a,b)=>a-b)[i]);
  }
  return submitted.every((value,index)=>value===canonical[index]);
}
