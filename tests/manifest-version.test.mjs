import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { getDailyManifest } from '../src/services/daily-service.js';
import { dailyPuzzleSeed } from '../src/daily.js';

test('manifest identifies actual versions and marks missing daily content unavailable', async () => {
  const record=JSON.parse(await fs.readFile(new URL('../data/duet/2026-10-15.json',import.meta.url),'utf8'));
  const fetchImpl=async url=>String(url).includes('/duet/')||String(url).startsWith('data/duet/')
    ? {ok:true,json:async()=>record} : {ok:false};
  const manifest=await getDailyManifest('2026-10-15',{fetchImpl});
  const games=Object.fromEntries(manifest.games.map(game=>[game.id,game]));
  assert.equal(games.korony.puzzleId,dailyPuzzleSeed('korony','2026-10-15'));
  assert.equal(games.sudoku.puzzleId,'sudoku:2026-10-15:v2');
  assert.equal(games.zip.puzzleId,'zip:2026-10-15:v2');
  assert.equal(games.duet.puzzleId,record.puzzleId);
  const missing=await getDailyManifest('2026-10-15',{fetchImpl:async()=>({ok:false})});
  assert.deepEqual(missing.games.find(game=>game.id==='duet'),{id:'duet',puzzleId:null,available:false});
});
