import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { runDuetGeneration } from '../scripts/generate-duet-daily.mjs';

const DATE = '2026-10-15';

test('Duet automation fills missing dates, preserves published records and catches corruption', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'puzli-duet-buffer-'));
  try {
    const filename = path.join(dir, DATE + '.json');
    await assert.rejects(
      runDuetGeneration(['--start', DATE, '--days', '1', '--check-only'], { outputDir: dir }),
      /brak planszy/
    );
    const first = await runDuetGeneration(
      ['--start', DATE, '--days', '1', '--skip-existing'], { outputDir: dir }
    );
    assert.equal(first.generated, 1);
    assert.equal(first.skipped, 0);

    const original = await fs.readFile(filename, 'utf8');
    const second = await runDuetGeneration(
      ['--start', DATE, '--days', '1', '--skip-existing'], { outputDir: dir }
    );
    assert.equal(second.generated, 0);
    assert.equal(second.skipped, 1);
    assert.equal(await fs.readFile(filename, 'utf8'), original);

    const checked = await runDuetGeneration(
      ['--start', DATE, '--days', '1', '--check-only'], { outputDir: dir }
    );
    assert.equal(checked.generated, 0);
    assert.equal(checked.skipped, 1);

    await fs.writeFile(filename, '{"date": "broken"}\n');
    await assert.rejects(
      runDuetGeneration(['--start', DATE, '--days', '1', '--skip-existing'], { outputDir: dir }),
      /nieprawidłowy rekord/
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('Duet buffer validates a real Gregorian calendar date and bounded horizon', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'puzli-duet-dates-'));
  try {
    await assert.rejects(
      runDuetGeneration(['--start', '2026-02-30', '--days', '1', '--check-only'], { outputDir: dir }),
      /Użycie:/
    );
    await assert.rejects(
      runDuetGeneration(['--start', DATE, '--days', '731', '--check-only'], { outputDir: dir }),
      /--days/
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
