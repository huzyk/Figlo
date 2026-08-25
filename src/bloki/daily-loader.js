import {dailyPuzzleSeed} from '../daily.js';
import {puzzleIdFor} from '../domain/completion.js';
import {generateBloki} from './generator.js';
import {solve} from './solver.js';

function generateBlokiAsync(options){
  if(typeof Worker!=='function'){
    const puzzle=generateBloki(options);
    const solution=solve(puzzle,{limit:1})[0]||null;
    return Promise.resolve({puzzle,solution});
  }
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./generator-worker.js',import.meta.url),{type:'module'});
    const cleanup=()=>worker.terminate();
    worker.addEventListener('message',event=>{
      cleanup();
      if(event.data?.ok)resolve({puzzle:event.data.puzzle,solution:event.data.solution});
      else reject(new Error(event.data?.error||'Bloki worker generation failed'));
    },{once:true});
    worker.addEventListener('error',event=>{
      cleanup();
      reject(event.error||new Error(event.message||'Bloki worker generation failed'));
    },{once:true});
    worker.postMessage(options);
  });
}

export async function loadBlokiDaily(dateKey){
  const version=1;
  const {puzzle,solution}=await generateBlokiAsync({seed:dailyPuzzleSeed('bloki',dateKey),difficulty:'medium'});
  return{game:'bloki',date:dateKey,version,puzzleId:puzzleIdFor('bloki',dateKey,version),puzzle,solution};
}
