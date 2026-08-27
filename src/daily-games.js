export const DUET_LAUNCH_DATE='2026-08-24';
export const BLOKI_LAUNCH_DATE='2026-08-25';
export const LATARNIE_LAUNCH_DATE='2026-08-25';
export const ZIP_LAUNCH_DATE='2026-08-28';
export function requiredGamesForDate(dateKey){const key=String(dateKey);if(key<DUET_LAUNCH_DATE)return['korony'];if(key<BLOKI_LAUNCH_DATE)return['korony','duet'];if(key<ZIP_LAUNCH_DATE)return['korony','duet','bloki','latarnie'];return['korony','duet','bloki','latarnie','zip'];}
