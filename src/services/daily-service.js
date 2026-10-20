import{buildSudokuPuzzle}from'../sudoku/engine.js';
import{loadDuetDaily}from'../duet/daily-loader.js';
import{loadBlokiDaily}from'../bloki/daily-loader.js';
import{loadLatarnieDaily}from'../latarnie/daily-loader.js';
import{loadZipDaily}from'../zip/daily-loader.js';
import{requiredGamesForDate}from'../daily-games.js';
import{packForDate,makeDeck}from'../memory/core.js';
import{puzzleIdFor}from'../domain/completion.js';
import{crownDailyConfig}from'../korony/difficulty.js';
export async function getDailyGame(gameId,dateKey){if(gameId==='duet'){const record=await loadDuetDaily(dateKey);return{...record,puzzleId:record.puzzleId||puzzleIdFor('duet',dateKey,record.version||1)};}if(gameId==='bloki'){const record=await loadBlokiDaily(dateKey);return{...record,puzzleId:record.puzzleId||puzzleIdFor('bloki',dateKey,record.version||1)};}if(gameId==='latarnie'){const record=await loadLatarnieDaily(dateKey);return{...record,puzzleId:record.puzzleId||puzzleIdFor('latarnie',dateKey,record.version||1)};}if(gameId==='memory'){const pack=packForDate(dateKey);return {game:'memory',date:dateKey,version:1,packId:pack.id,puzzleId:puzzleIdFor('memory',dateKey,1),puzzle:{symbols:pack.symbols},solution:makeDeck('daily:'+dateKey,pack.symbols)};}if(gameId==='zip'){const record=await loadZipDaily(dateKey);return{...record,puzzleId:record.puzzleId||puzzleIdFor('zip',dateKey,record.version||1)};}if(gameId==='sudoku'){const record=buildSudokuPuzzle('puzli:sudoku:'+dateKey+':v2',{givens:18});return{...record,date:dateKey,puzzleId:puzzleIdFor('sudoku',dateKey,2),version:2};}if(gameId==='korony'){const {seed,version}=crownDailyConfig(dateKey);return{game:'korony',date:dateKey,version,puzzleId:seed};}throw new Error(`Nieznana gra Daily: ${gameId}`);}
// Version comes from the actual record; never invent v1 for a newer puzzle.
export async function getDailyManifest(dateKey,{fetchImpl=globalThis.fetch}={}) {
  const activeGames=requiredGamesForDate(dateKey);
  let supplied=[];
  if(typeof fetchImpl==='function') {
    try {
      const response=await fetchImpl(`data/daily/${dateKey}.json`,{cache:'no-store'});
      if(response.ok) {
        const data=await response.json();
        if(data?.date===dateKey && Array.isArray(data.games)) supplied=data.games;
      }
    } catch {}
  }
  const games=await Promise.all(activeGames.map(async id=>{
    const metadata=supplied.find(game=>game.id===id)||{};
    if(id==='duet') {
      try {
        const record=await loadDuetDaily(dateKey,{fetchImpl});
        return {id,puzzleId:record.puzzleId||puzzleIdFor(id,dateKey,record.version),available:metadata.available!==false};
      } catch {return {id,puzzleId:null,available:false};}
    }
    const version=['zip','sudoku'].includes(id)?2:1;
    return {id,puzzleId:id==='korony'?crownDailyConfig(dateKey).seed:puzzleIdFor(id,dateKey,version),available:metadata.available!==false};
  }));
  return {date:dateKey,games};
}
