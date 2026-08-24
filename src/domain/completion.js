function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createCompletionEvent({ gameId, puzzleId, date, elapsedMs, mode = 'daily', startedAt = null, completedAt = new Date().toISOString(), clientVersion = 'web-v1', eventId = uuid() }) {
  if (!gameId || !puzzleId || !date) throw new Error('Completion event requires gameId, puzzleId and date.');
  return {
    eventId,
    gameId,
    puzzleId,
    date,
    mode,
    startedAt,
    completedAt,
    elapsedMs: Number.isFinite(elapsedMs) ? Math.max(0, Math.round(elapsedMs)) : null,
    clientVersion
  };
}

export function puzzleIdFor(gameId, date, version = 1) {
  return `${gameId}:${date}:v${version}`;
}
