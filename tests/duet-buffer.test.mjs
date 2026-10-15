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
  const record = JSON.parse(await fs.readFile(path.join(directory, '2026-08-24.json'), 'utf8'));
  record.puzzleId = 'duet:another-published-puzzle:v4';
  await fs.writeFile(path.join(directory, '2026-08-24.json'), JSON.stringify(record));
  await assert.rejects(checkDuetBuffer({ start: '2026-08-24', days: 1, directory }), /Invalid published puzzle identity/);
});

test('daily publication stages newly generated files before checking for changes', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'duet-publish-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const directory = path.join(root, 'work');
  const remote = path.join(root, 'remote.git');
  await fs.mkdir(directory);
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '--bare', '--initial-branch=main', remote);
  git('init', '--initial-branch=main');
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '--allow-empty', '-m', 'initial');
  git('remote', 'add', 'origin', remote);
  git('push', 'origin', 'HEAD:main');
  await fs.mkdir(path.join(directory, 'data/duet'), { recursive: true });
  await fs.writeFile(path.join(directory, 'data/duet/new.json'), '{}');
  // The former check reports no changes even though a new puzzle exists.
  git('diff', '--quiet', '--', 'data/duet');
  const workflow = await fs.readFile(new URL('../.github/workflows/duet-daily-buffer.yml', import.meta.url), 'utf8');
  const block = workflow.split('      - name: Commit generated daily assets')[1].match(/        run: \|\n((?: {10}.*\n|\n)*)/)[1];
  const publish = block.split('\n').map(line => line.replace(/^          /, '')).join('\n');
  // Execute the real workflow commit and push logic against an isolated remote.
  const env = { ...process.env, GITHUB_OUTPUT: path.join(root, 'output') };
  execFileSync('bash', ['-e', '-c', publish], { cwd: directory, env, stdio: ['ignore', 'pipe', 'pipe'] });
  assert.equal(git('show', 'HEAD:data/duet/new.json'), '{}');
  const head = git('rev-parse', 'HEAD');
  assert.equal(git('rev-parse', 'origin/main'), head);
  execFileSync('bash', ['-e', '-c', publish], { cwd: directory, env, stdio: ['ignore', 'pipe', 'pipe'] });
  assert.equal(git('rev-parse', 'HEAD'), head);
  assert.equal((await fs.readFile(env.GITHUB_OUTPUT, 'utf8')).trim(), 'changed=true\nchanged=false');
});

test('buffer check rejects impossible dates and an unbounded horizon', async () => {
  await assert.rejects(checkDuetBuffer({ start: '2026-02-30' }), /Invalid start/);
  await assert.rejects(checkDuetBuffer({ start: '2026-08-24', days: 731 }), /buffer length/);
});

