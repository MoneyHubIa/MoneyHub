import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GraphQLError } from 'graphql';
import { createIncome } from '../../../src/modules/finance/incomes/incomes.js';
import { createExpense } from '../../../src/modules/finance/expenses/expenses.js';
import { createAccountPayable } from '../../../src/modules/finance/accounts-payable/accounts-payable.js';
import { createAccountReceivable } from '../../../src/modules/finance/accounts-receivable/accounts-receivable.js';

const context = { requestId: 'validation', auth: { uid: 'firebase-user', userId: 'user', profileId: 'profile', email: 'user@example.com', emailVerified: true } };
for (const create of [createIncome, createExpense, createAccountPayable, createAccountReceivable]) {
  test(`${create.name} rejects malformed amounts before accessing persistence`, async () => {
    for (const amount of ['Infinity', 'NaN', '1e3', '0x10', '0', '-1', '0.001', '10000000000']) {
      await assert.rejects(() => create(context, { categoryId: 'category', description: 'Test', amount, occurredAt: '2026-01-01', dueDate: '2026-01-01' }, {} as never), error => error instanceof GraphQLError && error.extensions.code === 'BAD_USER_INPUT');
    }
  });
}
