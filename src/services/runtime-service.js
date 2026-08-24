import { completeDailyGame, getCrownSession, loadFigloState, saveCrownSession, clearCrownSession, updateFigloSettings } from '../storage.js';

// Compatibility facade for existing game UI. Keeps persistence behind a service boundary
// so the implementation can later switch from localStorage to API/sync without touching UI.
export { completeDailyGame, getCrownSession, loadFigloState, saveCrownSession, clearCrownSession, updateFigloSettings };
