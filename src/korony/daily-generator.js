import { generatePuzzle } from '../generator.js';

export function generateCrownDailyAsync(seed, difficulty='medium') {
  if (typeof Worker !== 'function') return Promise.resolve(generatePuzzle(seed,{difficulty}));
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./daily-generator-worker.js',import.meta.url),{type:'module'});
    const cleanup=()=>worker.terminate();
    worker.addEventListener('message',event=>{
      cleanup();
      if(event.data?.ok)resolve(event.data.puzzle);
      else reject(new Error(event.data?.error||'Korony worker generation failed'));
    },{once:true});
    worker.addEventListener('error',event=>{
      cleanup();
      reject(event.error||new Error(event.message||'Korony worker generation failed'));
    },{once:true});
    worker.postMessage({seed,difficulty});
  });
}
