import{currentDateKey}from'../daily.js';
import{loadFigloState}from'../storage.js';
import{getGameMode}from'./game-mode.js';
const GAME_META={korony:{name:'Korony',title:'Korony ukończone!',href:'korony.html'},duet:{name:'Duet',title:'Duet ukończony!',href:'duet.html'},bloki:{name:'Bloki',title:'Bloki ukończone!',href:'bloki.html'},latarnie:{name:'Latarnie',title:'Latarnie ukończone!',href:'latarnie.html'},zip:{name:'Zip',title:'Zip ukończony!',href:'zip.html'},sudoku:{name:'Sudoku',title:'Sudoku ukończone!',href:'sudoku.html'}};
function gameIdFromPath(){const file=location.pathname.split('/').pop()||'';if(file.startsWith('korony'))return'korony';if(file.startsWith('duet'))return'duet';if(file.startsWith('bloki'))return'bloki';if(file.startsWith('latarnie'))return'latarnie';if(file.startsWith('zip'))return'zip';if(file.startsWith('sudoku'))return'sudoku';return null;}
function progressFor(state){const required=Array.isArray(state?.daily?.requiredGames)?state.daily.requiredGames:[];const completedSet=new Set(Array.isArray(state?.daily?.completedGames)?state.daily.completedGames:[]);const completed=required.filter(id=>completedSet.has(id)).length;return{required,completedSet,completed,total:required.length};}
function nextUnfinished(progress,currentGameId){return progress.required.find(id=>id!==currentGameId&&!progress.completedSet.has(id))||null;}
function ensureElement(root,selector,tag,className,beforeSelector){let element=root.querySelector(selector);if(element)return element;element=document.createElement(tag);element.className=className;element.setAttribute(selector.replace(/^\[|\]$/g,''),'');const before=beforeSelector?root.querySelector(beforeSelector):null;if(before)before.before(element);else root.appendChild(element);return element;}
function elementsFor(root,gameId){const title=root.querySelector('#doneTitle'),time=root.querySelector('#finalTime'),best=root.querySelector(gameId==='korony'?'#modalBest':'#bestTime'),primary=root.querySelector('#backToSet')||root.querySelector('a'),secondary=root.querySelector(gameId==='korony'?'#nextPuzzle':'#replay');const eyebrow=ensureElement(root,'[data-completion-eyebrow]','span','completion-eyebrow','#doneTitle'),copy=ensureElement(root,'[data-completion-copy]','p','completion-copy','.completion-stats'),progress=ensureElement(root,'[data-completion-progress]','div','completion-progress','.completion-stats');return{title,time,best,primary,secondary,eyebrow,copy,progress};}
export function buildCompletionView({state,gameId,mode}){const meta=GAME_META[gameId],progress=progressFor(state);if(mode!=='daily')return{eyebrow:'TRENING',title:meta?.title||'Ukończone!',copy:'Dobra robota. Tryb treningowy nie wpływa na dzisiejszy zestaw.',progress:null,primaryLabel:'Wróć do dzisiejszego zestawu',primaryHref:'index.html#gry',secondaryLabel:'Nowa plansza treningowa'};const next=nextUnfinished(progress,gameId),dayDone=progress.total>0&&progress.completed>=progress.total;if(dayDone)return{eyebrow:'DZISIEJSZE PUZLI',title:'Dzisiejszy zestaw ukończony!',copy:'Masz komplet na dziś.',progress:`${progress.completed}/${progress.total}`,primaryLabel:'Wróć do dzisiejszego zestawu',primaryHref:'index.html#gry',secondaryLabel:'Nowa plansza treningowa'};return{eyebrow:'GRA UKOŃCZONA',title:meta?.title||'Ukończone!',copy:`Zostało jeszcze ${Math.max(0,progress.total-progress.completed)} z dzisiejszego zestawu.`,progress:progress.total?`${progress.completed}/${progress.total}`:null,primaryLabel:next?`Graj dalej: ${GAME_META[next]?.name||next}`:'Wróć do dzisiejszego zestawu',primaryHref:next?GAME_META[next]?.href||'index.html#gry':'index.html#gry',secondaryLabel:'Nowa plansza treningowa'};}
export function refreshCompletion(root=document.querySelector('#done')){const gameId=gameIdFromPath();if(!root||!gameId)return null;const state=loadFigloState(currentDateKey()),view=buildCompletionView({state,gameId,mode:getGameMode()}),elements=elementsFor(root,gameId);const mode=getGameMode();if(elements.eyebrow)elements.eyebrow.textContent=view.eyebrow;if(elements.title)elements.title.textContent=view.title;if(elements.copy)elements.copy.textContent=view.copy;if(elements.progress){elements.progress.hidden=!view.progress;elements.progress.textContent=view.progress||'';}if(elements.primary){elements.primary.textContent=view.primaryLabel;elements.primary.href=view.primaryHref;elements.primary.classList.add('completion-primary');}if(elements.secondary){elements.secondary.textContent=view.secondaryLabel;elements.secondary.classList.add('completion-secondary');}
  let rewardSummary=root.querySelector('#completionRewardSummary');
  if(!rewardSummary){
    rewardSummary=document.createElement('div');rewardSummary.id='completionRewardSummary';
    rewardSummary.className='completion-reward-summary';rewardSummary.setAttribute('aria-live','polite');
    root.querySelector('.completion-stats')?.after(rewardSummary);
  }
  rewardSummary.replaceChildren();
  rewardSummary.hidden=mode!=='daily';
  if(mode==='daily'){
    const record=state.rewards?.daily?.[state.daily.date];
    const points=record?.games?.[gameId]?.points||0;
    const pointLine=document.createElement('strong');pointLine.textContent='+'+points+' pkt PUZLI';
    rewardSummary.appendChild(pointLine);
    const supplement=document.createElement('span');
    const hints=record?.games?.[gameId]?.hintsUsed;
    supplement.textContent=points===120?'Samodzielnie: +20 pkt premii':hints>0?'Rozwiązane z podpowiedzią':'Za ukończoną grę';
    rewardSummary.appendChild(supplement);
    if(state.rewards?.lastAward?.date===state.daily.date && state.rewards.lastAward.gameId===gameId && state.rewards.lastAward.badges?.length){
      const badge=document.createElement('span');badge.className='completion-new-badge';
      badge.textContent='Nowa odznaka: '+state.rewards.lastAward.badges.join(', ');
      rewardSummary.appendChild(badge);
    }
    if(progressFor(state).completed===progressFor(state).total && record?.bonus){
      const full=document.createElement('span');full.textContent='Pełny komplet: +80 pkt!';
      rewardSummary.appendChild(full);
    }
  }
  let rewardsLink=root.querySelector('#completionRewardsLink');
  if(!rewardsLink){rewardsLink=document.createElement('a');rewardsLink.id='completionRewardsLink';rewardsLink.className='completion-rewards-link';rewardsLink.textContent='PUZLI IQ, odznaki i udostępnianie ↗';root.querySelector('.completion-card')?.appendChild(rewardsLink);}
  rewardsLink.href='index.html#rywalizacja';rewardsLink.hidden=getGameMode()!=='daily';if(gameId==='korony'&&elements.time)elements.time.textContent=elements.time.textContent.replace(/^Czas\s+/i,'');return view;}
function modalIsVisible(root){return Boolean(root&&!root.hidden);}function init(){const root=document.querySelector('#done');if(!root)return;const observer=new MutationObserver(()=>{if(modalIsVisible(root))queueMicrotask(()=>refreshCompletion(root));});observer.observe(root,{attributes:true,attributeFilter:['hidden']});if(modalIsVisible(root))refreshCompletion(root);}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
