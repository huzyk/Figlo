import {currentDateKey} from '../daily.js';
export function isDailyViewStale(viewDate,currentDate){
  return Boolean(viewDate && currentDate && viewDate !== currentDate);
}
export function watchDayRollover(viewDate){
  const check=()=>{
    if(document.hidden || !isDailyViewStale(viewDate,currentDateKey()))return false;
    window.location.reload();
    return true;
  };
  document.addEventListener('visibilitychange',check);
  window.addEventListener('focus',check);
  const interval=setInterval(check,30000);
  window.addEventListener('pagehide',()=>clearInterval(interval),{once:true});
  return check;
}
