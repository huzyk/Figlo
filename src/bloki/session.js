import {snapshotSessionTimer} from '../ui/session-timer.js';
const PREFIX='figlo-bloki-session-v1:';
const count=value=>Number.isFinite(value)?Math.max(0,Math.floor(value)):0;
export function createBlokiSession({date,seed}){return{date,seed,placements:[],history:[],elapsedMs:0,runningSince:null,startedAt:null,finished:false,hintsUsed:0,resets:0};}
function validPlacements(items){return Array.isArray(items)&&items.every(item=>item&&typeof item.clueId==='string'&&item.rect&&['row','col'].every(key=>Number.isInteger(item.rect[key])&&item.rect[key]>=0)&&['width','height'].every(key=>Number.isInteger(item.rect[key])&&item.rect[key]>0));}
function clonePlacements(items){return items.map(item=>({clueId:item.clueId,rect:{...item.rect}}));}
export function restoreOrCreateBlokiSession({date,seed}){
  try{
    const raw=JSON.parse(localStorage.getItem(PREFIX+date)||'null');
    if(raw?.date===date&&raw?.seed===seed&&validPlacements(raw.placements))return{
      ...createBlokiSession({date,seed}),...raw,
      placements:clonePlacements(raw.placements),
      history:Array.isArray(raw.history)?raw.history.slice(-100).filter(validPlacements).map(clonePlacements):[],
      elapsedMs:count(raw.elapsedMs),runningSince:null,
      hintsUsed:count(raw.hintsUsed),resets:count(raw.resets)
    };
  }catch{}
  return createBlokiSession({date,seed});
}
export function saveBlokiSession(session){
  try{
    const copy={...snapshotSessionTimer(session),placements:clonePlacements(session.placements),history:session.history.slice(-100).map(clonePlacements)};
    localStorage.setItem(PREFIX+session.date,JSON.stringify(copy));
    return copy;
  }catch{return false;}
}
export function clearBlokiSession(date){try{localStorage.removeItem(PREFIX+date);}catch{}}

