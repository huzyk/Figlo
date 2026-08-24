export function migrateV2ToV3(state, { identity = null } = {}) {
  if (!state || state.version !== 2) return state;
  return {
    ...state,
    version: 3,
    identity: state.identity || identity || null,
    meta: {
      ...(state.meta || {}),
      migratedFrom: 2,
      lastUpdatedAt: new Date().toISOString()
    }
  };
}
