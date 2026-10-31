import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { allocate, canonical, cents, day, installments, money, nextBusinessDay, statementDates } from '../../../../src/modules/finance/banking/rules.js';

test('corrective migration preserves settlements with deleted categories and rejects new references', async () => {
  const db = new PGlite();
  try {
    const root = new URL('../../../../prisma/migrations/', import.meta.url);
    const correction = '20261031010000_banking_corrections';
    for (const name of (await readdir(root)).filter(name => /^\d/.test(name) && name < correction).sort()) {
      await db.exec((await readFile(new URL(`${name}/migration.sql`, root), 'utf8')).replace(/CREATE EXTENSION[^;]+;/gi, ''));
    }
    const owner = '11111111-1111-4111-8111-111111111111';
    const category = '33333333-3333-4333-8333-333333333333';
    await db.query("INSERT INTO users(id,firebase_uid,email,updated_at) VALUES($1,'old','old@example.com',now())", [owner]);
    await db.query("INSERT INTO financial_categories(id,user_id,name,updated_at) VALUES($1,$2,'History',now())", [category, owner]);
    for (const table of ['accounts_payable', 'accounts_receivable']) {
      const status = table === 'accounts_payable' ? 'PAID' : 'RECEIVED';
      await db.query(`INSERT INTO ${table}(user_id,category_id,description,amount,due_date,status,updated_at) VALUES($1,$2,'History',100,now(),$3,now())`, [owner, category, status]);
    }
    await db.query('UPDATE financial_categories SET deleted_at=now() WHERE id=$1', [category]);
    await db.exec(await readFile(new URL(`${correction}/migration.sql`, root), 'utf8'));
    for (const table of ['accounts_payable', 'accounts_receivable']) {
      await db.query(`UPDATE ${table} SET description='Updated' WHERE user_id=$1`, [owner]);
      await db.query(`UPDATE ${table} SET status='PENDING' WHERE user_id=$1`, [owner]);
      await db.query(`UPDATE ${table} SET deleted_at=now() WHERE user_id=$1`, [owner]);
    }
    for (const table of ['expenses', 'incomes']) {
      assert.equal((await db.query(`SELECT * FROM ${table} WHERE deleted_at IS NULL`)).rows.length, 0);
      await db.query(`UPDATE ${table} SET deleted_at=now() WHERE user_id=$1`, [owner]);
      await assert.rejects(db.query(`INSERT INTO ${table}(user_id,category_id,description,amount,occurred_at,updated_at) VALUES($1,$2,'New',1,now(),now())`, [owner, category]));
    }
  } finally { await db.close(); }
});

test('money uses exact cents and rejects malformed amounts', () => {
  assert.equal(money(cents('9999999999.99')), '9999999999.99');
  assert.equal(money(cents('-1.01', true)), '-1.01');
  for (const value of ['NaN', '1e3', '1.001', '0', '-1', 'Infinity']) assert.throws(() => cents(value));
  assert.throws(() => day('2026-02-30'));
});
test('installments retain numbering, distribute cents and preserve month anchor', () => {
  const result = installments('100.00', '2028-01-31', { mode: 'INSTALLMENTS', first: 4, total: 10, frequency: 'MONTHLY' });
  assert.equal(result.length, 7);
  assert.equal(result[0]?.number, 4);
  assert.equal(result[1]?.dueDate.toISOString().slice(0, 10), '2028-02-29');
  assert.equal(result[2]?.dueDate.toISOString().slice(0, 10), '2028-03-31');
  assert.deepEqual(installments('1.00', '2026-01-01', { mode: 'INSTALLMENTS', first: 1, total: 3, frequency: 'DAILY' }).map(p => p.amount), ['0.34', '0.33', '0.33']);
  assert.throws(() => installments('0.01', '2026-01-01', { mode: 'INSTALLMENTS', first: 1, total: 3, frequency: 'MONTHLY' }));
});
test('partial allocation never exceeds item balance and preserves payment cents', () => {
  assert.deepEqual(allocate(4n, [1n, 1n, 1n, 2n]), [1n, 1n, 1n, 1n]);
  assert.equal(allocate(101n, [100n, 200n]).reduce((a, b) => a + b), 101n);
  assert.throws(() => allocate(301n, [100n, 200n]));
  assert.equal(canonical({ b: { z: 1, a: 2 }, a: 0 }), canonical({ a: 0, b: { a: 2, z: 1 } }));
  assert.notEqual(canonical({ schedule: { total: 2 } }), canonical({ schedule: { total: 3 } }));
});
test('statement calendar adjusts weekends and national holidays independently of closing', () => {
  assert.equal(nextBusinessDay(day('2026-11-20')).toISOString().slice(0, 10), '2026-11-23');
  const dates = statementDates(2026, 10, 20, 1, 7, true);
  assert.equal(dates.closing.toISOString().slice(0, 10), '2026-11-13');
  assert.equal(dates.due.toISOString().slice(0, 10), '2026-11-23');
});

