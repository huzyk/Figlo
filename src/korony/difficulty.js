import { dailyPuzzleSeed } from '../daily.js';
import { difficultyForGameDate } from '../difficulty-schedule.js';

// Keep historical puzzles and their challenge links stable.
export const CROWNS_EASIER_FROM = '2026-10-16';

export function crownDailyConfig(dateKey,{challengeId=null}={}){
  const previousDifficulty=difficultyForGameDate('korony',dateKey);
  if(dateKey<CROWNS_EASIER_FROM)return{seed:dailyPuzzleSeed('korony',dateKey),version:1,difficulty:previousDifficulty};
  const previousId=`figlo:korony:${dateKey}:v2`;
  if(challengeId===previousId){
    const difficulty={easy:'easy',medium:'easy',hard:'medium'}[previousDifficulty]||'medium';
    return{seed:previousId,version:2,difficulty};
  }
  return{seed:`figlo:korony:${dateKey}:v3`,version:3,difficulty:'gentle'};
}
