import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../src/generated/prisma/client.js';
import { withDatabaseClient } from '../../../src/core/database/database.js';
import type { GraphQLContext } from '../../../src/core/graphql/graphql.js';
import { confirmBankStatementImport, previewBankStatementImport } from '../../../src/modules/finance/bank-statement-imports/bank-statement-imports.js';

const databaseUrl = process.env.BANK_STATEMENT_TEST_DATABASE_URL;

test('PostgreSQL: competing imports and confirmations serialize without duplicate settlements', { skip: !databaseUrl }, async () => {
  const parsed = new URL(databaseUrl!);
  assert.ok(['localhost', '127.0.0.1'].includes(parsed.hostname));
  assert.equal(parsed.pathname, '/moneyhub_e2e', 'Use only the disposable E2E database.');
  const pool = new pg.Pool({ connectionString: databaseUrl!, ssl: false, max: 10 });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });
  let userId: string | undefined;
  try {
    await withDatabaseClient(db, async () => {
      const user = await db.user.create({ data: { firebaseUid: randomUUID(), email: `${randomUUID()}@example.test`, profile: { create: { fullName: 'Concurrent Import Test' } } }, include: { profile: true } });
      userId = user.id;
      const context: GraphQLContext = { requestId: 'concurrent-import', auth: { uid: user.firebaseUid, userId: user.id, profileId: user.profile!.id, email: user.email, emailVerified: true } };
      const account = await db.financialAccount.findFirstOrThrow({ where: { userId: user.id, isDefault: true } });
      const category = await db.financialCategory.create({ data: { userId: user.id, name: 'Importação', type: 'BOTH' } });
      const preview = () => previewBankStatementImport(context, { financialAccountId: account.id, fileName: 'extrato.csv', base64: Buffer.from('Data;Descrição;Valor\n2026-11-09;Concorrente;-10.01').toString('base64'), csvMapping: { delimiter: ';', dateColumn: 0, descriptionColumn: 1, amountColumn: 2, dateFormat: 'ISO', decimalSeparator: '.' } });
      const [first, second] = await Promise.all([preview(), preview()]);
      const input = (id: string) => ({ id, decisions: [{ rowNumber: 2, action: 'CREATE' as const, categoryId: category.id }] });
      const repeated = await Promise.all(Array.from({ length: 5 }, () => confirmBankStatementImport(context, input(first.batch!.id))));
      assert.ok(repeated.every(result => result.entries[0]?.entityId === repeated[0]?.entries[0]?.entityId));
      await assert.rejects(() => confirmBankStatementImport(context, input(second.batch!.id)), /já importada/);
      assert.equal(await db.accountPayable.count({ where: { userId: user.id } }), 1);
      assert.equal(await db.expense.count({ where: { userId: user.id } }), 1);
      assert.equal(await db.bankStatementImportEntry.count({ where: { userId: user.id } }), 1);

      // Two distinct source identities must also not reconcile the same target twice.
      const payable = await db.accountPayable.create({ data: { userId: user.id, financialAccountId: account.id, categoryId: category.id, description: 'Pendente', amount: '20', dueDate: new Date('2026-11-09') } });
      const previews = await Promise.all(['Boleto A', 'Boleto B'].map(description => previewBankStatementImport(context, { financialAccountId: account.id, fileName: 'outro.csv', base64: Buffer.from(`Data;Descrição;Valor\n2026-11-09;${description};-20`).toString('base64'), csvMapping: { delimiter: ';', dateColumn: 0, descriptionColumn: 1, amountColumn: 2, dateFormat: 'ISO', decimalSeparator: '.' } })));
      const racing = await Promise.allSettled(previews.map(value => confirmBankStatementImport(context, { id: value.batch!.id, decisions: [{ rowNumber: 2, action: 'LINK_ACCOUNT', targetId: payable.id }] })));
      assert.equal(racing.filter(value => value.status === 'fulfilled').length, 1);
      assert.equal(racing.filter(value => value.status === 'rejected').length, 1);
      assert.equal(await db.expense.count({ where: { settlementId: payable.id } }), 1);
    });
  } finally {
    if (userId) await db.user.delete({ where: { id: userId } });
    await db.$disconnect(); await pool.end();
  }
});
