import {generateBloki} from './generator.js';
import {solve} from './solver.js';

export function generateBlokiWithSolutionAsync(options){
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
