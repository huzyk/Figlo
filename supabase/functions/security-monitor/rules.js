export function evaluateSignals(counts) {
  if (!counts || !['events','signups','identity_changes'].every(k => Number.isFinite(counts[k]) && counts[k] >= 0)) throw new Error('Missing security telemetry');
  const alerts = [];
  if (counts.events >= 1000) alerts.push('auth_volume');
  if (counts.signups >= 50) alerts.push('signup_spike');
  if (counts.identity_changes >= 5) alerts.push('identity_changes');
  return alerts;
}
