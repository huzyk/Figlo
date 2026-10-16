import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { checkDuetBuffer } from '../scripts/check-duet-buffer.mjs';

test('buffer check detects a missing day and invalid record', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'duet-buffer-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.copyFile(new URL('../data/duet/2026-08-24.json', import.meta.url), path.join(directory, '2026-08-24.json'));
  await checkDuetBuffer({ start: '2026-08-24', days: 1, directory });
  await assert.rejects(checkDuetBuffer({ start: '2026-08-24', days: 2, directory }), /2026-08-25.*ENOENT/);
  await fs.writeFile(path.join(directory, '2026-08-25.json'), '{}');
  await assert.rejects(checkDuetBuffer({ start: '2026-08-24', days: 2, directory }), /2026-08-25.*Invalid/);
});

test('only the safe Duet generator remains and published records cannot be rebased or overwritten', async () => {
  const workflows = new URL('../.github/workflows/', import.meta.url);
  const names = await fs.readdir(workflows);
  assert.equal(names.includes('generate-duet-daily.yml'), false);
  assert.equal(names.includes('refresh-duet-today.yml'), false);
  assert.equal(names.includes('duet-daily-buffer.yml'), true);
  const content = await fs.readFile(new URL('duet-daily-buffer.yml', workflows), 'utf8');
  assert.match(content, /--skip-existing/);
  assert.match(content, /git add -- data\/duet\//);
  assert.match(content, /git fetch origin main/);
  assert.match(content, /original_head/);
  assert.match(content, /git push origin HEAD:main/);
  assert.doesNotMatch(content, /git pull --rebase|git push origin preview|--force/);
});
