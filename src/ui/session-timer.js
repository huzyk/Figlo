// Resume only a round that the player has already started. History may be empty
// after Undo, so it cannot be the only signal that the timer should run.
export function resumeSessionTimer(session, now = Date.now()) {
  if (!session || session.finished) return false;
  if (!session.runningSince && !session.startedAt && !session.elapsedMs && !session.history?.length) return false;
  session.runningSince ||= now;
  return true;
}
