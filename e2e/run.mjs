import { spawnSync } from 'node:child_process';
import { createE2eEnvironment } from './environment.mjs';
import { spawnPortable, waitForPort } from './process.mjs';

const root = new URL('../', import.meta.url);
const environment = createE2eEnvironment();
const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnPortable(command, args, {
      cwd: root,
      env: environment,
      stdio: 'inherit',
      ...options
    });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}

function start(command, args) {
  const child = spawnPortable(command, args, {
    cwd: root,
    env: environment,
    stdio: 'inherit',
    detached: true
  });
  children.push(child);
  return child;
}

function stopChild(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
  } else {
    try { process.kill(-child.pid, 'SIGTERM'); } catch {}
  }
}

let composeStarted = false;
try {
  await run('docker', ['compose', '-p', 'moneyhub-e2e', '-f', 'e2e/compose.yaml', 'up', '-d', '--wait']);
  composeStarted = true;
  await run(npmExecutable, ['run', 'db:migrate', '-w', 'apps/backend']);
  await run(npmExecutable, ['run', 'build', '-w', 'apps/backend']);
  await run(npmExecutable, ['run', 'build:web', '-w', 'apps/frontend']);

  start(process.execPath, ['node_modules/firebase-tools/lib/bin/firebase.js', 'emulators:start', '--config', 'firebase.json', '--project', 'demo-moneyhub', '--only', 'auth']);
  await waitForPort(9099);
  start(process.execPath, ['apps/backend/dist/src/server.js']);
  await waitForPort(3000);
  start(process.execPath, ['e2e/static-server.mjs', 'apps/frontend/dist', '3100']);
  await waitForPort(3100);

  await run(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)]);
} finally {
  for (const child of children.reverse()) stopChild(child);
  if (composeStarted) {
    await run('docker', ['compose', '-p', 'moneyhub-e2e', '-f', 'e2e/compose.yaml', 'down', '--volumes']);
  }
}
