import {snapshotSessionTimer} from '../ui/session-timer.js';
const PREFIX='figlo-latarnie-session-v1:';
const count=value=>Number.isFinite(value)?Math.max(0,Math.floor(value)):0;
const validCells=items=>Array.isArray(items)&&items.every(index=>Number.isInteger(index)&&index>=0);
const validBoard=board=>board&&validCells(board.bulbs)&&validCells(board.crosses);
const cloneBoard=board=>({bulbs:[...board.bulbs],crosses:[...board.crosses]});
export function createLatarnieSession({date,seed}){return{date,seed,bulbs:[],crosses:[],history:[],elapsedMs:0,runningSince:null,startedAt:null,finished:false,hintsUsed:0,resets:0};}
export function loadLatarnieSession({date,seed}){
  try{
    const parsed=JSON.parse(localStorage.getItem(PREFIX+date)||'null');
    if(parsed?.date!==date||parsed.seed!==seed||!validBoard(parsed))return null;
    return{...createLatarnieSession({date,seed}),...parsed,...cloneBoard(parsed),
      history:Array.isArray(parsed.history)?parsed.history.slice(-100).filter(validBoard).map(cloneBoard):[],
      elapsedMs:count(parsed.elapsedMs),runningSince:null,hintsUsed:count(parsed.hintsUsed),resets:count(parsed.resets)};
  }catch{return null;}
}
export function saveLatarnieSession(session){
  try{
    const copy={...snapshotSessionTimer(session),...cloneBoard(session),history:session.history.slice(-100).map(cloneBoard)};
    localStorage.setItem(PREFIX+session.date,JSON.stringify(copy));
    return true;
  }catch{return false;}
}
export function clearLatarnieSession(date){try{localStorage.removeItem(PREFIX+date);}catch{}}

