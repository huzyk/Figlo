const KEY='figlo_zip_session_v1';
export function createZipSession({date,seed}={}){return{date,seed,path:[],history:[],elapsedMs:0,runningSince:null,startedAt:null,finished:false,hintsUsed:0};}
function clean(raw,{date,seed}){if(!raw||raw.date!==date||raw.seed!==seed)return createZipSession({date,seed});return{...createZipSession({date,seed}),...raw,path:Array.isArray(raw.path)?raw.path.map(Number):[],history:Array.isArray(raw.history)?raw.history.filter(Array.isArray).map(path=>path.map(Number)):[],elapsedMs:Number(raw.elapsedMs)||0,runningSince:Number.isFinite(Number(raw.runningSince))?Number(raw.runningSince):null,hintsUsed:Number(raw.hintsUsed)||0};}
export function loadZipSession({date,seed}){try{return clean(JSON.parse(localStorage.getItem(KEY)||'null'),{date,seed});}catch{return createZipSession({date,seed});}}
export function saveZipSession(session){try{localStorage.setItem(KEY,JSON.stringify(session));return true;}catch{return false;}}
export function clearZipSession(){try{localStorage.removeItem(KEY);}catch{}}
