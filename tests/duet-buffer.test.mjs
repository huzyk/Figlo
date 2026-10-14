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

test('daily publication stages newly generated files before checking for changes', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'duet-publish-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git('init');
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '--allow-empty', '-m', 'initial');
  await fs.mkdir(path.join(directory, 'data/duet'), { recursive: true });
  await fs.writeFile(path.join(directory, 'data/duet/new.json'), '{}');
  // The former check reports no changes even though a new puzzle exists.
  git('diff', '--quiet', '--', 'data/duet');
  const workflow = await fs.readFile(new URL('../.github/workflows/generate-duet-daily.yml', import.meta.url), 'utf8');
  const publish = workflow.split('      - name: Commit generated daily assets')[1].split('        run: |\n')[1].split('\n').map(line => line.replace(/^          /, '')).join('\n');
  // Replace only network publishing; execute the actual workflow's commit logic.
  execFileSync('bash', ['-e', '-c', publish.replace('git push', 'git status --porcelain')], { cwd: directory });
  assert.equal(git('show', 'HEAD:data/duet/new.json'), '{}');
  const head = git('rev-parse', 'HEAD');
  execFileSync('bash', ['-e', '-c', publish.replace('git push', 'git status --porcelain')], { cwd: directory });
  assert.equal(git('rev-parse', 'HEAD'), head);
});
