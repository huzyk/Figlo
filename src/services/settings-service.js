import { loadFigloState, updateFigloSettings } from '../storage.js';

export function getSettings(dateKey) {
  return { ...loadFigloState(dateKey).settings };
}

export function updateSettings(patch) {
  return updateFigloSettings(patch).settings;
}
