import { getPrismaClient } from '../../../core/database/database.js';
import type { GraphQLContext } from '../../../core/graphql/graphql.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { requireVerifiedUserId } from '../financial-categories/financial-categories.js';
import { validateReminderOffsetDays } from '../../agenda/notifications/agenda-notifications.js';
import { allocate, canonical, cents, day, installments, invalid, money, statementDates, type Schedule } from './rules.js';

type Tx = Prisma.TransactionClient;
export async function account(tx: Tx, userId: string, id?: string) {
  const item = await tx.financialAccount.findFirst({ where: { userId, archived: false, ...(id ? { id } : { isDefault: true }) } });
  if (!item) invalid('Conta financeira não encontrada.');
  return item;
}
async function lock(tx: Tx, userId: string) {
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR NO KEY UPDATE`;
}
export async function balance(tx: Tx, userId: string, id: string, initial: string) {
  const [income, expense, outgoing, incoming] = await Promise.all([
    tx.income.aggregate({ where: { userId, financialAccountId: id, deletedAt: null }, _sum: { amount: true } }),
    tx.expense.aggregate({ where: { userId, financialAccountId: id, deletedAt: null }, _sum: { amount: true } }),
    tx.transfer.aggregate({ where: { userId, sourceId: id, status: 'COMPLETED' }, _sum: { amount: true } }),
    tx.transfer.aggregate({ where: { userId, destinationId: id, status: 'COMPLETED' }, _sum: { amount: true } })
  ]);
  return money(cents(initial, true) + cents(String(income._sum.amount ?? 0), true) - cents(String(expense._sum.amount ?? 0), true) - cents(String(outgoing._sum.amount ?? 0), true) + cents(String(incoming._sum.amount ?? 0), true));
}
export async function accounts(context: GraphQLContext) {
  const userId = requireVerifiedUserId(context);
  const db = getPrismaClient();
  const items = await db.financialAccount.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] });
  return Promise.all(items.map(async item => ({ ...item, initialBalance: String(item.initialBalance), balance: await balance(db, userId, item.id, String(item.initialBalance)) })));
}
export type AccountInput = { id?: string; name: string; type: string; accountNumber?: string | null; additionalData?: string | null; initialBalance: string; isDefault: boolean; archived?: boolean };
export async function saveAccount(context: GraphQLContext, input: AccountInput) {
  const userId = requireVerifiedUserId(context);
  if (!input.name.trim() || input.name.length > 120 || !['CHECKING', 'SAVINGS', 'INVESTMENT', 'OTHER'].includes(input.type)) invalid('Nome ou tipo de conta inválido.');
  if ((input.accountNumber?.length ?? 0) > 120 || (input.additionalData?.length ?? 0) > 1000) invalid('Dados da conta excedem limite.');
  cents(input.initialBalance, true);
  await getPrismaClient().$transaction(async tx => {
    await lock(tx, userId);
    const previous = input.id ? await tx.financialAccount.findFirst({ where: { id: input.id, userId } }) : null;
    if (input.id && !previous) invalid('Conta não encontrada.');
    if (previous?.isDefault && (!input.isDefault || input.archived)) invalid('Defina outra conta padrão antes de arquivar ou remover padrão.');
    if (input.isDefault && input.archived) invalid('Conta arquivada não pode ser padrão.');
    if (input.id && input.archived) {
      const where = { userId, financialAccountId: input.id };
      const used = await Promise.all([
        tx.accountPayable.count({ where: { ...where, deletedAt: null, status: { in: ['PENDING', 'OVERDUE'] } } }),
        tx.accountReceivable.count({ where: { ...where, deletedAt: null, status: { in: ['PENDING', 'OVERDUE'] } } }),
        tx.creditCard.count({ where: { ...where, archived: false } }),
        tx.recurringTransaction.count({ where })
      ]);
      if (used.some(Boolean)) invalid('Conta possui compromissos, cartões ou recorrências ativos.');
    }
    if (input.isDefault) await tx.financialAccount.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    const { id, ...data } = input;
    if (id) await tx.financialAccount.update({ where: { id }, data });
    else await tx.financialAccount.create({ data: { ...data, userId } });
  });
  return accounts(context);
}
export type TransferInput = { operationId: string; sourceId: string; destinationId: string; amount: string; dueDate: string; effectiveDate?: string };
export async function transfer(context: GraphQLContext, input: TransferInput) {
  const userId = requireVerifiedUserId(context);
  cents(input.amount); day(input.dueDate);
  if (input.sourceId === input.destinationId) invalid('Origem e destino devem ser diferentes.');
  return getPrismaClient().$transaction(async tx => {
    await lock(tx, userId);
    await account(tx, userId, input.sourceId); await account(tx, userId, input.destinationId);
    const previous = await tx.transfer.findUnique({ where: { userId_operationId: { userId, operationId: input.operationId } } });
    if (previous) {
      if (previous.sourceId !== input.sourceId || previous.destinationId !== input.destinationId || cents(String(previous.amount)) !== cents(input.amount) || previous.dueDate.toISOString().slice(0, 10) !== input.dueDate) invalid('operationId já utilizado com outros dados.');
      return previous;
    }
    return tx.transfer.create({ data: { ...input, userId, dueDate: day(input.dueDate), effectiveDate: input.effectiveDate ? day(input.effectiveDate) : null, status: input.effectiveDate ? 'COMPLETED' : 'PENDING' } });
  });
}
export async function changeTransfer(context: GraphQLContext, id: string, cancel: boolean, effectiveDate: string) {
  const userId = requireVerifiedUserId(context);
  return getPrismaClient().$transaction(async tx => {
    await lock(tx, userId);
    const item = await tx.transfer.findFirst({ where: { id, userId } });
    if (!item) invalid('Transferência não encontrada.');
    if (cancel) return tx.transfer.update({ where: { id }, data: { status: 'CANCELLED' } });
    if (item.status === 'CANCELLED') invalid('Transferência cancelada.');
    await account(tx, userId, item.sourceId); await account(tx, userId, item.destinationId);
    return tx.transfer.update({ where: { id }, data: { status: 'COMPLETED', effectiveDate: item.effectiveDate ?? day(effectiveDate) } });
  });
}

export type SeriesInput = { operationId: string; financialAccountId: string; categoryId: string; costCenterId?: string; reminderOffsetDays?: number | null; description: string; amount: string; dueDate: string; type: 'INCOME' | 'EXPENSE'; schedule: Schedule; effectiveDate?: string; overrides?: { number: number; amount?: string; dueDate?: string; effectiveDate?: string | null }[] };
export async function createSeries(context: GraphQLContext, input: SeriesInput) {
  const userId = requireVerifiedUserId(context);
  const reminderOffsetDays = validateReminderOffsetDays(input.reminderOffsetDays);
  if (!input.description.trim() || input.description.length > 120) invalid('Descrição inválida.');
  if (!['INCOME', 'EXPENSE'].includes(input.type)) invalid('Tipo inválido.');
  let total = input.schedule.total;
  if (input.schedule.mode === 'FIXED') {
    const start = day(input.dueDate);
    const horizon = new Date(); horizon.setUTCMonth(horizon.getUTCMonth() + 12);
    total = input.schedule.first - 1 + Math.max(12, (horizon.getUTCFullYear() - start.getUTCFullYear()) * 12 + horizon.getUTCMonth() - start.getUTCMonth() + 1);
  }
  let parts = installments(input.amount, input.dueDate, { ...input.schedule, total });
  const originalTotal = parts.reduce((sum, part) => sum + cents(part.amount), 0n);
  const overrides = input.overrides ?? [];
  if (new Set(overrides.map(item => item.number)).size !== overrides.length || overrides.some(item => !parts.some(part => part.number === item.number))) invalid('Parcelas personalizadas inválidas.');
  parts = parts.map(part => {
    const override = overrides.find(item => item.number === part.number);
    if (override?.amount) cents(override.amount);
    return { ...part, amount: override?.amount ?? part.amount, dueDate: override?.dueDate ? day(override.dueDate) : part.dueDate };
  });
  if (input.schedule.mode === 'INSTALLMENTS' && parts.reduce((sum, part) => sum + cents(part.amount), 0n) !== originalTotal) invalid('Soma das parcelas deve preservar valor total.');
  return getPrismaClient().$transaction(async tx => {
    await lock(tx, userId);
    const selected = await account(tx, userId, input.financialAccountId);
    input = { ...input, financialAccountId: selected.id };
    const category = await tx.financialCategory.findFirst({ where: { id: input.categoryId, userId, deletedAt: null, type: { in: [input.type, 'BOTH'] } } });
    if (!category) invalid('Categoria inválida.');
    const seriesId = input.operationId;
    const existing = await tx.financialSeries.findUnique({ where: { id: seriesId } });
    if (existing && (existing.userId !== userId || canonical(existing.spec) !== canonical(input))) invalid('operationId já utilizado com outros dados.');
    if (existing?.cancelled) invalid('Série cancelada.');
    if (!existing) await tx.financialSeries.create({ data: { id: seriesId, userId, spec: JSON.parse(JSON.stringify(input)) } });
    for (const part of parts) {
      const where = { seriesId, installmentNumber: part.number };
      if (input.type === 'EXPENSE' ? await tx.accountPayable.findFirst({ where }) : await tx.accountReceivable.findFirst({ where })) continue;
      const data = { userId, reminderOffsetDays, financialAccountId: input.financialAccountId, categoryId: input.categoryId, costCenterId: input.costCenterId ?? null, description: input.description, amount: part.amount, dueDate: part.dueDate, seriesId, installmentNumber: part.number, installmentTotal: input.schedule.mode === 'FIXED' ? null : input.schedule.total };
      const override = overrides.find(item => item.number === part.number);
      const effective = override?.effectiveDate === null ? null : override?.effectiveDate ? day(override.effectiveDate) : input.effectiveDate && (input.schedule.mode !== 'FIXED' || part.number === 1) ? day(input.effectiveDate) : null;
      if (input.type === 'EXPENSE') {
        await tx.accountPayable.create({ data: { ...data, status: effective ? 'PAID' : 'PENDING', paidAt: effective } });
      } else {
        await tx.accountReceivable.create({ data: { ...data, status: effective ? 'RECEIVED' : 'PENDING', receivedAt: effective } });
      }
    }
    return seriesId;
  });
}

export const brands = ['Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard', 'Diners Club', 'Outra'];
export type CardInput = { id?: string; financialAccountId: string; name: string; brand: string; creditLimit: string; dueDay: number; closingDay: number; dynamicDays?: number | null; businessDays: boolean; isPrimary: boolean; archived?: boolean };
export async function saveCard(context: GraphQLContext, input: CardInput) {
  const userId = requireVerifiedUserId(context);
  cents(input.creditLimit);
  if (!input.name.trim() || input.name.length > 120 || !input.brand.trim() || input.brand.length > 60) invalid('Nome ou bandeira inválidos.');
  if (![input.dueDay, input.closingDay].every(n => Number.isInteger(n) && n >= 1 && n <= 31) || (input.dynamicDays != null && (!Number.isInteger(input.dynamicDays) || input.dynamicDays < 1 || input.dynamicDays > 28))) invalid('Dias de vencimento/fechamento inválidos.');
  return getPrismaClient().$transaction(async tx => {
    await lock(tx, userId); await account(tx, userId, input.financialAccountId);
    if (input.id && !await tx.creditCard.findFirst({ where: { id: input.id, userId } })) invalid('Cartão não encontrado.');
    const previous = input.id ? await tx.creditCard.findUnique({ where: { id: input.id } }) : null;
    const primary = !input.archived && (input.isPrimary || Boolean(previous?.isPrimary) || !await tx.creditCard.count({ where: { userId, archived: false } }));
    if (primary) await tx.creditCard.updateMany({ where: { userId }, data: { isPrimary: false } });
    const { id, ...data } = input;
    const result = id ? await tx.creditCard.update({ where: { id }, data: { ...data, isPrimary: primary } }) : await tx.creditCard.create({ data: { ...data, userId, isPrimary: primary } });
    if (!await tx.creditCard.count({ where: { userId, archived: false, isPrimary: true } })) {
      const replacement = await tx.creditCard.findFirst({ where: { userId, archived: false }, orderBy: { id: 'asc' } });
      if (replacement) await tx.creditCard.update({ where: { id: replacement.id }, data: { isPrimary: true } });
    }
    return result;
  });
}
export type PurchaseInput = { operationId: string; cardId: string; categoryId: string; description: string; amount: string; purchasedOn: string; total: number; first: number };
export async function purchase(context: GraphQLContext, input: PurchaseInput) {
  const userId = requireVerifiedUserId(context);
  const start = day(input.purchasedOn);
  if (!input.description.trim() || input.description.length > 120) invalid('Descrição inválida.');
  return getPrismaClient().$transaction(async tx => {
    await lock(tx, userId);
    const card = await tx.creditCard.findFirst({ where: { id: input.cardId, userId, archived: false } });
    if (!card) invalid('Cartão não encontrado.');
    if (!await tx.financialCategory.findFirst({ where: { id: input.categoryId, userId, deletedAt: null, type: { in: ['EXPENSE', 'BOTH'] } } })) invalid('Categoria inválida.');
    const previous = await tx.creditCardPurchase.findMany({ where: { cardId: card.id, operationId: input.operationId }, orderBy: { installmentNumber: 'asc' } });
    let month = start.getUTCMonth();
    let dates = statementDates(start.getUTCFullYear(), month, card.dueDay, card.closingDay, card.dynamicDays, card.businessDays);
    while (start >= dates.closing) dates = statementDates(start.getUTCFullYear(), ++month, card.dueDay, card.closingDay, card.dynamicDays, card.businessDays);
    const parts = installments(input.amount, dates.due.toISOString().slice(0, 10), { mode: 'INSTALLMENTS', first: input.first, total: input.total, frequency: 'MONTHLY' });
    if (previous.length) {
      if (previous.length !== parts.length || previous.some((p, i) => p.description !== input.description || p.categoryId !== input.categoryId || cents(String(p.amount)) !== cents(parts[i]!.amount))) invalid('operationId já utilizado com outros dados.');
      return true;
    }
    for (const part of parts) {
      const cycle = statementDates(start.getUTCFullYear(), month + part.number - input.first, card.dueDay, card.closingDay, card.dynamicDays, card.businessDays);
      await tx.creditCardPurchase.create({ data: { cardId: card.id, categoryId: input.categoryId, description: input.description, amount: part.amount, dueDate: cycle.due, closingDate: cycle.closing, installmentNumber: part.number, installmentTotal: input.total, operationId: input.operationId } });
      const cardStatementKey = card.id + ':' + cycle.due.toISOString().slice(0, 10);
      const existingStatement = await tx.accountPayable.findUnique({ where: { cardStatementKey } });
      const cycleItems = await tx.creditCardPurchase.findMany({ where: { cardId: card.id, dueDate: cycle.due } });
      const outstanding = cycleItems.reduce((sum, item) => sum + cents(String(item.amount)) - cents(String(item.paidAmount), true), 0n);
      if (existingStatement) {
        await tx.accountPayable.update({ where: { id: existingStatement.id }, data: { amount: money(outstanding), status: 'PENDING', paidAt: null } });
      } else {
        await tx.accountPayable.create({ data: { cardStatementKey, financialAccountId: card.financialAccountId, userId, categoryId: input.categoryId, description: ('Fatura ' + card.name).slice(0, 120), amount: part.amount, dueDate: cycle.due } });
      }
    }
    return true;
  });
}
export async function statements(context: GraphQLContext, cardId: string) {
  const userId = requireVerifiedUserId(context);
  const items = await getPrismaClient().creditCardPurchase.findMany({ where: { cardId, card: { userId } }, orderBy: { dueDate: 'asc' } });
  const grouped = new Map<string, { dueDate: string; closingDate: string; total: bigint; paid: bigint; items: typeof items }>();
  for (const item of items) {
    const key = item.dueDate.toISOString().slice(0, 10);
    const group = grouped.get(key) ?? { dueDate: key, closingDate: item.closingDate.toISOString().slice(0, 10), total: 0n, paid: 0n, items: [] };
    group.total += cents(String(item.amount)); group.paid += cents(String(item.paidAmount), true); group.items.push(item); grouped.set(key, group);
  }
  return [...grouped.values()].map(g => ({ ...g, total: money(g.total), paid: money(g.paid), outstanding: money(g.total - g.paid) }));
}
export type PaymentInput = { cardId: string; operationId: string; dueDate: string; paidOn: string; amount: string };
export async function payCard(context: GraphQLContext, input: PaymentInput) {
  const userId = requireVerifiedUserId(context);
  const amount = cents(input.amount);
  return getPrismaClient().$transaction(async tx => {
    await lock(tx, userId);
    const card = await tx.creditCard.findFirst({ where: { id: input.cardId, userId, archived: false } });
    if (!card) invalid('Cartão não encontrado.');
    await account(tx, userId, card.financialAccountId);
    const previous = await tx.creditCardPayment.findUnique({ where: { cardId_operationId: { cardId: card.id, operationId: input.operationId } } });
    if (previous) {
      if (cents(String(previous.amount)) !== amount || previous.paidOn.toISOString().slice(0, 10) !== input.paidOn || previous.dueDate.toISOString().slice(0, 10) !== input.dueDate) invalid('operationId já utilizado com outros dados.');
      return true;
    }
    const items = await tx.creditCardPurchase.findMany({ where: { cardId: card.id, dueDate: day(input.dueDate) }, orderBy: { id: 'asc' } });
    const outstanding = items.reduce((sum, p) => sum + cents(String(p.amount)) - cents(String(p.paidAmount), true), 0n);
    if (amount > outstanding) invalid('Pagamento excede saldo da fatura.');
    const payment = await tx.creditCardPayment.create({ data: { ...input, dueDate: day(input.dueDate), paidOn: day(input.paidOn) } });
    const open = items.filter(p => cents(String(p.amount)) > cents(String(p.paidAmount), true));
    const allocations = allocate(amount, open.map(p => cents(String(p.amount)) - cents(String(p.paidAmount), true)));
    const allocationRecord: Record<string, string> = {};
    for (let i = 0; i < open.length; i++) {
      const item = open[i]!;
      const part = allocations[i]!;
      if (!part) continue;
      allocationRecord[item.id] = money(part);
      await tx.creditCardPurchase.update({ where: { id: item.id }, data: { paidAmount: money(cents(String(item.paidAmount), true) + part) } });
      await tx.expense.create({ data: { userId, financialAccountId: card.financialAccountId, categoryId: item.categoryId, description: item.description, amount: money(part), occurredAt: day(input.paidOn), notes: `Pagamento de fatura ${payment.id}` } });
    }
    await tx.creditCardPayment.update({ where: { id: payment.id }, data: { allocations: allocationRecord } });
    await tx.accountPayable.updateMany({ where: { userId, cardStatementKey: card.id + ':' + input.dueDate }, data: { amount: money(amount === outstanding ? items.reduce((sum, item) => sum + cents(String(item.amount)), 0n) : outstanding - amount), status: amount === outstanding ? 'PAID' : 'PENDING', paidAt: amount === outstanding ? day(input.paidOn) : null } });
    return true;
  });
}
export async function reverseCardPayment(context: GraphQLContext, id: string) {
  const userId = requireVerifiedUserId(context);
  return getPrismaClient().$transaction(async tx => {
    await lock(tx, userId);
    const payment = await tx.creditCardPayment.findFirst({ where: { id, card: { userId } } });
    if (!payment) invalid('Pagamento não encontrado.');
    if (payment.reversed) return true;
    for (const [purchaseId, amount] of Object.entries(payment.allocations as Record<string, string>)) {
      const item = await tx.creditCardPurchase.findFirst({ where: { id: purchaseId, cardId: payment.cardId } });
      if (!item) invalid('Item da fatura não encontrado.');
      await tx.creditCardPurchase.update({ where: { id: item.id }, data: { paidAmount: money(cents(String(item.paidAmount), true) - cents(amount)) } });
    }
    await tx.expense.updateMany({ where: { userId, notes: `Pagamento de fatura ${id}` }, data: { deletedAt: new Date() } });
    await tx.creditCardPayment.update({ where: { id }, data: { reversed: true } });
    const items = await tx.creditCardPurchase.findMany({ where: { cardId: payment.cardId, dueDate: payment.dueDate } });
    const outstanding = items.reduce((sum, item) => sum + cents(String(item.amount)) - cents(String(item.paidAmount), true), 0n);
    await tx.accountPayable.updateMany({ where: { userId, cardStatementKey: payment.cardId + ':' + payment.dueDate.toISOString().slice(0, 10) }, data: { amount: money(outstanding), status: 'PENDING', paidAt: null } });
    return true;
  });
}


export async function syncSeries(context: GraphQLContext) {
  const userId = requireVerifiedUserId(context);
  const series = await getPrismaClient().financialSeries.findMany({ where: { userId, cancelled: false } });
  for (const item of series) {
    const input = item.spec as unknown as SeriesInput;
    if (input.schedule.mode === 'FIXED') await createSeries(context, input);
  }
  return true;
}
export async function cancelSeries(context: GraphQLContext, id: string, fromNumber: number) {
  const userId = requireVerifiedUserId(context);
  return getPrismaClient().$transaction(async tx => {
    await lock(tx, userId);
    const series = await tx.financialSeries.findFirst({ where: { id, userId } });
    if (!series) invalid('Série não encontrada.');
    await tx.financialSeries.update({ where: { id }, data: { cancelled: true } });
    const where = { userId, seriesId: id, installmentNumber: { gte: fromNumber }, status: { in: ['PENDING', 'OVERDUE'] } };
    await tx.accountPayable.updateMany({ where, data: { status: 'CANCELLED' } });
    await tx.accountReceivable.updateMany({ where, data: { status: 'CANCELLED' } });
    return true;
  });
}
export type UpdateSeriesInput = { id: string; fromNumber: number; financialAccountId: string; categoryId: string; costCenterId?: string; reminderOffsetDays?: number | null; description: string; amount: string; dueDate: string };
export async function updateSeries(context: GraphQLContext, input: UpdateSeriesInput) {
  const userId = requireVerifiedUserId(context);
  cents(input.amount); day(input.dueDate);
  const reminderOffsetDays = validateReminderOffsetDays(input.reminderOffsetDays);
  if (!input.description.trim() || input.description.length > 120) invalid('Descrição inválida.');
  return getPrismaClient().$transaction(async tx => {
    await lock(tx, userId); await account(tx, userId, input.financialAccountId);
    const series = await tx.financialSeries.findFirst({ where: { id: input.id, userId, cancelled: false } });
    if (!series) invalid('Série não encontrada.');
    const previous = series.spec as unknown as SeriesInput;
    const rows = previous.type === 'EXPENSE' ? await tx.accountPayable.findMany({ where: { seriesId: input.id, userId } }) : await tx.accountReceivable.findMany({ where: { seriesId: input.id, userId } });
    const total = Math.max(...rows.map(row => row.installmentNumber ?? 0));
    if (!Number.isInteger(input.fromNumber) || !rows.some(row => row.installmentNumber === input.fromNumber && !row.deletedAt)) invalid('Parcela inicial inválida.');
    const schedule = { ...previous.schedule, first: input.fromNumber, total, mode: previous.schedule.mode === 'INSTALLMENTS' ? 'REPEAT' as const : previous.schedule.mode };
    const parts = installments(input.amount, input.dueDate, schedule);
    for (const part of parts) {
      const where = { userId, seriesId: input.id, installmentNumber: part.number, deletedAt: null, status: { in: ['PENDING', 'OVERDUE'] } };
      const data = { ...(input.reminderOffsetDays !== undefined ? { reminderOffsetDays } : {}), financialAccountId: input.financialAccountId, categoryId: input.categoryId, costCenterId: input.costCenterId ?? null, description: input.description, amount: part.amount, dueDate: part.dueDate };
      if (previous.type === 'EXPENSE') await tx.accountPayable.updateMany({ where, data });
      else await tx.accountReceivable.updateMany({ where, data });
    }
    const spec: SeriesInput = { ...(input.reminderOffsetDays !== undefined ? { reminderOffsetDays } : previous.reminderOffsetDays !== undefined ? { reminderOffsetDays: previous.reminderOffsetDays } : {}), operationId: input.id, financialAccountId: input.financialAccountId, categoryId: input.categoryId, description: input.description, amount: input.amount, dueDate: input.dueDate, type: previous.type, schedule, ...(input.costCenterId ? { costCenterId: input.costCenterId } : {}) };
    await tx.financialSeries.update({ where: { id: input.id }, data: { spec: JSON.parse(JSON.stringify(spec)) } });
    return true;
  });
}
