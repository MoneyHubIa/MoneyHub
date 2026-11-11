import { randomUUID } from 'node:crypto';
import { GraphQLError } from 'graphql';
import type { GraphQLContext } from '../../../core/graphql/graphql.js';
import { getPrismaClient, withTransactionClient } from '../../../core/database/database.js';
import type { BankStatementImport, Prisma } from '../../../generated/prisma/client.js';
import { requireVerifiedUserId } from '../financial-categories/financial-categories.js';
import { account, changeTransfer, payCard, transfer } from '../banking/banking.js';
import { canonical, cents, day, invalid, money } from '../banking/rules.js';
import { fingerprint, hash, MAX_ROWS, parseStatement, type CsvMapping, type StatementRow } from './parsers.js';

type Tx = Prisma.TransactionClient;
type Kind = 'PAYABLE' | 'RECEIVABLE' | 'TRANSFER' | 'CARD_PAYMENT' | 'CARD_STATEMENT';
export type ImportCandidate = {
  id: string; kind: Kind; label: string; amount: string; date: string;
  status: string; otherAccountId?: string; cardId?: string; statementDueDate?: string;
};
export type ReviewRow = StatementRow & { duplicate: boolean; possibleDuplicate: boolean; candidates: ImportCandidate[] };
export type ImportDecision = {
  rowNumber: number;
  action: 'CREATE' | 'LINK_ACCOUNT' | 'TRANSFER' | 'CARD_PAYMENT' | 'IGNORE';
  description?: string | null;
  categoryId?: string | null;
  targetId?: string | null;
  otherAccountId?: string | null;
  cardId?: string | null;
  statementDueDate?: string | null;
  acknowledgeDuplicate?: boolean | null;
};
export type ImportResult = {
  created: number; linked: number; ignored: number; transfers: number; cardPayments: number;
  incomeTotal: string; expenseTotal: string;
  entries: { rowNumber: number; entityKind: string; entityId: string; amount: string }[];
};
export type PreviewInput = { financialAccountId: string; fileName: string; base64: string; csvMapping?: CsvMapping | null; csvDelimiter?: string | null };

const iso = (date: Date) => date.toISOString().slice(0, 10);
const distance = (a: string, b: string) => Math.abs(day(a).getTime() - day(b).getTime()) / 86_400_000;
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const uuid = (value: string) => {
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)) invalid('Identificador inválido.');
  return value;
};

async function currency(tx: Tx, userId: string) {
  return (await tx.profile.findUnique({ where: { userId } }))?.preferredCurrency ?? 'BRL';
}

