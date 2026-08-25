import{generateLatarnie}from'./generator.js';
self.addEventListener('message',event=>{try{self.postMessage({ok:true,result:generateLatarnie(event.data||{})});}catch(error){self.postMessage({ok:false,error:error?.message||String(error)});}});
