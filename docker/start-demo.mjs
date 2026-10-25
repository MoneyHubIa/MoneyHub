import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const children = new Set();
let stopping = false;
let emulator;
const controller = new AbortController();

function start(args) {
  const child = spawn(process.execPath, args, { stdio: 'inherit' });
  const done = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
  const running = { child, done };
  children.add(running);
  done.finally(() => children.delete(running)).catch(() => {});
  return running;
}

async function stop(exitCode) {
  if (stopping) return;
  stopping = true;
  controller.abort();
  process.exitCode = exitCode;
  const timeout = setTimeout(() => {
    for (const { child } of children) child.kill('SIGKILL');
  }, 20000);
  try {
    // Stop the API before exporting identities from the emulator.
    const workers = [...children].filter((running) => running !== emulator);
    for (const { child } of workers) child.kill('SIGTERM');
    await Promise.allSettled(workers.map(({ done }) => done));
    if (emulator && children.has(emulator)) {
      emulator.child.kill('SIGTERM');
      await emulator.done;
    }
  } finally {
    clearTimeout(timeout);
  }
}

process.once('SIGINT', () => { void stop(0); });
process.once('SIGTERM', () => { void stop(0); });

async function waitForEmulator() {
  for (let attempt = 0; attempt < 120; attempt++) {
    controller.signal.throwIfAborted();
    try {
      const response = await fetch(
        'http://127.0.0.1:9099/emulator/v1/projects/demo-moneyhub/config',
        { signal: AbortSignal.timeout(1000) }
      );
      if (response.ok) return;
    } catch { /* Retry while Firebase starts. */ }
    await delay(500, undefined, { signal: controller.signal });
  }
  throw new Error('Firebase Auth Emulator did not become ready within 60 seconds.');
}

async function run(args) {
  controller.signal.throwIfAborted();
  const code = await start(args).done;
  if (code !== 0) throw new Error(`Startup command failed (${code}): ${args.join(' ')}`);
}

try {
  const exportDirectory = '/data/firebase/export';
  const args = [
    '/workspace/node_modules/firebase-tools/lib/bin/firebase.js',
    'emulators:start', '--only', 'auth',
    '--project', 'demo-moneyhub', '--config', '/workspace/docker/firebase.json',
    '--export-on-exit', exportDirectory
  ];
  if (existsSync(`${exportDirectory}/firebase-export-metadata.json`)) {
    args.push('--import', exportDirectory);
  }
  emulator = start(args);
  const emulatorExited = emulator.done.then((code) => {
    if (!stopping) throw new Error(`Firebase Auth Emulator exited unexpectedly (${code}).`);
  });
  const serve = async () => {
    await waitForEmulator();
    await run(['/workspace/node_modules/prisma/build/index.js', 'migrate', 'deploy']);
    await run(['dist/src/demo/seed-demo.js']);
    controller.signal.throwIfAborted();
    const code = await start(['dist/src/server.js']).done;
    if (!stopping) throw new Error(`MoneyHub API exited unexpectedly (${code}).`);
  };
  await Promise.race([emulatorExited, serve()]);
} catch (error) {
  if (!stopping) {
    console.error(error);
    await stop(1);
  }
}