test('PostgreSQL migration bootstraps accounts, scopes ownership and settles atomically', async () => {
  const db = new PGlite();
  try {
    const root = new URL('../../../../prisma/migrations/', import.meta.url);
    const names = (await readdir(root)).filter(name => /^\d/.test(name)).sort();
    for (const name of names) {
      const sql = await readFile(new URL(`${name}/migration.sql`, root), 'utf8');
      await db.exec(sql.replace(/CREATE EXTENSION[^;]+;/gi, ''));
    }
    const owner = '11111111-1111-4111-8111-111111111111';
    const other = '22222222-2222-4222-8222-222222222222';
    await db.query("INSERT INTO users(id,firebase_uid,email,updated_at) VALUES ($1,'one','one@example.com',now()),($2,'two','two@example.com',now())", [owner, other]);
    const rows = await db.query<{ id: string; user_id: string }>('SELECT id,user_id FROM financial_accounts WHERE is_default ORDER BY user_id');
    assert.equal(rows.rows.length, 2);
    assert.equal((await db.query('SELECT * FROM financial_accounts')).rows.length, 4);
    const category = '33333333-3333-4333-8333-333333333333';
    const payable = '44444444-4444-4444-8444-444444444444';
    await db.query("INSERT INTO financial_categories(id,user_id,name,updated_at) VALUES($1,$2,'Casa',now())", [category, owner]);
    await db.query("INSERT INTO accounts_payable(id,user_id,category_id,description,amount,due_date,updated_at) VALUES($1,$2,$3,'Aluguel',100,now(),now())", [payable, owner, category]);
    assert.equal((await db.query('SELECT * FROM expenses')).rows.length, 0);
    await db.query("UPDATE accounts_payable SET status='PAID',paid_at=now() WHERE id=$1", [payable]);
    await db.query("UPDATE accounts_payable SET status='PAID' WHERE id=$1", [payable]);
    assert.equal((await db.query('SELECT * FROM expenses WHERE deleted_at IS NULL')).rows.length, 1);
    await db.query("UPDATE accounts_payable SET status='PENDING' WHERE id=$1", [payable]);
    assert.equal((await db.query('SELECT * FROM expenses WHERE deleted_at IS NULL')).rows.length, 0);
    await assert.rejects(db.query('UPDATE accounts_payable SET financial_account_id=$1 WHERE id=$2', [rows.rows[1]!.id, payable]));
    await assert.rejects(db.query('UPDATE financial_accounts SET is_default=true WHERE user_id=$1', [owner]));
    await db.exec('BEGIN');
    await db.query("UPDATE accounts_payable SET status='PAID' WHERE id=$1", [payable]);
    await db.exec('ROLLBACK');
    assert.equal((await db.query('SELECT * FROM expenses WHERE deleted_at IS NULL')).rows.length, 0);
    const receivable = '55555555-5555-4555-8555-555555555555';
    await db.query("INSERT INTO accounts_receivable(id,user_id,category_id,description,amount,due_date,status,received_at,updated_at) VALUES($1,$2,$3,'Serviço',150,now(),'RECEIVED',now(),now())", [receivable, owner, category]);
    assert.equal((await db.query('SELECT * FROM incomes WHERE deleted_at IS NULL')).rows.length, 1);
    await db.query("UPDATE accounts_receivable SET status='PENDING' WHERE id=$1", [receivable]);
    assert.equal((await db.query('SELECT * FROM incomes WHERE deleted_at IS NULL')).rows.length, 0);
    assert.ok((await db.query('SELECT * FROM financial_audit WHERE user_id=$1', [owner])).rows.length > 0);
  } finally { await db.close(); }
});