/** Fetch matching data once per review; never query the database once per source line. */
async function review(tx: Tx, userId: string, financialAccountId: string, rows: StatementRow[]): Promise<ReviewRow[]> {
  const valid = rows.filter(row => !row.error && row.date && row.amount);
  const amounts = [...new Set(valid.map(row => row.amount!))];
  const dates = valid.map(row => row.date!).sort();
  const from = day(dates[0] ?? '2000-01-01'); from.setUTCDate(from.getUTCDate() - 7);
  const to = day(dates.at(-1) ?? '2000-01-01'); to.setUTCDate(to.getUTCDate() + 8);
  const where = { userId, financialAccountId, deletedAt: null, amount: { in: amounts } };
  const [receipts, payables, receivables, transfers, cards, incomes, expenses] = await Promise.all([
    tx.bankStatementImportEntry.findMany({ where: { userId, financialAccountId, OR: [{ sourceKey: { in: rows.map(row => row.sourceKey) } }, { fingerprint: { in: rows.map(row => row.fingerprint) } }] } }),
    tx.accountPayable.findMany({ where: { ...where, cardStatementKey: null, OR: [{ status: { in: ['PENDING', 'OVERDUE'] }, dueDate: { gte: from, lt: to } }, { status: 'PAID', paidAt: { gte: from, lt: to } }] } }),
    tx.accountReceivable.findMany({ where: { ...where, OR: [{ status: { in: ['PENDING', 'OVERDUE'] }, dueDate: { gte: from, lt: to } }, { status: 'RECEIVED', receivedAt: { gte: from, lt: to } }] } }),
    tx.transfer.findMany({ where: { userId, amount: { in: amounts }, status: { in: ['PENDING', 'COMPLETED'] }, AND: [{ OR: [{ sourceId: financialAccountId }, { destinationId: financialAccountId }] }, { OR: [{ status: 'PENDING', dueDate: { gte: from, lt: to } }, { status: 'COMPLETED', effectiveDate: { gte: from, lt: to } }] }] } }),
    tx.creditCard.findMany({ where: { userId, financialAccountId, archived: false }, include: { purchases: true, payments: { where: { reversed: false, paidOn: { gte: from, lt: to }, amount: { in: amounts } } } } }),
    tx.income.findMany({ where: { ...where, occurredAt: { gte: from, lt: to } } }),
    tx.expense.findMany({ where: { ...where, occurredAt: { gte: from, lt: to } } })
  ]);
  const keys = new Set(receipts.map(entry => entry.sourceKey));
  const fingerprints = new Set(receipts.map(entry => entry.fingerprint));
  for (const [items, sign] of [[incomes, 1n], [expenses, -1n]] as const) {
    for (const item of items) fingerprints.add(fingerprint(iso(item.occurredAt), item.description, money(sign * cents(String(item.amount)))));
  }
  const repeated = new Map<string, number>();
  for (const row of valid) repeated.set(row.fingerprint, (repeated.get(row.fingerprint) ?? 0) + 1);
  const result = rows.map(row => {
    const candidates: ImportCandidate[] = [];
    if (!row.error && row.date && row.amount) {
      if (row.direction === 'EXPENSE') {
        for (const item of payables) {
          const date = iso(item.paidAt ?? item.dueDate);
          if (cents(String(item.amount)) === cents(row.amount) && (item.status === 'PAID' ? item.paidAt != null && date === row.date : distance(iso(item.dueDate), row.date) <= 7)) {
            candidates.push({ id: item.id, kind: 'PAYABLE', label: item.description, amount: String(item.amount), date, status: item.status });
          }
        }
      } else {
        for (const item of receivables) {
          const date = iso(item.receivedAt ?? item.dueDate);
          if (cents(String(item.amount)) === cents(row.amount) && (item.status === 'RECEIVED' ? item.receivedAt != null && date === row.date : distance(iso(item.dueDate), row.date) <= 7)) {
            candidates.push({ id: item.id, kind: 'RECEIVABLE', label: item.description, amount: String(item.amount), date, status: item.status });
          }
        }
      }
      for (const item of transfers) {
        const outgoing = row.direction === 'EXPENSE';
        const side = outgoing ? item.sourceId : item.destinationId;
        const date = iso(item.effectiveDate ?? item.dueDate);
        if (side === financialAccountId && cents(String(item.amount)) === cents(row.amount) && (item.status === 'COMPLETED' ? item.effectiveDate != null && date === row.date : distance(iso(item.dueDate), row.date) <= 7)) {
          candidates.push({ id: item.id, kind: 'TRANSFER', label: 'Transferência entre contas', amount: String(item.amount), date, status: item.status, otherAccountId: outgoing ? item.destinationId : item.sourceId });
        }
      }
      if (row.direction === 'EXPENSE') for (const card of cards) {
        for (const payment of card.payments) if (iso(payment.paidOn) === row.date && cents(String(payment.amount)) === cents(row.amount)) {
          candidates.push({ id: payment.id, kind: 'CARD_PAYMENT', label: `Pagamento já registrado: ${card.name}`, amount: String(payment.amount), date: row.date, status: 'COMPLETED', cardId: card.id, statementDueDate: iso(payment.dueDate) });
        }
        const totals = new Map<string, bigint>();
        for (const purchase of card.purchases) {
          const due = iso(purchase.dueDate);
          totals.set(due, (totals.get(due) ?? 0n) + cents(String(purchase.amount)) - cents(String(purchase.paidAmount), true));
        }
        for (const [due, outstanding] of totals) if (outstanding >= cents(row.amount)) {
          candidates.push({ id: `${card.id}:${due}`, kind: 'CARD_STATEMENT', label: `${card.name} — fatura ${due} (em aberto: ${money(outstanding)})`, amount: money(outstanding), date: due, status: 'PENDING', cardId: card.id, statementDueDate: due });
        }
      }
    }
    return { ...row, duplicate: keys.has(row.sourceKey), possibleDuplicate: fingerprints.has(row.fingerprint) || (repeated.get(row.fingerprint) ?? 0) > 1, candidates };
  });
  const targetKeys = [...new Set(result.flatMap(row => row.candidates.filter(candidate => candidate.kind !== 'CARD_STATEMENT').map(candidate => `${candidate.kind}:${candidate.id}`)))];
  const linked = await tx.bankStatementImportEntry.findMany({ where: { userId, financialAccountId, targetKey: { in: targetKeys } }, select: { targetKey: true } });
  const used = new Set(linked.map(entry => entry.targetKey));
  for (const row of result) row.candidates = row.candidates.filter(candidate => !used.has(`${candidate.kind}:${candidate.id}`));
  return result;
}

