import { EventEmitter } from 'node:events';
import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';

/** Run the production Prisma adapter and services against an isolated PostgreSQL WASM database. */
export async function createTestDatabase() {
  const db = new PGlite();
  const root = new URL('../../prisma/migrations/', import.meta.url);
  for (const name of (await readdir(root)).filter(name => /^\d/.test(name)).sort()) {
    await db.exec((await readFile(new URL(`${name}/migration.sql`, root), 'utf8')).replace(/CREATE EXTENSION[^;]+;/gi, ''));
  }
  let tail = Promise.resolve();
  const acquire = async () => {
    const previous = tail;
    let release!: () => void;
    tail = new Promise<void>(resolve => { release = resolve; });
    await previous;
    return release;
  };
  const query = async (input: string | { text: string; values?: unknown[] }) => {
    const text = typeof input === 'string' ? input : input.text;
    const values = typeof input === 'string' ? [] : input.values ?? [];
    const result = await db.query<Record<string, unknown>>(text, values);
    return {
      command: text.trim().split(/\s/)[0], rowCount: result.affectedRows ?? result.rows.length,
      fields: result.fields,
      rows: result.rows.map(row => result.fields.map(field => {
        const value = row[field.name];
        if (value == null) return null;
        if ([114, 3802].includes(field.dataTypeID)) return JSON.stringify(value);
        if (value instanceof Date) return field.dataTypeID === 1082 ? value.toISOString().slice(0, 10) : value.toISOString();
        if ([20, 1700].includes(field.dataTypeID)) return String(value);
        return value;
      }))
    };
  };
  const pool = new pg.Pool();
  pool.query = (async (input: Parameters<typeof query>[0]) => {
    const release = await acquire();
    try { return await query(input); } finally { release(); }
  }) as unknown as pg.Pool['query'];
  pool.connect = (async () => {
    const release = await acquire();
    return Object.assign(new EventEmitter(), { query, release });
  }) as unknown as pg.Pool['connect'];
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  return { db, prisma, close: async () => { await prisma.$disconnect(); await pool.end(); await db.close(); } };
}
