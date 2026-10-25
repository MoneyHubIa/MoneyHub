import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runRelease } from '../release.mjs';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../../', import.meta.url));
const releaseIt = join(dirname(require.resolve('release-it/package.json')), 'bin/release-it.js');
const manifestFiles = ['package.json', 'apps/backend/package.json', 'apps/frontend/package.json', 'package-lock.json', 'CHANGELOG.md'];

test('release uses the supplied GitHub token without invoking gh or exposing it in arguments', () => {
  const calls = [];
  const status = runRelease(['patch', '--ci'], {
    environment: { GITHUB_TOKEN: 'test-token', GH_TOKEN: 'other-token' },
    run(command, args, options) {
      calls.push({ command, args, options });
      return { status: 0 };
    }
  });
  assert.equal(status, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, process.execPath);
  assert.equal(calls[0].args[1], 'patch');
  assert.ok(calls[0].args.includes('--ci'));
  assert.ok(calls[0].args.includes('--config'));
  assert.equal(calls[0].options.env.GITHUB_TOKEN, 'test-token');
  assert.ok(!calls[0].args.join(' ').includes('test-token'));
});

test('release reuses GitHub CLI authentication and accepts GH_TOKEN', () => {
  const calls = [];
  runRelease(['minor'], {
    environment: {},
    run(command, args, options) {
      calls.push({ command, args, options });
      return command === 'gh' ? { status: 0, stdout: 'test-gh-token\n' } : { status: 0 };
    }
  });
  assert.deepEqual(calls[0].args, ['auth', 'token', '--hostname', 'github.com']);
  assert.equal(calls[1].options.env.GITHUB_TOKEN, 'test-gh-token');
  runRelease(['major'], {
    environment: { GH_TOKEN: 'test-env-token' },
    run(command, args, options) {
      assert.equal(command, process.execPath);
      assert.equal(options.env.GITHUB_TOKEN, 'test-env-token');
      return { status: 0 };
    }
  });
});

test('missing authentication stops before release-it and does not expose CLI output', () => {
  for (const authentication of [
    { status: 1, stderr: 'private authentication details' },
    { status: 0, stdout: '' },
    { error: new Error('CLI missing'), status: null }
  ]) {
    assert.throws(() => runRelease(['patch'], {
      environment: {},
      run(command) {
        assert.equal(command, 'gh');
        return authentication;
      }
    }), error => {
      assert.match(error.message, /gh auth login/);
      assert.ok(!error.message.includes('private authentication details'));
      return true;
    });
  }
});

test('dry-run never reads authentication and removes GitHub tokens from its child environment', () => {
  const environment = { GITHUB_TOKEN: 'test-token', GH_TOKEN: 'another-test-token' };
  runRelease(['1.2.3', '--dry-run', '--ci'], {
    environment,
    run(command, args, options) {
      assert.equal(command, process.execPath);
      assert.ok(args.includes('--dry-run'));
      assert.ok(args.includes('--no-github'));
      assert.equal(options.env.GITHUB_TOKEN, undefined);
      assert.equal(options.env.GH_TOKEN, undefined);
      return { status: 0 };
    }
  });
  assert.equal(environment.GITHUB_TOKEN, 'test-token');
});

test('invalid versions, prereleases and unsupported overrides are rejected before running commands', () => {
  for (const args of [
    ['v1.2.3'], ['01.2.3'], ['1.2.3-beta.1'], ['1.2.3+build'], ['1.2'],
    ['patch', 'minor'], ['1.2.3;echo unexpected'], ['--no-git'], ['--github.release=false']
  ]) {
    assert.throws(() => runRelease(args, {
      environment: {},
      run() { assert.fail('Invalid arguments must not execute any command.'); }
    }));
  }
});

test('release propagates failures and help does not require authentication', () => {
  assert.equal(runRelease(['--help'], {
    environment: {},
    run(command, args) {
      assert.equal(command, process.execPath);
      assert.ok(args.includes('--help'));
      return { status: 0 };
    }
  }), 0);
  for (const [result, expected] of [[{ status: 7 }, 7], [{ status: null, signal: 'SIGTERM' }, 1]]) {
    assert.equal(runRelease(['patch'], {
      environment: { GITHUB_TOKEN: 'test-token' }, run: () => result
    }), expected);
  }
});

