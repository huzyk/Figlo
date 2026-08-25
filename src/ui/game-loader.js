const loader=document.querySelector('#gameLoader');
const text=document.querySelector('#gameLoaderText');
const board=document.querySelector('#board');
let waitingForBoard=true;
let mutationSeen=false;
let hideTimer=null;

function expectedCells(){
  if(board?.classList.contains('board'))return 81;
  if(board?.classList.contains('duet-board')||board?.classList.contains('bloki-board'))return 36;
  return 1;
}

function boardReady(){
  if(!board)return true;
  const selector=board.classList.contains('board')?'.cell':board.classList.contains('duet-board')?'.duet-cell':'.bloki-cell';
  return board.querySelectorAll(selector).length>=expectedCells()&&board.getAttribute('aria-busy')!=='true';
}

export function showGameLoader(message='Przygotowuję planszę…'){
  if(!loader)return;
  if(hideTimer)clearTimeout(hideTimer);
  mutationSeen=false;
  waitingForBoard=true;
  loader.hidden=false;
  loader.classList.remove('is-leaving');
  if(text)text.textContent=message;
}

export function hideGameLoader(){
  if(!loader||loader.hidden)return;
  loader.classList.add('is-leaving');
  hideTimer=setTimeout(()=>{loader.hidden=true;loader.classList.remove('is-leaving');},190);
}

function maybeHide(){
  if(!waitingForBoard||!boardReady())return;
  waitingForBoard=false;
  requestAnimationFrame(()=>requestAnimationFrame(hideGameLoader));
}

if(loader&&board){
  const mode=new URLSearchParams(location.search).get('mode');
  if(text)text.textContent=mode==='training'?'Przygotowuję planszę treningową…':'Przygotowuję dzisiejszą planszę…';
  const observer=new MutationObserver(records=>{
    if(records.some(record=>record.type==='childList'))mutationSeen=true;
    if(mutationSeen||board.getAttribute('aria-busy')!=='true')maybeHide();
  });
  observer.observe(board,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-busy']});
  document.addEventListener('click',event=>{
    const trigger=event.target.closest?.('#replay,#nextPuzzle');
    if(!trigger)return;
    showGameLoader('Przygotowuję planszę treningową…');
  },true);
  maybeHide();
}
