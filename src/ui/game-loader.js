const loader=document.querySelector('#gameLoader');
const text=document.querySelector('#gameLoaderText');
let hideTimer=null;

export function showGameLoader(message='Przygotowuję planszę…'){
  if(!loader)return;
  if(hideTimer){clearTimeout(hideTimer);hideTimer=null;}
  loader.classList.remove('is-leaving');
  loader.hidden=false;
  if(text)text.textContent=message;
  document.documentElement.classList.add('game-is-loading');
}

export function hideGameLoader(){
  if(!loader)return;
  if(hideTimer)clearTimeout(hideTimer);
  loader.classList.add('is-leaving');
  hideTimer=setTimeout(()=>{
    loader.hidden=true;
    loader.classList.remove('is-leaving');
    document.documentElement.classList.remove('game-is-loading');
    hideTimer=null;
  },190);
}
