// Resume only a round that the player has already started. History may be empty
// after Undo, so it cannot be the only signal that the timer should run.
export function resumeSessionTimer(session, now = Date.now()) {
  if (!session || session.finished) return false;
  if (!session.runningSince && !session.startedAt && !session.elapsedMs && !session.history?.length) return false;
  session.runningSince ||= now;
  return true;
}

// Persist a stopped snapshot, keeping the active in-memory clock untouched.
// Reloading after a killed browser must never include the time it was closed.
export function snapshotSessionTimer(session, now = Date.now()) {
  const elapsedMs = Number.isFinite(session.elapsedMs) ? Math.max(0, session.elapsedMs) : 0;
  const runningSince = Number(session.runningSince);
  return {
    ...session,
    elapsedMs: elapsedMs + (session.runningSince != null && Number.isFinite(runningSince) ? Math.max(0, now - runningSince) : 0),
    runningSince: null
  };
}

