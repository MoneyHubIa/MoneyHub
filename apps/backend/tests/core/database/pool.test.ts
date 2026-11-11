import assert from 'node:assert/strict';
import { createServer, type Socket } from 'node:net';
import { test } from 'node:test';
import { createDatabasePool } from '../../../src/core/database/pool.js';

test('bounds concurrent connections, queues excess work and reuses released connections after six idle seconds', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const sockets = new Set<Socket>();
  let accepted = 0;
  // A minimal PostgreSQL handshake is enough to exercise real pg.Pool acquisition and release.
  const server = createServer(socket => {
    sockets.add(socket);
    accepted += 1;
    let started = false;
    socket.on('data', data => {
      if (!started) {
        started = true;
        socket.write(Buffer.from([82, 0, 0, 0, 8, 0, 0, 0, 0, 90, 0, 0, 0, 5, 73]));
      } else if (data[0] === 88) socket.end();
    });
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const pool = createDatabasePool(`postgresql://test:test@127.0.0.1:${address.port}/test?sslmode=disable`, { DATABASE_POOL_MAX: '2' });
  try {
    const [first, second] = await Promise.all([pool.connect(), pool.connect()]);
    const waiting = pool.connect();
    assert.equal(pool.waitingCount, 1);
    assert.equal(pool.totalCount, 2);
    first.release();
    const third = await waiting;
    assert.equal(third, first);
    assert.equal(accepted, 2);
    third.release();
    second.release();
    assert.equal(pool.options.idleTimeoutMillis, 60000);
    t.mock.timers.tick(6000);
    const reused = await pool.connect();
    assert.equal(accepted, 2);
    reused.release();
  } finally {
    await pool.end();
    for (const socket of sockets) socket.destroy();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('attaches Vercel pool lifecycle once and waits for idle connection cleanup', async t => {
  const symbol = Symbol.for('@vercel/request-context');
  const globalContext = globalThis as Record<symbol, unknown>;
  const previousContext = globalContext[symbol];
  const previousUrl = process.env.VERCEL_URL;
  const previousRegion = process.env.VERCEL_REGION;
  const pending: Promise<void>[] = [];
  globalContext[symbol] = { get: () => ({ waitUntil: (promise: Promise<void>) => pending.push(promise) }) };
  process.env.VERCEL_URL = 'test.vercel.app';
  process.env.VERCEL_REGION = 'test';
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pool = createDatabasePool('postgresql://test:test@localhost/test?sslmode=disable', { VERCEL: '1', DATABASE_POOL_MAX: '3' });
  try {
    assert.equal(pool.listenerCount('release'), 1);
    assert.equal(pool.options.max, 3);
    assert.equal(pool.options.connectionTimeoutMillis, 5000);
    assert.equal(pool.options.idleTimeoutMillis, 5000);
    assert.equal(pool.options.maxLifetimeSeconds, 300);
    pool.emit('release');
    assert.equal(pending.length, 1);
    t.mock.timers.tick(5100);
    await pending[0];
  } finally {
    await pool.end();
    if (previousContext === undefined) delete globalContext[symbol];
    else globalContext[symbol] = previousContext;
    if (previousUrl === undefined) delete process.env.VERCEL_URL;
    else process.env.VERCEL_URL = previousUrl;
    if (previousRegion === undefined) delete process.env.VERCEL_REGION;
    else process.env.VERCEL_REGION = previousRegion;
  }
});
