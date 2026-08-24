const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function duetDailyPath(dateKey) {
  if (!DATE_RE.test(String(dateKey || ''))) {
    throw new Error(`Nieprawidłowa data Duetu: ${dateKey}`);
  }
  return `data/duet/${dateKey}.json`;
}

export function duetDailyUrl(dateKey) {
  const path = duetDailyPath(dateKey);
  return new URL(`../../${path}`, import.meta.url).href;
}

export function validateDuetDailyRecord(record, expectedDate = null) {
  if (!record || typeof record !== 'object') return false;
  if (!DATE_RE.test(String(record.date || ''))) return false;
  if (expectedDate && record.date !== expectedDate) return false;
  if (record.game !== 'duet') return false;
  if (!Number.isInteger(record.version) || record.version < 1) return false;
  if (!record.puzzle || !Array.isArray(record.solution)) return false;
  if (record.solution.length !== 36) return false;
  if (!Array.isArray(record.puzzle.givens) || !Array.isArray(record.puzzle.relations)) return false;
  return true;
}

async function fetchRecord(url, fetchImpl) {
  const response = await fetchImpl(url, { cache: 'no-store' });
  if (!response.ok) return { ok: false, status: response.status };
  return { ok: true, record: await response.json() };
}

export async function loadDuetDaily(dateKey, { fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Brak fetch do pobrania Daily Duetu.');

  const primaryUrl = duetDailyUrl(dateKey);
  let result;
  try {
    result = await fetchRecord(primaryUrl, fetchImpl);
  } catch (error) {
    result = { ok: false, error };
  }

  // Fallback keeps local/dev servers and older relative hosting layouts working.
  if (!result.ok) {
    try {
      result = await fetchRecord(duetDailyPath(dateKey), fetchImpl);
    } catch (error) {
      result = { ok: false, error };
    }
  }

  if (!result.ok) {
    throw new Error(`Brak wygenerowanej planszy Duetu dla ${dateKey}${result.status ? ` (${result.status})` : ''}.`);
  }

  if (!validateDuetDailyRecord(result.record, dateKey)) {
    throw new Error(`Nieprawidłowy rekord Daily Duetu dla ${dateKey}.`);
  }
  return result.record;
}
