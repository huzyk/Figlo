import { generateDuetPuzzle } from './generator.js';

export function generateDuetPuzzleAsync(seed){
  if(typeof Worker!=='function')return Promise.resolve(generateDuetPuzzle(seed));
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./freeplay-worker.js',import.meta.url),{type:'module'});
    const cleanup=()=>worker.terminate();
    worker.addEventListener('message',event=>{
      cleanup();
      if(event.data?.ok)resolve(event.data.generated);
      else reject(new Error(event.data?.error||'Duet worker generation failed'));
    },{once:true});
    worker.addEventListener('error',event=>{
      cleanup();
      reject(event.error||new Error(event.message||'Duet worker generation failed'));
    },{once:true});
    worker.postMessage({seed});
  });
}
