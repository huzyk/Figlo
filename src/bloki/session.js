const PREFIX='figlo-bloki-session-v1:';
export function createBlokiSession({date,seed}){return{date,seed,placements:[],history:[],elapsedMs:0,runningSince:null,startedAt:null,finished:false,hintsUsed:0};}
function clonePlacements(items=[]){return items.map(item=>({clueId:item.clueId,rect:{...item.rect}}));}
export function restoreOrCreateBlokiSession({date,seed}){const key=PREFIX+date;try{const raw=JSON.parse(localStorage.getItem(key)||'null');if(raw?.date===date&&raw?.seed===seed){return{...createBlokiSession({date,seed}),...raw,placements:clonePlacements(raw.placements),history:(raw.history||[]).map(clonePlacements)};}}catch{}return createBlokiSession({date,seed});}
export function saveBlokiSession(session){const copy={...session,placements:clonePlacements(session.placements),history:(session.history||[]).map(clonePlacements)};localStorage.setItem(PREFIX+session.date,JSON.stringify(copy));return copy;}
export function clearBlokiSession(date){localStorage.removeItem(PREFIX+date);}
