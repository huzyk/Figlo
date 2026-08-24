let adapter = null;

export function setAnalyticsAdapter(nextAdapter) {
  adapter = typeof nextAdapter === 'function' ? nextAdapter : null;
}

export function track(eventName, payload = {}) {
  const event = { eventName, payload, occurredAt: new Date().toISOString() };
  if (adapter) {
    try { adapter(event); } catch (error) { console.warn('analytics adapter failed', error); }
  }
  return event;
}
