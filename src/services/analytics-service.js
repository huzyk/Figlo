import { recordDailyHint } from '../storage.js';
import { notifyVerifiedEvent } from './verified-session.js';
let adapter = null;

export function setAnalyticsAdapter(nextAdapter) {
  adapter = typeof nextAdapter === 'function' ? nextAdapter : null;
}

export function track(eventName, payload = {}) {
  const event = { eventName, payload, occurredAt: new Date().toISOString() };
  if (eventName === 'hint_used' && payload.mode === 'daily' && payload.gameId) {
    try { recordDailyHint(payload.gameId, payload.date); } catch (error) { console.warn('Daily hint tracking failed', error); }
  }
  notifyVerifiedEvent(eventName,payload);
  if (adapter) {
    try { adapter(event); } catch (error) { console.warn('analytics adapter failed', error); }
  }
  return event;
}
