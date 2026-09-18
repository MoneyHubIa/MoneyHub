import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { spawnPortable, waitForPort } from './process.mjs';

test('executes the npm command shim on Windows', { skip: process.platform !== 'win32' }, async () => {
  const child = spawnPortable('npm.cmd', ['--version'], {
    cwd: new URL('../', import.meta.url),
    stdio: 'ignore'
  });

  const [code] = await once(child, 'exit');
  assert.equal(code, 0);
});

test('waits through refused connections until the port opens', async () => {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const address = probe.address();
  assert.equal(typeof address, 'object');
  const port = address.port;
  await new Promise((resolve) => probe.close(resolve));

  const server = createServer();
  const timer = setTimeout(() => server.listen(port, '127.0.0.1'), 100);

  try {
    await waitForPort(port, 2_000);
  } finally {
    clearTimeout(timer);
    if (server.listening) await new Promise((resolve) => server.close(resolve));
  }
});
