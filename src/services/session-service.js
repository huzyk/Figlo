import { getCrownSession, saveCrownSession, clearCrownSession } from '../storage.js';
import { restoreOrCreateDuetSession, saveDuetSession, clearDuetSession } from '../duet/session.js';

export function getSession(gameId, options = {}) {
  if (gameId === 'korony') return getCrownSession({ today: options.date, seed: options.seed });
  if (gameId === 'duet') return restoreOrCreateDuetSession({ date: options.date, seed: options.seed, givens: options.givens || [] });
  throw new Error(`Nieznana gra session: ${gameId}`);
}

export function saveSession(gameId, session, date) {
  if (gameId === 'korony') return saveCrownSession(session, date);
  if (gameId === 'duet') return saveDuetSession(session, date);
  throw new Error(`Nieznana gra session: ${gameId}`);
}

export function clearSession(gameId, date) {
  if (gameId === 'korony') return clearCrownSession(date);
  if (gameId === 'duet') return clearDuetSession(date);
  throw new Error(`Nieznana gra session: ${gameId}`);
}
