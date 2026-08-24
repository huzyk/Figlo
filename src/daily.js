export function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dailyPuzzleSeed(gameId, dateKey = localDateKey()) {
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
