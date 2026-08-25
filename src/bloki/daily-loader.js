import {dailyPuzzleSeed} from '../daily.js';
import {puzzleIdFor} from '../domain/completion.js';
import {generateBloki} from './generator.js';

function generateBlokiAsync(options){
  if(typeof Worker!=='function')return Promise.resolve(generateBloki(options));
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./generator-worker.js',import.meta.url),{type:'module'});
    const cleanup=()=>worker.terminate();
    worker.addEventListener('message',event=>{
      cleanup();
      if(event.data?.ok)resolve(event.data.puzzle);
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
  const puzzle=await generateBlokiAsync({seed:dailyPuzzleSeed('bloki',dateKey),difficulty:'medium'});
  return{game:'bloki',date:dateKey,version,puzzleId:puzzleIdFor('bloki',dateKey,version),puzzle};
}
