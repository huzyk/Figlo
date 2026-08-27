import{dailyPuzzleSeed}from'../daily.js';
import{difficultyForGameDate}from'../difficulty-schedule.js';
import{puzzleIdFor}from'../domain/completion.js';
import{generateZipAsync}from'./generator-async.js';
export async function loadZipDaily(dateKey){const difficulty=difficultyForGameDate('zip',dateKey);const seed=dailyPuzzleSeed('zip',dateKey);const generated=await generateZipAsync({seed,difficulty});const version=2;return{game:'zip',date:dateKey,version,puzzleId:puzzleIdFor('zip',dateKey,version),puzzle:generated.puzzle,solution:generated.solution,difficultyScore:generated.difficultyScore};}
