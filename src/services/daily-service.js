import { loadDuetDaily } from '../duet/daily-loader.js';
import { puzzleIdFor } from '../domain/completion.js';

const FALLBACK_GAMES = ['korony', 'duet'];

export async function getDailyGame(gameId, dateKey) {
  if (gameId === 'duet') {
    const record = await loadDuetDaily(dateKey);
    return { ...record, puzzleId: record.puzzleId || puzzleIdFor('duet', dateKey, record.version || 1) };
  }
  if (gameId === 'korony') {
    return { game: 'korony', date: dateKey, version: 1, puzzleId: puzzleIdFor('korony', dateKey, 1) };
  }
  throw new Error(`Nieznana gra Daily: ${gameId}`);
}

export async function getDailyManifest(dateKey, { fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl === 'function') {
    try {
      const response = await fetchImpl(`data/daily/${dateKey}.json`, { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        if (data?.date === dateKey && Array.isArray(data.games)) return data;
      }
    } catch {}
  }
  return {
    date: dateKey,
    games: FALLBACK_GAMES.map(gameId => ({ id: gameId, puzzleId: puzzleIdFor(gameId, dateKey, gameId === 'duet' ? 1 : 1), available: true }))
  };
}
