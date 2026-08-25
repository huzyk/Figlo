import{dailyPuzzleSeed}from'../daily.js';
import{difficultyForGameDate}from'../difficulty-schedule.js';
import{puzzleIdFor}from'../domain/completion.js';
import{generateLatarnieAsync}from'./generator-async.js';
export async function loadLatarnieDaily(dateKey){const difficulty=difficultyForGameDate('latarnie',dateKey);const seed=dailyPuzzleSeed('latarnie',dateKey);const generated=await generateLatarnieAsync({seed,difficulty});const version=1;return{game:'latarnie',date:dateKey,version,puzzleId:puzzleIdFor('latarnie',dateKey,version),puzzle:generated.puzzle,solution:generated.solution,difficultyScore:generated.difficultyScore};}
