// Shared visual effect used by both real results and victory-preview.html.
// It is presentation-only: no scores, navigation, audio, or input blocking.
const timers = new WeakMap();

export function playVictory(root) {
  if (!root) return false;
  const previous = timers.get(root);
  if (previous) clearTimeout(previous);
  root.classList.remove('is-celebrating');
  root.querySelector('.puzli-victory-sky')?.remove();
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return false;
  }

  const mark = root.querySelector('.success-mark');
  if (!mark) return false;
  const rootRect = root.getBoundingClientRect();
  const markRect = mark.getBoundingClientRect();
  const x = Math.round(markRect.left + markRect.width / 2 - rootRect.left + root.scrollLeft);
  const y = Math.round(markRect.top + markRect.height / 2 - rootRect.top + root.scrollTop);
  root.style.setProperty('--puzli-win-x', x + 'px');
  root.style.setProperty('--puzli-win-y', y + 'px');

  const sky = document.createElement('div');
  sky.className = 'puzli-victory-sky';
  sky.setAttribute('aria-hidden', 'true');
  sky.style.left = x + 'px';
  sky.style.top = y + 'px';

  // Two expanding shockwaves and a radial glint: visually large but lightweight.
  for (let i = 0; i < 2; i++) {
    const wave = document.createElement('span');
    wave.className = 'puzli-victory-wave wave-' + (i + 1);
    sky.append(wave);
  }
  const rays = document.createElement('span');
  rays.className = 'puzli-victory-rays';
  sky.append(rays);

  // Golden-angle distribution prevents visible rows or repeated trajectories.
  // First 32 fly outwards; the outer 16 twinkle later for a dramatic finish.
  for (let i = 0; i < 48; i++) {
    const mote = document.createElement('span');
    mote.className = 'puzli-victory-spark' + (i % 6 === 0 ? ' streak' : i % 5 === 0 ? ' star' : '');
    const angle = i * 2.399963229728653;
    const distance = i < 32 ? 130 + (i % 6) * 13 : 80 + (i % 7) * 16;
    const dx = Math.round(Math.cos(angle) * distance);
    const dy = Math.round(Math.sin(angle) * distance * .8);
    mote.style.setProperty('--spark-x', dx + 'px');
    mote.style.setProperty('--spark-y', dy + 'px');
    mote.style.setProperty('--spark-spin', ((i % 2 ? 1 : -1) * (100 + i * 13)) + 'deg');
    mote.style.setProperty('--spark-delay', (i < 32 ? 100 + (i % 8) * 22 : 390 + (i % 8) * 32) + 'ms');
    sky.append(mote);
  }
  root.append(sky);

  // Restart CSS keyframes on repeated preview playback without changing UI state.
  void root.offsetWidth;
  root.classList.add('is-celebrating');
  const timer = setTimeout(() => {
    root.classList.remove('is-celebrating');
    sky.remove();
    timers.delete(root);
  }, 2400);
  timers.set(root, timer);
  return true;
}
