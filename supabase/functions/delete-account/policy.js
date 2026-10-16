export function recentAuthentication(claims, now = Date.now() / 1000) {
  return claims?.role === 'authenticated' && claims.is_anonymous === false &&
    Array.isArray(claims.amr) && claims.amr.some(entry =>
      ['oauth', 'otp', 'email/signup'].includes(entry.method) &&
      Number.isFinite(entry.timestamp) && entry.timestamp <= now + 30 && now - entry.timestamp <= 300);
}
