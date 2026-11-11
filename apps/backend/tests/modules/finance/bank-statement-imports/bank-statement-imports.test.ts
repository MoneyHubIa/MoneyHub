import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { graphql } from 'graphql';
import { createTestDatabase } from '../../../helpers/pglite-prisma.js';
import { withDatabaseClient } from '../../../../src/core/database/database.js';
import type { GraphQLContext } from '../../../../src/core/graphql/graphql.js';
import { aiOperationCatalog } from '../../../../src/core/graphql/graphql.js';
import { accounts, purchase } from '../../../../src/modules/finance/banking/banking.js';
import { confirmBankStatementImport, getBankStatementImport, previewBankStatementImport, type ImportDecision } from '../../../../src/modules/finance/bank-statement-imports/bank-statement-imports.js';
import type { CsvMapping } from '../../../../src/modules/finance/bank-statement-imports/parsers.js';

const mapping: CsvMapping = { delimiter: ';', dateColumn: 0, descriptionColumn: 1, amountColumn: 2, dateFormat: 'ISO', decimalSeparator: '.' };

test('statement import uses real Prisma, PostgreSQL triggers and atomic reconciliation', async t => {
  const database = await createTestDatabase();
  const db = database.prisma;
  try {
    await withDatabaseClient(db, async () => {
      async function owner() {
        const user = await db.user.create({ data: { firebaseUid: randomUUID(), email: `${randomUUID()}@example.test`, profile: { create: { fullName: 'Import Test' } } }, include: { profile: true } });
        const context: GraphQLContext = { requestId: 'import-test', auth: { uid: user.firebaseUid, userId: user.id, profileId: user.profile!.id, email: user.email, emailVerified: true } };
        const account = await db.financialAccount.findFirstOrThrow({ where: { userId: user.id, isDefault: true } });
        const other = await db.financialAccount.findFirstOrThrow({ where: { userId: user.id, isDefault: false } });
        const category = await db.financialCategory.create({ data: { userId: user.id, name: 'Geral', type: 'BOTH' } });
        return { context, userId: user.id, accountId: account.id, otherId: other.id, categoryId: category.id };
      }
      async function preview(context: GraphQLContext, accountId: string, lines: string[], name = 'extrato.csv') {
        const response = await previewBankStatementImport(context, { financialAccountId: accountId, fileName: name, base64: Buffer.from('Data;Descrição;Valor\n' + lines.join('\n')).toString('base64'), csvMapping: mapping });
        return response.batch!;
      }
      const create = (rowNumber: number, categoryId: string): ImportDecision => ({ rowNumber, action: 'CREATE', categoryId });

      await t.test('preview is read-only financially; confirmation, replay and duplicates affect balance once', async () => {
        const own = await owner();
        const batch = await preview(own.context, own.accountId, ['2026-11-09;Salário;200.01', '2026-11-09;Mercado;-12.34']);
        assert.equal(await db.income.count({ where: { userId: own.userId } }), 0);
        const input = { id: batch.id, decisions: [create(2, own.categoryId), create(3, own.categoryId)] };
        const result = await confirmBankStatementImport(own.context, input);
        assert.equal(result.created, 2);
        assert.equal(result.incomeTotal, '200.01'); assert.equal(result.expenseTotal, '12.34');
        assert.deepEqual(await confirmBankStatementImport(own.context, input), result);
        await assert.rejects(() => confirmBankStatementImport(own.context, { ...input, decisions: [{ rowNumber: 2, action: 'IGNORE' }, input.decisions[1]!] }), /outras decisões/);
        assert.equal((await accounts(own.context)).find(a => a.id === own.accountId)?.balance, '187.67');
        const payable = await db.accountPayable.findFirstOrThrow({ where: { userId: own.userId } });
        const expense = await db.expense.findUniqueOrThrow({ where: { settlementId: payable.id } });
        assert.equal(payable.status, 'PAID'); assert.equal(expense.occurredAt.toISOString(), '2026-11-09T00:00:00.000Z');
        assert.ok((await getBankStatementImport(own.context, batch.id)).result);
        const repeated = await preview(own.context, own.accountId, ['2026-11-09;Salário;200.01', '2026-11-09;Mercado;-12.34']);
        assert.ok(repeated.rows.every(row => row.duplicate));
        await assert.rejects(() => confirmBankStatementImport(own.context, { id: repeated.id, decisions: input.decisions }), /já importada/);
        const overlap = await preview(own.context, own.accountId, ['2026-11-09;Mercado;-12.34', '2026-11-10;Outro;1']);
        assert.equal(overlap.rows[0]?.possibleDuplicate, true);
        const overlapInput = { id: overlap.id, decisions: [create(2, own.categoryId), { rowNumber: 3, action: 'IGNORE' as const }] };
        await assert.rejects(() => confirmBankStatementImport(own.context, overlapInput), /possível duplicado/);
        overlapInput.decisions[0]!.acknowledgeDuplicate = true;
        assert.equal((await confirmBankStatementImport(own.context, overlapInput)).created, 1);
      });

      await t.test('links pending and already settled commitments without duplicating their movements', async () => {
        const own = await owner();
        const pending = await db.accountPayable.create({ data: { userId: own.userId, financialAccountId: own.accountId, categoryId: own.categoryId, description: 'Conta existente', amount: '25.50', dueDate: new Date('2026-11-07') } });
        const paid = await db.accountReceivable.create({ data: { userId: own.userId, financialAccountId: own.accountId, categoryId: own.categoryId, description: 'Recebida manualmente', amount: '50', dueDate: new Date('2026-11-01'), status: 'RECEIVED', receivedAt: new Date('2026-11-09') } });
        const batch = await preview(own.context, own.accountId, ['2026-11-09;Boleto;-25.50', '2026-11-09;Pix;50']);
        assert.ok(batch.rows[0]?.candidates.some(item => item.id === pending.id));
        const result = await confirmBankStatementImport(own.context, { id: batch.id, decisions: [
          { rowNumber: 2, action: 'LINK_ACCOUNT', targetId: pending.id }, { rowNumber: 3, action: 'LINK_ACCOUNT', targetId: paid.id }
        ] });
        assert.equal(result.linked, 2); assert.equal(result.created, 0);
        assert.equal(await db.expense.count({ where: { userId: own.userId } }), 1);
        assert.equal(await db.income.count({ where: { userId: own.userId } }), 1);
        const updated = await db.accountPayable.findUniqueOrThrow({ where: { id: pending.id } });
        assert.equal(updated.description, pending.description); assert.equal(updated.dueDate.toISOString(), pending.dueDate.toISOString());
        assert.equal(updated.paidAt?.toISOString(), '2026-11-09T00:00:00.000Z');
      });

      await t.test('creates one transfer, then reconciles its opposite side without income or expense', async () => {
        const own = await owner();
        const outgoing = await preview(own.context, own.accountId, ['2026-11-09;Transferência;-30']);
        const first = await confirmBankStatementImport(own.context, { id: outgoing.id, decisions: [{ rowNumber: 2, action: 'TRANSFER', otherAccountId: own.otherId }] });
        const incoming = await preview(own.context, own.otherId, ['2026-11-09;Crédito transferência;30']);
        assert.ok(incoming.rows[0]?.candidates.some(item => item.id === first.entries[0]?.entityId));
        await confirmBankStatementImport(own.context, { id: incoming.id, decisions: [{ rowNumber: 2, action: 'TRANSFER', targetId: first.entries[0]!.entityId }] });
        assert.equal(await db.transfer.count({ where: { userId: own.userId } }), 1);
        assert.equal(await db.expense.count({ where: { userId: own.userId } }), 0);
        assert.equal(await db.income.count({ where: { userId: own.userId } }), 0);
        const balances = await accounts(own.context);
        assert.equal(balances.find(item => item.id === own.accountId)?.balance, '-30.00');
        assert.equal(balances.find(item => item.id === own.otherId)?.balance, '30.00');
      });

      await t.test('partial and full card payments reuse allocations and never create a second payable', async () => {
        const own = await owner();
        const card = await db.creditCard.create({ data: { userId: own.userId, financialAccountId: own.accountId, name: 'Visa', brand: 'Visa', creditLimit: '1000', dueDay: 20, closingDay: 10 } });
        await purchase(own.context, { cardId: card.id, operationId: randomUUID(), categoryId: own.categoryId, description: 'Compra', amount: '100', purchasedOn: '2026-11-01', total: 1, first: 1 });
        const payable = await db.accountPayable.findFirstOrThrow({ where: { userId: own.userId } });
        for (const [date, amount] of [['2026-11-09', '40'], ['2026-11-10', '60']]) {
          const batch = await preview(own.context, own.accountId, [`${date};Pagamento Visa;-${amount}`]);
          const candidate = batch.rows[0]!.candidates.find(item => item.kind === 'CARD_STATEMENT')!;
          assert.ok(candidate);
          await confirmBankStatementImport(own.context, { id: batch.id, decisions: [{ rowNumber: 2, action: 'CARD_PAYMENT', cardId: card.id, statementDueDate: candidate.statementDueDate! }] });
        }
        assert.equal(await db.accountPayable.count({ where: { userId: own.userId } }), 1);
        assert.equal((await db.accountPayable.findUniqueOrThrow({ where: { id: payable.id } })).status, 'PAID');
        assert.equal(await db.creditCardPayment.count({ where: { cardId: card.id } }), 2);
        assert.equal(String((await db.expense.aggregate({ where: { userId: own.userId }, _sum: { amount: true } }))._sum.amount), '100');
        assert.equal((await accounts(own.context)).find(item => item.id === own.accountId)?.balance, '-100.00');
      });

      await t.test('the 500-row boundary settles every line and records one receipt per source', async () => {
        const own = await owner();
        const batch = await preview(own.context, own.accountId, Array.from({ length: 500 }, (_, index) => `2026-11-09;Movimento ${index};1.01`));
        const result = await confirmBankStatementImport(own.context, { id: batch.id, decisions: batch.rows.map(row => create(row.rowNumber, own.categoryId)) });
        assert.equal(result.created, 500);
        assert.equal(result.incomeTotal, '505.00');
        assert.equal(await db.income.count({ where: { userId: own.userId } }), 500);
        assert.equal(await db.bankStatementImportEntry.count({ where: { importId: batch.id } }), 500);
      });

      await t.test('rollback, stale targets, ownership, expiry and authentication are enforced', async () => {
        const own = await owner(), other = await owner();
        const batch = await preview(own.context, own.accountId, ['2026-11-09;Primeira;10', '2026-11-09;Segunda;-20']);
        await assert.rejects(() => confirmBankStatementImport(own.context, { id: batch.id, decisions: [create(2, own.categoryId), create(3, other.categoryId)] }), /categoria inválida/);
        assert.equal(await db.income.count({ where: { userId: own.userId } }), 0);
        assert.equal(await db.bankStatementImportEntry.count({ where: { importId: batch.id } }), 0);
        assert.equal((await getBankStatementImport(own.context, batch.id)).status, 'PENDING');
        await assert.rejects(() => getBankStatementImport(other.context, batch.id), /não encontrada/);
        await assert.rejects(() => preview(other.context, own.accountId, ['2026-11-09;Outro;1']), /não encontrada/);
        await db.bankStatementImport.update({ where: { id: batch.id }, data: { expiresAt: new Date(0) } });
        await assert.rejects(() => confirmBankStatementImport(own.context, { id: batch.id, decisions: [create(2, own.categoryId), create(3, own.categoryId)] }), /expirada/);
        const anonymous = await graphql({ schema: aiOperationCatalog.graph, source: 'query { bankStatementImport(id:"11111111-1111-4111-8111-111111111111") { id } }', contextValue: { requestId: 'anonymous', auth: null } });
        assert.equal(anonymous.errors?.[0]?.extensions.code, 'UNAUTHENTICATED');
        const pending = await db.accountPayable.create({ data: { userId: own.userId, financialAccountId: own.accountId, categoryId: own.categoryId, description: 'Pendente', amount: '10', dueDate: new Date('2026-11-09') } });
        const stale = await preview(own.context, own.accountId, ['2026-11-09;Boleto;-10']);
        await db.accountPayable.update({ where: { id: pending.id }, data: { amount: '11' } });
        await assert.rejects(() => confirmBankStatementImport(own.context, { id: stale.id, decisions: [{ rowNumber: 2, action: 'LINK_ACCOUNT', targetId: pending.id }] }), /incompatível/);
      });
    });
  } finally { await database.close(); }
});
