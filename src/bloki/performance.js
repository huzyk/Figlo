const board = document.querySelector('.bloki-board');

if (board) {
  let lastAllowedMove = 0;
  const minFrameMs = 20;

  board.addEventListener('pointermove', event => {
    const now = performance.now();
    if (now - lastAllowedMove < minFrameMs) {
      event.stopImmediatePropagation();
      return;
    }
    lastAllowedMove = now;
  }, { capture: true, passive: true });
}
