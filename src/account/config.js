// Public configuration only. NEVER put service_role, OAuth secrets or SMTP credentials here.
export const accountConfig = Object.freeze({
  enabled: false,
  url: '',
  publishableKey: '',
  providers: ['google', 'facebook'], // optional: apple, azure (Microsoft)
  turnstileSiteKey: '',
});
