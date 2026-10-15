import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// This helper never chooses a revision. CI supplies the SHA of the checkout
// whose unit and browser tests have just passed.
export function syncTestedRevision(target, { cwd = process.cwd() } = {}) {
  if (!/^[a-f0-9]{40}$/.test(target || '')) throw new Error('Expected a full tested commit SHA.');
  const git = (...args) => execFileSync('git', args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
  const isAncestor = (ancestor, descendant) => {
    try { git('merge-base', '--is-ancestor', ancestor, descendant); return true; }
    catch (error) { if (error.status === 1) return false; throw error; }
  };

  if (git('rev-parse', 'HEAD') !== target) throw new Error('Checkout differs from the tested revision.');
  git('fetch', 'origin', 'main', 'preview');
  const main = git('rev-parse', 'origin/main');
  const preview = git('rev-parse', 'origin/preview');
  if (target !== main) return { changed: false, ready: false, reason: 'main has advanced; wait for its tested revision', target };
  if (target === preview) return { changed: false, ready: true, reason: 'preview already contains this tested revision', target };
  if (!isAncestor(preview, target)) throw new Error('preview has diverged from main; refusing to overwrite production.');

  // No force and no rebase: a concurrent newer preview is never overwritten.
  git('push', 'origin', `${target}:refs/heads/preview`);
  return { changed: true, ready: true, reason: 'tested revision fast-forwarded to preview', target };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = syncTestedRevision(process.argv[2]);
  console.log(`${result.reason}: ${result.target}`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${result.changed}\nready=${result.ready}\nsha=${result.target}\n`);
}
