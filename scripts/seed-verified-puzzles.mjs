// Run on a trusted machine or GitHub Actions. NEVER bundle this in GitHub Pages.
// Dry run validates puzzles. --upload requires server secrets and only inserts
// missing records; existing verified puzzles are immutable.
import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {figloDateKey} from '../src/daily.js';
import {requiredGamesForDate} from '../src/daily-games.js';
import {getDailyGame} from '../src/services/daily-service.js';
import {crownDailyConfig} from '../src/korony/difficulty.js';
import {generatePuzzle} from '../src/generator.js';
import {targetSeconds} from '../src/domain/seasonal-scoring.js';
import {difficultyForGameDate} from '../src/difficulty-schedule.js';

export function parseArgs(argv) {
  const options={start:figloDateKey(),days:7,upload:false};
  for(let i=0;i<argv.length;i++){
    if(argv[i]==='--start')options.start=argv[++i];
    else if(argv[i]==='--days')options.days=Number(argv[++i]);
    else if(argv[i]==='--upload')options.upload=true;
    else throw new Error('Unknown option');
  }
  if(!/^\d{4}-\d{2}-\d{2}$/.test(options.start)||
    Number.isNaN(Date.parse(options.start+'T12:00:00Z'))||
    new Date(options.start+'T12:00:00Z').toISOString().slice(0,10)!==options.start||
    !Number.isInteger(options.days)||options.days<1||options.days>31)throw new Error('Invalid date or range (1-31 days)');
  return options;
}
export function plusDays(dateKey,offset) {
  const d=new Date(dateKey+'T12:00:00Z');
  d.setUTCDate(d.getUTCDate()+offset);
  return d.toISOString().slice(0,10);
}
export async function makeCanonicalRecord(gameId,dateKey){
  let rec;
  if(gameId==='duet'){
    rec=JSON.parse(await readFile(new URL('../data/duet/'+dateKey+'.json',import.meta.url),'utf8'));
    if(rec.game!=='duet'||rec.date!==dateKey||!rec.puzzleId)throw new Error('Invalid Duet asset');
  }else if(gameId==='korony'){
    const {seed,difficulty}=crownDailyConfig(dateKey);
    const built=generatePuzzle(seed,{difficulty});
    rec={puzzleId:seed,solution:built.solution,difficulty};
  }else rec=await getDailyGame(gameId,dateKey);
  if(!Array.isArray(rec.solution)||!rec.solution.length||!rec.puzzleId)throw new Error('Missing canonical solution '+gameId);
  const difficulty=typeof rec.difficulty==='string' ? rec.difficulty :
    rec.requestedDifficulty||difficultyForGameDate(gameId,dateKey);
  return {puzzle_id:rec.puzzleId,puzzle_date:dateKey,game_id:gameId,
    difficulty,target_seconds:targetSeconds(gameId,difficulty),solution:rec.solution};
}
export async function seedVerifiedPuzzles(argv=process.argv.slice(2),env=process.env) {
  const options=parseArgs(argv);
  let client=null,count=0,existing=0;
  if(options.upload){
    if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Missing Supabase credentials');
    const url=new URL(env.SUPABASE_URL);
    if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co'))throw new Error('Untrusted Supabase URL');
    client=createClient(url.href,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  }
  for(let day=0;day<options.days;day++){
    const date=plusDays(options.start,day);
    for(const game of requiredGamesForDate(date)){
      const record=await makeCanonicalRecord(game,date);
      if(client){
        const {data,error}=await client.from('puzli_puzzles')
          .select('puzzle_id,solution,target_seconds,difficulty')
          .eq('puzzle_date',date).eq('game_id',game).maybeSingle();
        if(error)throw new Error('Cannot read puzzle slot '+date+'/'+game);
        if(data){
          // NEVER silently replace a puzzle after players have started.
          if(data.puzzle_id!==record.puzzle_id||
            JSON.stringify(data.solution)!==JSON.stringify(record.solution)||
            data.target_seconds!==record.target_seconds||data.difficulty!==record.difficulty)
            throw new Error('Published daily puzzle changed: '+date+'/'+game);
          existing++;continue;
        }
        const {error:insertError}=await client.from('puzli_puzzles').insert(record);
        if(insertError)throw new Error('Cannot seed puzzle '+date+'/'+game);
      }
      count++;
    }
  }
  // No solution JSONs, tokens or keys in logs.
  console.log('PUZLI verified puzzles OK: '+options.start+' / '+options.days+
    ' day(s), '+(options.upload?'inserted ':'validated ')+count+', preserved '+existing);
  return {count,existing,upload:options.upload};
}
if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href) await seedVerifiedPuzzles();