async function view(tx: Tx, batch: BankStatementImport) {
  const rows = batch.rows as unknown as StatementRow[];
  return {
    id: batch.id, status: batch.status, fileName: batch.fileName, financialAccountId: batch.financialAccountId,
    currency: batch.currency, expiresAt: batch.expiresAt.toISOString(),
    rows: batch.status === 'CONFIRMED' ? [] : await review(tx, batch.userId, batch.financialAccountId, rows),
    result: batch.result as ImportResult | null
  };
}

async function owned(tx: Tx, userId: string, id: string) {
  const batch = await tx.bankStatementImport.findFirst({ where: { id: uuid(id), userId } });
  if (!batch) throw new GraphQLError('Importação não encontrada.', { extensions: { code: 'NOT_FOUND' } });
  if (batch.status === 'PENDING' && batch.expiresAt.getTime() <= Date.now()) invalid('Prévia expirada. Selecione o arquivo novamente.');
  return batch;
}

export async function getBankStatementImport(context: GraphQLContext, id: string) {
  const userId = requireVerifiedUserId(context);
  const db = getPrismaClient();
  return view(db, await owned(db, userId, id));
}

export async function previewBankStatementImport(context: GraphQLContext, input: PreviewInput) {
  const userId = requireVerifiedUserId(context);
  const db = getPrismaClient();
  await account(db, userId, uuid(input.financialAccountId));
  const selectedCurrency = await currency(db, userId);
  const parsed = parseStatement(input.fileName, input.base64, input.csvMapping, input.csvDelimiter);
  if (parsed.currency && parsed.currency !== selectedCurrency) invalid(`Moeda do extrato (${parsed.currency}) diferente do perfil (${selectedCurrency}). Não há conversão cambial.`);
  if (parsed.mappingRequired) return { mappingRequired: true, headers: parsed.headers, samples: parsed.samples, delimiter: parsed.delimiter, sourceAccount: null, batch: null };
  await db.bankStatementImport.deleteMany({ where: { userId, status: 'PENDING', expiresAt: { lte: new Date() } } });
  const batch = await db.bankStatementImport.create({ data: {
    userId, financialAccountId: input.financialAccountId, fileName: input.fileName, format: parsed.format,
    fileHash: parsed.fileHash, currency: selectedCurrency, rows: json(parsed.rows), expiresAt: new Date(Date.now() + 86_400_000)
  } });
  return { mappingRequired: false, headers: [], samples: [], delimiter: parsed.delimiter, sourceAccount: parsed.sourceAccount, batch: await view(db, batch) };
}

