const PREFIX='figlo-latarnie-session-v1:';
export function createLatarnieSession({date,seed}){return{date,seed,bulbs:[],crosses:[],history:[],elapsedMs:0,runningSince:null,startedAt:null,finished:false,hintsUsed:0};}
export function loadLatarnieSession({date,seed}){try{const raw=localStorage.getItem(`${PREFIX}${date}`);if(!raw)return null;const parsed=JSON.parse(raw);return parsed.seed===seed?parsed:null;}catch{return null;}}
export function saveLatarnieSession(session){localStorage.setItem(`${PREFIX}${session.date}`,JSON.stringify(session));}
export function clearLatarnieSession(date){localStorage.removeItem(`${PREFIX}${date}`);}
