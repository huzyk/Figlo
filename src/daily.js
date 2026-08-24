export function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dateFromKey(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) return null;
  return date;
}

export function currentDateKey() {
  if (typeof location !== 'undefined') {
    const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (isLocal) {
      const debugDate = new URLSearchParams(location.search).get('date');
      if (dateFromKey(debugDate)) return debugDate;
    }
  }
  return localDateKey();
}

export function dailyPuzzleSeed(gameId, dateKey = currentDateKey()) {
  return `figlo:${gameId}:${dateKey}:v1`;
}

export function dayDifference(fromKey, toKey) {
  if (!fromKey || !toKey) return null;
  const [fy, fm, fd] = fromKey.split('-').map(Number);
  const [ty, tm, td] = toKey.split('-').map(Number);
  if (![fy, fm, fd, ty, tm, td].every(Number.isFinite)) return null;
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86400000);
}

export function getWeekDateKeys(date = new Date()) {
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const mondayOffset = (current.getDay() + 6) % 7;
  const monday = new Date(current);
  monday.setDate(current.getDate() - mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return localDateKey(day);
  });
}