export async function confirmBankStatementImport(context: GraphQLContext, input: { id: string; decisions: ImportDecision[] }): Promise<ImportResult> {
  const userId = requireVerifiedUserId(context);
  uuid(input.id);
  if (!input.decisions.length || input.decisions.length > MAX_ROWS || new Set(input.decisions.map(item => item.rowNumber)).size !== input.decisions.length) invalid('Decisões inválidas ou repetidas.');
  const decisions = [...input.decisions].sort((a, b) => a.rowNumber - b.rowNumber).map(item => ({
    rowNumber: item.rowNumber, action: item.action, description: item.description?.trim() || null,
    categoryId: item.categoryId || null, targetId: item.targetId || null, otherAccountId: item.otherAccountId || null,
    cardId: item.cardId || null, statementDueDate: item.statementDueDate || null, acknowledgeDuplicate: item.acknowledgeDuplicate === true
  }));
  const confirmationHash = hash(canonical(decisions));
  return getPrismaClient().$transaction(async tx => {
    // Banking services use this same user lock. Nested calls reuse this transaction.
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR NO KEY UPDATE`;
    await tx.$queryRaw`SELECT id FROM bank_statement_imports WHERE id = ${input.id}::uuid AND user_id = ${userId}::uuid FOR UPDATE`;
    const batch = await owned(tx, userId, input.id);
    if (batch.status === 'CONFIRMED') {
      if (batch.confirmationHash !== confirmationHash) invalid('Lote já confirmado com outras decisões. Gere uma nova prévia.');
      return batch.result as unknown as ImportResult;
    }
    await account(tx, userId, batch.financialAccountId);
    if (await currency(tx, userId) !== batch.currency) invalid('Moeda do perfil alterada. Gere uma nova prévia.');
    // Manual commitment mutations do not take the banking user lock. Lock their
    // rows before re-reading candidates so a concurrent edit cannot be reconciled
    // against a stale amount, account, status or settlement date.
    const accountTargets = decisions.filter(item => item.action === 'LINK_ACCOUNT').map(item => uuid(item.targetId ?? '')).sort();
    for (const target of accountTargets) {
      await tx.$queryRaw`SELECT id FROM accounts_payable WHERE id = ${target}::uuid AND user_id = ${userId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM accounts_receivable WHERE id = ${target}::uuid AND user_id = ${userId}::uuid FOR UPDATE`;
    }
    const rows = await review(tx, userId, batch.financialAccountId, batch.rows as unknown as StatementRow[]);
    if (decisions.length !== rows.length || decisions.some(item => !rows.some(row => row.rowNumber === item.rowNumber))) invalid('Revise todas as linhas antes de confirmar.');
    const categoryIds = [...new Set(decisions.filter(item => item.action === 'CREATE').map(item => uuid(item.categoryId ?? '')))];
    const categories = new Map((await tx.financialCategory.findMany({ where: { userId, id: { in: categoryIds }, deletedAt: null } })).map(item => [item.id, item]));
    const receipts: Prisma.BankStatementImportEntryCreateManyInput[] = [];
    const usedTargets = new Set<string>();
    const result: ImportResult = { created: 0, linked: 0, ignored: 0, transfers: 0, cardPayments: 0, incomeTotal: '0.00', expenseTotal: '0.00', entries: [] };
    let income = 0n, expense = 0n;
    for (const decision of decisions) {
      const row = rows.find(item => item.rowNumber === decision.rowNumber)!;
      if (decision.action === 'IGNORE') { result.ignored++; continue; }
      if (row.error || !row.date || !row.amount || !row.direction) invalid(`Linha ${row.rowNumber}: corrija ou ignore a movimentação inválida.`);
      if (row.duplicate) invalid(`Linha ${row.rowNumber}: movimentação já importada. Gere uma nova prévia.`);
      if (row.possibleDuplicate && !decision.acknowledgeDuplicate) invalid(`Linha ${row.rowNumber}: confirme a revisão do possível duplicado.`);
      const amount = row.amount;
      const date = day(row.date);
      let kind: Exclude<Kind, 'CARD_STATEMENT'>;
      let entityId: string;
      if (decision.action === 'CREATE') {
        const description = decision.description ?? row.description;
        if (!description.trim() || description.length > 120) invalid(`Linha ${row.rowNumber}: descrição deve ter de 1 a 120 caracteres.`);
        const category = categories.get(decision.categoryId ?? '');
        if (!category || ![row.direction, 'BOTH'].includes(category.type)) invalid(`Linha ${row.rowNumber}: categoria inválida.`);
        const data = { userId, financialAccountId: batch.financialAccountId, categoryId: category.id, description, amount, dueDate: date };
        if (row.direction === 'EXPENSE') { kind = 'PAYABLE'; entityId = (await tx.accountPayable.create({ data: { ...data, status: 'PAID', paidAt: date } })).id; }
        else { kind = 'RECEIVABLE'; entityId = (await tx.accountReceivable.create({ data: { ...data, status: 'RECEIVED', receivedAt: date } })).id; }
        result.created++;
      } else if (decision.action === 'LINK_ACCOUNT') {
        const expected = row.direction === 'EXPENSE' ? 'PAYABLE' : 'RECEIVABLE';
        const candidate = row.candidates.find(item => item.id === decision.targetId && item.kind === expected);
        if (!candidate) invalid(`Linha ${row.rowNumber}: conta incompatível ou alterada. Gere uma nova prévia.`);
        kind = expected; entityId = candidate.id;
        if (candidate.status === 'PENDING' || candidate.status === 'OVERDUE') {
          const where = { id: entityId, userId, financialAccountId: batch.financialAccountId, amount, deletedAt: null, status: { in: ['PENDING', 'OVERDUE'] } };
          const changed = kind === 'PAYABLE'
            ? await tx.accountPayable.updateMany({ where: { ...where, cardStatementKey: null }, data: { status: 'PAID', paidAt: date } })
            : await tx.accountReceivable.updateMany({ where, data: { status: 'RECEIVED', receivedAt: date } });
          if (changed.count !== 1) invalid('Conta alterada durante a revisão. Gere uma nova prévia.');
        }
        result.linked++;
      } else if (decision.action === 'TRANSFER') {
        kind = 'TRANSFER';
        if (decision.targetId) {
          const candidate = row.candidates.find(item => item.id === decision.targetId && item.kind === 'TRANSFER');
          if (!candidate) invalid(`Linha ${row.rowNumber}: transferência incompatível ou alterada.`);
          const current = await tx.transfer.findFirst({ where: { id: candidate.id, userId } });
          if (!current) invalid('Transferência não encontrada.');
          await account(tx, userId, current.sourceId); await account(tx, userId, current.destinationId);
          if (current.status === 'PENDING') await withTransactionClient(tx, () => changeTransfer(context, current.id, false, row.date!));
          entityId = current.id; result.linked++;
        } else {
          const other = await account(tx, userId, uuid(decision.otherAccountId ?? ''));
          if (other.id === batch.financialAccountId) invalid('Origem e destino devem ser diferentes.');
          const outgoing = row.direction === 'EXPENSE';
          const created = await withTransactionClient(tx, () => transfer(context, {
            operationId: randomUUID(), sourceId: outgoing ? batch.financialAccountId : other.id,
            destinationId: outgoing ? other.id : batch.financialAccountId, amount, dueDate: row.date!, effectiveDate: row.date!
          }));
          entityId = created.id;
        }
        result.transfers++;
      } else if (decision.action === 'CARD_PAYMENT') {
        kind = 'CARD_PAYMENT';
        if (row.direction !== 'EXPENSE') invalid('Pagamento de fatura precisa ser uma saída.');
        if (decision.targetId) {
          const candidate = row.candidates.find(item => item.id === decision.targetId && item.kind === 'CARD_PAYMENT');
          if (!candidate) invalid(`Linha ${row.rowNumber}: pagamento incompatível ou alterado.`);
          entityId = candidate.id; result.linked++;
        } else {
          const candidate = row.candidates.find(item => item.kind === 'CARD_STATEMENT' && item.cardId === decision.cardId && item.statementDueDate === decision.statementDueDate);
          if (!candidate) invalid(`Linha ${row.rowNumber}: cartão/fatura incompatível ou saldo insuficiente.`);
          const operationId = randomUUID();
          await withTransactionClient(tx, () => payCard(context, { cardId: candidate.cardId!, operationId, dueDate: candidate.statementDueDate!, paidOn: row.date!, amount }));
          entityId = (await tx.creditCardPayment.findUniqueOrThrow({ where: { cardId_operationId: { cardId: candidate.cardId!, operationId } } })).id;
        }
        result.cardPayments++;
      } else invalid('Ação de importação inválida.');
      const targetKey = `${kind}:${entityId}`;
      // Existing claims were excluded by review under the user lock. Guard
      // repeated targets inside this batch before writing all receipts at once.
      if (usedTargets.has(targetKey)) invalid(`Linha ${row.rowNumber}: destino já conciliado neste lote.`);
      usedTargets.add(targetKey);
      receipts.push({ importId: batch.id, userId, financialAccountId: batch.financialAccountId, rowNumber: row.rowNumber, sourceKey: row.sourceKey, fingerprint: row.fingerprint, entityKind: kind, entityId, targetKey });
      result.entries.push({ rowNumber: row.rowNumber, entityKind: kind, entityId, amount });
      if (row.direction === 'INCOME') income += cents(amount); else expense += cents(amount);
    }
    result.incomeTotal = money(income); result.expenseTotal = money(expense);
    if (receipts.length) await tx.bankStatementImportEntry.createMany({ data: receipts });
    await tx.bankStatementImport.update({ where: { id: batch.id }, data: { status: 'CONFIRMED', confirmationHash, result: json(result) } });
    return result;
  }, { maxWait: 10_000, timeout: 30_000 });
}
