// Public configuration only. NEVER put service_role, OAuth secrets or SMTP credentials here.
// Owner supplied public Supabase project settings and Turnstile site key on 2026-10-20.
// Google-only small beta; OAuth and RLS must still be manually smoke-tested with two identities.
export const accountConfig = Object.freeze({
  enabled: true,
  url: 'https://ngilfxzwlfkjpqylocxw.supabase.co',
  publishableKey: 'sb_publishable_JZ1XL1hCOU70BXZ4q6HZFQ_ypX0CpnS',
  providers: ['google'], // Facebook not yet configured
  emailOtpEnabled: false, // OTP stays disabled until dedicated SMTP and templates are ready
  passwordAuthEnabled: true, // SMTP required for emails to addresses outside the Supabase team
  turnstileSiteKey: '0x4AAAAAAFdn13n2nJqdnyhd',
});
