const IDENTITY_KEY = 'figlo_identity_v1';

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getIdentity() {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.localId) return parsed;
    }
  } catch {}
  const identity = { type: 'anonymous', localId: uuid(), createdAt: new Date().toISOString(), lastUpdatedAt: new Date().toISOString() };
  try { localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity)); } catch {}
  return identity;
}

export { IDENTITY_KEY };
