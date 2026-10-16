export const providers = Object.freeze({google: 'Google', facebook: 'Facebook', apple: 'Apple', azure: 'Microsoft'});
export function validateConfig(config) {
  if (!config.enabled) return false;
  const url = new URL(config.url);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') || url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('Invalid auth URL');
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey)) throw new Error('Use a publishable key');
  if (!config.turnstileSiteKey || !Array.isArray(config.providers) || config.providers.some(p => !Object.hasOwn(providers, p))) throw new Error('Incomplete auth configuration');
  return true;
}
export function callbackUrl(locationHref) {
  const url = new URL('account.html', locationHref);
  url.search = ''; url.hash = '';
  return url.href;
}
export function validNickname(value) {
  return typeof value === 'string' && /^[\p{L}\p{N}_ -]{2,24}$/u.test(value);
}
