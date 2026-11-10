import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../../../src/core/app/app.js';
import { createRuntimeApp } from '../../../src/core/app/runtime-app.js';

test('Vercel runtime trusts one proxy while the local runtime ignores forwarded addresses', async () => {
  for (const [environment, expected] of [[{ VERCEL: '1' }, 1], [{}, false]] as const) {
    const app = await createRuntimeApp({ environment: {
      APP_URL: 'https://example.test', FIREBASE_WEB_API_KEY: 'test', ...environment
    } });
    try { assert.equal(app.get('trust proxy'), expected); }
    finally { await app.locals.stop?.(); }
  }
});

test('GraphQL limits trusted client IPs independently and ignores spoofed earlier hops', async t => {
  const previousMax = process.env.RATE_LIMIT_MAX;
  process.env.RATE_LIMIT_MAX = '2';
  const diagnostics = t.mock.method(console, 'error', () => {});
  const app = await createApp({ trustProxyHops: 1 });
  if (previousMax === undefined) delete process.env.RATE_LIMIT_MAX;
  else process.env.RATE_LIMIT_MAX = previousMax;
  try {
    const send = (ip: string) => request(app).post('/graphql').set('x-forwarded-for', ip).send({ query: '{ health { status } }' });
    assert.equal((await send('203.0.113.1, 198.51.100.7')).status, 200);
    assert.equal((await send('203.0.113.2, 198.51.100.7')).status, 200);
    assert.equal((await send('203.0.113.3, 198.51.100.7')).status, 429);
    assert.equal((await send('198.51.100.8')).status, 200);
    assert.equal(diagnostics.mock.callCount(), 0);
  } finally { await app.locals.stop?.(); }
});

test('password recovery uses the same trusted IP and local requests cannot bypass limits', async () => {
  for (const trustProxyHops of [0, 1]) {
    const app = await createApp({ trustProxyHops });
    try {
      const send = (ip: string) => request(app).post('/auth/password-recovery').set('x-forwarded-for', ip).send({ email: 'user@example.test' });
      for (let index = 0; index < 5; index += 1) {
        const ip = trustProxyHops ? `203.0.113.${index + 1}, 198.51.100.7` : `198.51.100.${index + 1}`;
        assert.equal((await send(ip)).status, 202);
      }
      assert.equal((await send('198.51.100.7')).status, 429);
      assert.equal((await send('198.51.100.8')).status, trustProxyHops ? 202 : 429);
    } finally { await app.locals.stop?.(); }
  }
});