function fixture(t) {
  const temporaryDirectory = resolve(tmpdir());
  const directory = mkdtempSync(join(temporaryDirectory, 'moneyhub-release-'));
  t.after(() => {
    if (dirname(resolve(directory)) !== temporaryDirectory || !basename(directory).startsWith('moneyhub-release-')) {
      throw new Error('Refusing to remove a directory outside the release test fixtures.');
    }
    rmSync(directory, { recursive: true, force: true });
  });
  const cwd = join(directory, 'repository');
  mkdirSync(cwd);
  const write = (file, value) => {
    mkdirSync(dirname(join(cwd, file)), { recursive: true });
    writeFileSync(join(cwd, file), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
  };
  const read = file => readFileSync(join(cwd, file), 'utf8');
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const config = JSON.parse(readFileSync(join(root, '.release-it.json'), 'utf8'));
  config.git.push = false;
  config.github.release = false;
  write('.release-it.json', config);
  write('scripts/sync-release-lock.mjs', readFileSync(join(root, 'scripts/sync-release-lock.mjs'), 'utf8'));
  const workspaces = ['apps/backend', 'apps/frontend'];
  write('package.json', {
    name: 'moneyhub-release-fixture', private: true, version: '0.1.0', workspaces,
    scripts: { preversion: 'node -e "process.exit(42)"' }
  });
  const packages = { '': { name: 'moneyhub-release-fixture', version: '0.1.0', workspaces } };
  for (const [index, workspace] of workspaces.entries()) {
    const manifest = { name: `release-fixture-${index}`, private: true, version: '0.1.0' };
    write(`${workspace}/package.json`, manifest);
    packages[workspace] = manifest;
  }
  write('package-lock.json', { name: 'moneyhub-release-fixture', version: '0.1.0', lockfileVersion: 3, requires: true, packages });
  write('CHANGELOG.md', '# Changelog\n');
  write('.gitignore', 'node_modules/\n');
  git('init', '-b', 'main');
  git('config', 'user.name', 'Release Test');
  git('config', 'user.email', 'release@example.test');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'tag.gpgsign', 'false');
  git('add', '.');
  git('commit', '-m', 'chore: initialize fixture');
  git('tag', 'v0.1.0');
  git('init', '--bare', join(directory, 'origin.git'));
  git('remote', 'add', 'origin', join(directory, 'origin.git'));
  git('push', '-u', 'origin', 'main', '--tags');
  git('commit', '--allow-empty', '-m', 'fix: preserve the release fixture');
  const run = (script, args) => spawnSync(process.execPath, [script, ...args, ...(script === releaseIt ? ['--config', join(cwd, '.release-it.json')] : [])], {
    cwd, encoding: 'utf8', timeout: 60000,
    env: { ...process.env, GITHUB_TOKEN: '', GH_TOKEN: '', NO_COLOR: '1', FORCE_COLOR: '0' }
  });
  return { cwd, read, write, git, run };
}

test('dry-run preserves files and Git state; a local release synchronizes all versions, changelog, commit and tag', t => {
  const { read, git, run } = fixture(t);
  const originalFiles = manifestFiles.map(read);
  const originalHead = git('rev-parse', 'HEAD');
  const originalTags = git('tag', '--list');
  const preview = run(join(root, 'scripts/release.mjs'), ['patch', '--dry-run', '--ci']);
  assert.equal(preview.status, 0, preview.stdout + preview.stderr);
  assert.deepEqual(manifestFiles.map(read), originalFiles);
  assert.equal(git('rev-parse', 'HEAD'), originalHead);
  assert.equal(git('tag', '--list'), originalTags);
  assert.equal(git('status', '--porcelain'), '');

  // The fixture disables Git push and GitHub publishing; only this disposable repository is changed.
  const release = run(releaseIt, ['--ci']);
  assert.equal(release.status, 0, release.stdout + release.stderr);
  for (const file of manifestFiles.slice(0, 3)) assert.equal(JSON.parse(read(file)).version, '0.1.1');
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(lock.version, '0.1.1');
  for (const path of ['', 'apps/backend', 'apps/frontend']) assert.equal(lock.packages[path].version, '0.1.1');
  assert.match(read('CHANGELOG.md'), /0\.1\.1/);
  assert.match(read('CHANGELOG.md'), /preserve the release fixture/);
  assert.equal(git('log', '-1', '--format=%s'), 'chore(release): v0.1.1');
  const releasedHead = git('rev-parse', 'HEAD');
  assert.equal(git('rev-parse', 'v0.1.1^{commit}'), releasedHead);
  assert.equal(git('status', '--porcelain'), '');
  assert.notEqual(releasedHead, originalHead);
  const duplicate = run(releaseIt, ['patch', '--ci']);
  assert.notEqual(duplicate.status, 0);
  assert.equal(git('rev-parse', 'HEAD'), releasedHead);
});

test('wrong branch and dirty working tree stop release before changing versions or existing user edits', t => {
  const { read, write, git, run } = fixture(t);
  const originalFiles = manifestFiles.map(read);
  git('switch', '-c', 'feature/test');
  const wrongBranch = run(releaseIt, ['patch', '--ci']);
  assert.notEqual(wrongBranch.status, 0);
  assert.match(wrongBranch.stderr + wrongBranch.stdout, /Must be on branch main/);
  assert.deepEqual(manifestFiles.map(read), originalFiles);
  git('switch', 'main');
  write('CHANGELOG.md', '# Changelog\n\nUser edits must remain.\n');
  const dirty = run(releaseIt, ['patch', '--ci']);
  assert.notEqual(dirty.status, 0);
  assert.match(dirty.stderr + dirty.stdout, /Working dir must be clean/);
  assert.match(read('CHANGELOG.md'), /User edits must remain/);
  assert.deepEqual(manifestFiles.slice(0, 4).map(read), originalFiles.slice(0, 4));
});
