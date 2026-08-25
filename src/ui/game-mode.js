export function requestedGameMode() {
  return new URLSearchParams(location.search).get('mode') === 'training' ? 'training' : 'daily';
}

export function setGameMode(mode) {
  const normalized = mode === 'training' ? 'training' : 'daily';
  document.documentElement.dataset.gameMode = normalized;
  return normalized;
}

export function getGameMode() {
  return document.documentElement.dataset.gameMode === 'training' ? 'training' : 'daily';
}
