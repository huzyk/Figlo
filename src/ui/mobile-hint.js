/**
 * A readable mobile explanation displayed beneath the puzzle board.
 * Desktop retains the original hint card. No scrollIntoView or page scrolling.
 */
export function showMobileHint(feedback,{reason,action,onClose}={}){
  if(!matchMedia('(max-width: 767px)').matches||!feedback)return false;
  if(!feedback.classList.contains('hint-feedback')){
    feedback.dataset.beforeHint=feedback.textContent;
  }
  feedback.className='feedback hint-feedback';
  feedback.setAttribute('aria-live','polite');
  const heading=document.createElement('div');
  heading.className='mobile-hint-title';
  const label=document.createElement('span');
  label.textContent='✦ Podpowiedź';
  const close=document.createElement('button');
  close.type='button';
  close.className='mobile-hint-close';
  close.setAttribute('aria-label','Zamknij podpowiedź');
  close.textContent='×';
  close.addEventListener('click',()=>{dismissMobileHint(feedback);onClose?.();});
  heading.append(label,close);
  feedback.replaceChildren(heading);
  if(reason){
    const paragraph=document.createElement('p');
    paragraph.className='mobile-hint-copy';
    paragraph.textContent=String(reason);
    feedback.appendChild(paragraph);
  }
  if(action){
    const paragraph=document.createElement('p');
    paragraph.className='mobile-hint-copy mobile-hint-action';
    const strong=document.createElement('strong');
    strong.textContent='Co zrobić: ';
    paragraph.appendChild(strong);
    paragraph.appendChild(document.createTextNode(String(action)));
    feedback.appendChild(paragraph);
  }
  return true;
}
export function dismissMobileHint(feedback){
  if(!feedback?.classList.contains('hint-feedback'))return;
  const previous=feedback.dataset.beforeHint;
  delete feedback.dataset.beforeHint;
  feedback.classList.remove('hint-feedback');
  feedback.textContent=previous??'';
}
