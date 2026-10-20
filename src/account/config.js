// Public configuration only. NEVER put service_role, OAuth secrets or SMTP credentials here.
// Owner supplied public Supabase project settings and Turnstile site key on 2026-10-20.
// Keep accounts disabled until SQL migration, deletion, privacy and real-world OAuth/RLS tests pass.
export const accountConfig = Object.freeze({
  enabled: false,
  url: 'https://ngilfxzwlfkjpqylocxw.supabase.co',
  publishableKey: 'sb_publishable_JZ1XL1hCOU70BXZ4q6HZFQ_ypX0CpnS',
  providers: ['google'], // Facebook not yet configured
  emailOtpEnabled: false, // Enable only after dedicated SMTP and OTP templates are verified
  turnstileSiteKey: '0x4AAAAAAFdn13n2nJqdnyhd',
});
