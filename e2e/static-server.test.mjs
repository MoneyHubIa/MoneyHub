import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createE2eWebServer } from './static-server.mjs';

test('proxies GraphQL requests to the real backend', async () => {
  const backend = createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ method: request.method, path: request.url }));
  });
  backend.listen(0, '127.0.0.1');
  await once(backend, 'listening');
  const backendAddress = backend.address();
  assert.equal(typeof backendAddress, 'object');

  const web = createE2eWebServer({
    root: fileURLToPath(new URL('../apps/frontend/dist', import.meta.url)),
    backendOrigin: `http://127.0.0.1:${backendAddress.port}`
  });
  web.listen(0, '127.0.0.1');
  await once(web, 'listening');
  const webAddress = web.address();
  assert.equal(typeof webAddress, 'object');

  try {
    const response = await fetch(`http://127.0.0.1:${webAddress.port}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{ health { status } }' })
    });
    assert.equal(response.headers.get('content-type'), 'application/json');
    assert.deepEqual(await response.json(), { method: 'POST', path: '/graphql' });
  } finally {
    await Promise.all([
      new Promise((resolve) => web.close(resolve)),
      new Promise((resolve) => backend.close(resolve))
    ]);
  }
});
