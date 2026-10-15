import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { syncTestedRevision } from '../scripts/publish-tested-main.mjs';

async function repository(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'puzli-release-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const cwd = path.join(root, 'work');
  const remote = path.join(root, 'remote.git');
  await fs.mkdir(cwd);
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '--bare', '--initial-branch=main', remote);
  git('init', '--initial-branch=main');
  git('config', 'user.name', 'Release test');
  git('config', 'user.email', 'release@example.com');
  git('remote', 'add', 'origin', remote);
  git('commit', '--allow-empty', '-m', 'published');
  const initial = git('rev-parse', 'HEAD');
  git('push', 'origin', 'HEAD:main', 'HEAD:preview');
  git('commit', '--allow-empty', '-m', 'tested update');
  const target = git('rev-parse', 'HEAD');
  git('push', 'origin', 'HEAD:main');
  return { root, cwd, remote, git, initial, target, preview: () => git('--git-dir', remote, 'rev-parse', 'preview') };
}

test('publication fast-forwards only the tested checkout and is idempotent', async t => {
  const repo = await repository(t);
  assert.equal(syncTestedRevision(repo.target, repo).changed, true);
  assert.equal(repo.preview(), repo.target);
  const repeated = syncTestedRevision(repo.target, repo);
  assert.equal(repeated.changed, false);
  assert.equal(repeated.ready, true, 'a failed Pages request can be retried without moving preview');
  assert.throws(() => syncTestedRevision(repo.initial, repo), /Checkout differs/);
  assert.throws(() => syncTestedRevision('main', repo), /full tested commit SHA/);
});

test('a delayed successful run cannot publish an old main or overwrite a newer release', async t => {
  const repo = await repository(t);
  repo.git('commit', '--allow-empty', '-m', 'newer tested update');
  const newer = repo.git('rev-parse', 'HEAD');
  repo.git('push', 'origin', 'HEAD:main');
  repo.git('checkout', '--detach', repo.target);
  const stale = syncTestedRevision(repo.target, repo);
  assert.equal(stale.changed, false);
  assert.equal(stale.ready, false);
  assert.equal(repo.preview(), repo.initial);
  repo.git('checkout', '--detach', newer);
  assert.equal(syncTestedRevision(newer, repo).changed, true);
  repo.git('checkout', '--detach', repo.target);
  assert.equal(syncTestedRevision(repo.target, repo).changed, false);
  assert.equal(repo.preview(), newer);
});

test('a divergent live branch is preserved and requires an explicit repair', async t => {
  const repo = await repository(t);
  repo.git('checkout', '--detach', repo.initial);
  repo.git('commit', '--allow-empty', '-m', 'external preview change');
  const external = repo.git('rev-parse', 'HEAD');
  repo.git('push', 'origin', 'HEAD:preview');
  repo.git('checkout', '--detach', repo.target);
  assert.throws(() => syncTestedRevision(repo.target, repo), /preview has diverged/);
  assert.equal(repo.preview(), external);
});

test('a concurrent newer release cannot be overwritten between fetch and push', async t => {
  const repo = await repository(t);
  repo.git('commit', '--allow-empty', '-m', 'concurrent newer update');
  const newer = repo.git('rev-parse', 'HEAD');
  // Transfer the object without advancing production yet.
  repo.git('push', 'origin', 'HEAD:concurrent');
  repo.git('checkout', '--detach', repo.target);
  const hook = path.join(repo.cwd, '.git/hooks/pre-push');
  const remoteArg = "'" + repo.remote.replaceAll("'", "'\\''") + "'";
  await fs.writeFile(hook, `#!/bin/sh\ngit --git-dir ${remoteArg} update-ref refs/heads/preview ${newer}\n`, { mode: 0o755 });
  assert.throws(() => syncTestedRevision(repo.target, repo));
  assert.equal(repo.preview(), newer);
});
