import { GA4_MEASUREMENT_ID } from './analytics-config.js';
import { setAnalyticsAdapter, track } from './analytics-service.js';
import { toGA4Event, visitEvents } from './analytics-metrics.js';
import { currentDateKey } from '../daily.js';

const CONSENT_KEY = 'puzli_analytics_consent_v1';
const FIRST_DAY_KEY = 'puzli_analytics_first_day_v1';
const LAST_DAY_KEY = 'puzli_analytics_last_day_v1';
const SENT_KEY = 'puzli_analytics_sent_v1';
const configured = /^G-[A-Z0-9]{6,}$/.test(GA4_MEASUREMENT_ID);
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
let enabled = false;
let banner = null;

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}
function remove(key) {
  try { localStorage.removeItem(key); } catch {}
}
function removeGaCookies() {
  const names = document.cookie.split(';').map(cookie => cookie.trim().split('=')[0]);
  for (const name of names) {
    if (!/^_ga(?:_|$)/.test(name)) continue;
    document.cookie = name + '=; Max-Age=0; path=/; SameSite=Lax';
    document.cookie = name + '=; Max-Age=0; path=/; domain=' + location.hostname + '; SameSite=Lax';
  }
}
function sendUnique(event, normalized) {
  const { eventName, payload = {} } = event;
  const unique = eventName === 'game_started'
    || (eventName === 'game_completed' && payload.mode === 'daily')
    || eventName === 'daily_completed';
  if (!unique) return true;
  const key = [eventName, payload.gameId || 'all', payload.mode || 'daily',
    payload.date || currentDateKey(), payload.puzzleId || ''].join(':');
  let sent = {};
  try { sent = JSON.parse(read(SENT_KEY) || '{}') || {}; } catch {}
  if (Object.hasOwn(sent, key)) return false;
  sent[key] = Date.now();
  const entries = Object.entries(sent).sort((a,b) => b[1] - a[1]).slice(0,250);
  write(SENT_KEY, JSON.stringify(Object.fromEntries(entries)));
  return true;
}

function emitVisit() {
  const today = currentDateKey();
  const firstDay = read(FIRST_DAY_KEY);
  const lastDay = read(LAST_DAY_KEY);
  const events = visitEvents({ firstDay, lastDay, today });
  if (!events.length) return;
  if (!firstDay) write(FIRST_DAY_KEY, today);
  write(LAST_DAY_KEY, today);
  for (const eventName of events) track(eventName, { date: today });
}

function startGA4() {
  if (enabled || !configured || isLocal) return;
  enabled = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA4_MEASUREMENT_ID, { send_page_view: true });
  setAnalyticsAdapter(event => {
    const normalized = toGA4Event(event);
    if (!normalized || !sendUnique(event, normalized)) return;
    window.gtag('event', normalized.name, normalized.params);
  });
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_MEASUREMENT_ID);
  document.head.appendChild(script);
  emitVisit();
}

function currentPageOpened() {
  const gameId = location.pathname.split('/').pop()?.replace('.html', '');
  if (['korony', 'duet', 'bloki', 'latarnie', 'zip'].includes(gameId)) {
    track('game_opened', { gameId, mode: document.documentElement.dataset.gameMode || 'daily', date: currentDateKey() });
  } else {
    track('home_opened', { date: currentDateKey() });
  }
}

function hideBanner() {
  banner?.remove();
  banner = null;
}

function setConsent(choice) {
  write(CONSENT_KEY, choice);
  hideBanner();
  if (choice === 'accepted') {
    startGA4();
    currentPageOpened();
    return;
  }
  enabled = false;
  setAnalyticsAdapter(null);
  removeGaCookies();
  remove(SENT_KEY);
  remove(FIRST_DAY_KEY);
  remove(LAST_DAY_KEY);
}

function showBanner() {
  if (banner) return;
  banner = document.createElement('section');
  banner.className = 'analytics-consent';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Ustawienia statystyk');
  banner.innerHTML = '<p><strong>Statystyki PUZLI</strong><span>Za Twoją zgodą używamy Google Analytics do sprawdzania, które gry są najchętniej wybierane i czy gracze wracają. Możesz odmówić lub później zmienić decyzję.</span></p><div><button type="button" data-choice="declined">Bez statystyk</button><button type="button" data-choice="accepted">Włącz statystyki</button></div>';
  banner.addEventListener('click', event => {
    const choice = event.target.closest('button[data-choice]')?.dataset.choice;
    if (choice) setConsent(choice);
  });
  document.body.appendChild(banner);
}

function initialize() {
  const settings = document.querySelector('#analyticsSettings');
  if (!configured || isLocal) {
    if (settings) settings.hidden = true;
    return;
  }
  if (settings) {
    settings.hidden = false;
    settings.addEventListener('click', showBanner);
  }
  const consent = read(CONSENT_KEY);
  if (consent === 'accepted') startGA4();
  else if (consent !== 'declined') showBanner();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
else initialize();
