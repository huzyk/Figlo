const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function duetDailyPath(dateKey) {
  if (!DATE_RE.test(String(dateKey || ''))) {
    throw new Error(`Nieprawidłowa data Duetu: ${dateKey}`);
  }
  return `data/duet/${dateKey}.json`;
}

export function validateDuetDailyRecord(record, expectedDate = null) {
  if (!record || typeof record !== 'object') return false;
  if (!DATE_RE.test(String(record.date || ''))) return false;
  if (expectedDate && record.date !== expectedDate) return false;
  if (record.game !== 'duet') return false;
  if (record.version !== 1) return false;
  if (!record.puzzle || !Array.isArray(record.solution)) return false;
  if (record.solution.length !== 36) return false;
  if (!Array.isArray(record.puzzle.givens) || !Array.isArray(record.puzzle.relations)) return false;
  return true;
}

export async function loadDuetDaily(dateKey, { fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Brak fetch do pobrania Daily Duetu.');
  const path = duetDailyPath(dateKey);
  const response = await fetchImpl(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Brak wygenerowanej planszy Duetu dla ${dateKey} (${response.status}).`);
  const record = await response.json();
  if (!validateDuetDailyRecord(record, dateKey)) {
    throw new Error(`Nieprawidłowy rekord Daily Duetu dla ${dateKey}.`);
  }
  return record;
}
