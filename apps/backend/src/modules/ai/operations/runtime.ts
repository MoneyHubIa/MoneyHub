import { getPrismaClient } from '../../../core/database/database.js';
import type { GraphQLContext } from '../../../core/graphql/graphql.js';
import { requireVerifiedUserId } from '../../finance/financial-categories/financial-categories.js';
import { cents, day, money } from '../../finance/banking/rules.js';
import { inputFields, OPERATIONS, type OperationCatalog } from './catalog.js';
import { badInput, fingerprint, mapValues, object, REFERENCE, UUID } from './validation.js';
import { json, type Arguments, type Detail, type OperationRuntime, type Snapshot } from './types.js';

const TABLES: Record<string, string> = {
  profile: 'profiles', category: 'financial_categories', costCenter: 'cost_centers',
  income: 'incomes', expense: 'expenses', payable: 'accounts_payable', receivable: 'accounts_receivable',
  recurring: 'recurring_transactions', account: 'financial_accounts', transfer: 'transfers',
  card: 'credit_cards', cardPayment: 'credit_card_payments', series: 'financial_series',
  goal: 'financial_goals', event: 'calendar_events', notification: 'notifications'
};
const LINKS: Record<string, string> = {
  categoryId: 'category', financialAccountId: 'account', costCenterId: 'costCenter',
  cardId: 'card', goalId: 'goal', sourceId: 'account', destinationId: 'account'
};
const LABELS: Record<string, string> = {
  id: 'Registro', categoryId: 'Categoria', financialAccountId: 'Conta bancária', costCenterId: 'Centro de custo',
  cardId: 'Cartão', goalId: 'Meta', sourceId: 'Origem', destinationId: 'Destino',
  description: 'Descrição', name: 'Nome', title: 'Título', amount: 'Valor', dueDate: 'Vencimento',
  targetAmount: 'Valor da meta', initialBalance: 'Saldo inicial', creditLimit: 'Limite do cartão',
  occurredAt: 'Data', occurredOn: 'Data da movimentação', paidAt: 'Data do pagamento',
  receivedAt: 'Data do recebimento', purchasedOn: 'Data da compra', paidOn: 'Data do pagamento',
  effectiveDate: 'Data de efetivação', startDate: 'Início', endDate: 'Fim', deadline: 'Prazo',
  scheduledDate: 'Data do evento', recurrenceEndDate: 'Fim da recorrência',
  status: 'Situação', type: 'Tipo', brand: 'Bandeira', dueDay: 'Dia do vencimento', closingDay: 'Dia de fechamento',
  dynamicDays: 'Dias antes do vencimento', businessDays: 'Ajustar para dia útil', isPrimary: 'Cartão principal',
  isDefault: 'Conta padrão', archived: 'Arquivado', first: 'Primeira parcela', total: 'Total de parcelas',
  fromNumber: 'A partir da parcela', frequency: 'Frequência', mode: 'Modalidade', interval: 'Intervalo', unit: 'Unidade',
  reminderOffsetDays: 'Antecedência do lembrete (dias)', recurrenceRule: 'Recorrência',
  preferredCurrency: 'Moeda', theme: 'Tema', fullName: 'Nome completo', accountNumber: 'Número da conta',
  additionalData: 'Dados adicionais', notes: 'Observações', cancel: 'Cancelar transferência', today: 'Data de referência',
  color: 'Cor', icon: 'Ícone'
};
const VALUES: Record<string, string> = {
  PENDING: 'Pendente', PAID: 'Pago', RECEIVED: 'Recebido', OVERDUE: 'Atrasado', CANCELLED: 'Cancelado',
  INCOME: 'Receita', EXPENSE: 'Despesa', BOTH: 'Receita e despesa',
  CONTRIBUTION: 'Aporte', WITHDRAWAL: 'Retirada', CHECKING: 'Conta corrente', SAVINGS: 'Poupança',
  INVESTMENT: 'Investimento', OTHER: 'Outra', ONCE: 'Único', INSTALLMENTS: 'Parcelado', REPEAT: 'Repetir valor', FIXED: 'Fixo',
  DAILY: 'Diária', WEEKLY: 'Semanal', MONTHLY: 'Mensal', QUARTERLY: 'Trimestral', YEARLY: 'Anual', CUSTOM: 'Personalizada',
  DAYS: 'Dias', WEEKS: 'Semanas', MONTHS: 'Meses', SYSTEM: 'Sistema', LIGHT: 'Claro', DARK: 'Escuro'
};
const MONEY_FIELDS = new Set(['amount', 'targetAmount', 'initialBalance', 'creditLimit']);
const DATE_FIELDS = new Set(['dueDate', 'occurredAt', 'occurredOn', 'paidAt', 'receivedAt', 'purchasedOn', 'paidOn', 'effectiveDate', 'startDate', 'endDate', 'deadline', 'scheduledDate', 'recurrenceEndDate', 'today']);
const BULK: Record<string, string[]> = {
  processRecurringTransactions: ['recurring'], syncFinancialSeries: ['series'],
  syncAgendaNotifications: ['event', 'payable', 'receivable'], markAllNotificationsRead: ['notification']
};

async function records(context: GraphQLContext, entity: string, id?: string): Promise<Arguments[]> {
  const userId = requireVerifiedUserId(context);
  const db = getPrismaClient();
  const where = { userId, ...(id ? { id } : {}) };
  let rows: unknown;
  switch (entity) {
    case 'profile': rows = await db.profile.findMany({ where }); break;
    case 'category': rows = await db.financialCategory.findMany({ where: { ...where, deletedAt: null } }); break;
    case 'costCenter': rows = await db.costCenter.findMany({ where: { ...where, deletedAt: null } }); break;
    case 'income': rows = await db.income.findMany({ where: { ...where, deletedAt: null } }); break;
    case 'expense': rows = await db.expense.findMany({ where: { ...where, deletedAt: null } }); break;
    case 'payable': rows = await db.accountPayable.findMany({ where: { ...where, deletedAt: null } }); break;
    case 'receivable': rows = await db.accountReceivable.findMany({ where: { ...where, deletedAt: null } }); break;
    case 'recurring': rows = await db.recurringTransaction.findMany({ where }); break;
    case 'account': rows = await db.financialAccount.findMany({ where }); break;
    case 'transfer': rows = await db.transfer.findMany({ where }); break;
    case 'card': rows = await db.creditCard.findMany({ where }); break;
    case 'cardPayment': rows = await db.creditCardPayment.findMany({ where: { ...(id ? { id } : {}), card: { userId } } }); break;
    case 'series': rows = await db.financialSeries.findMany({ where }); break;
    case 'goal': rows = await db.financialGoal.findMany({ where: { ...where, deletedAt: null } }); break;
    case 'event': rows = await db.calendarEvent.findMany({ where }); break;
    case 'notification': rows = await db.notification.findMany({ where }); break;
    default: badInput('Tipo de registro desconhecido.');
  }
  return json<Arguments[]>(rows).sort((left, right) => String(left.id).localeCompare(String(right.id)));
}
function recordName(record: Arguments): string {
  return String(record.name ?? record.description ?? record.title ?? record.fullName ?? record.id);
}
function normalize(value: unknown, key: string): unknown {
  if (value == null) return value;
  if (MONEY_FIELDS.has(key)) {
    if (typeof value !== 'string' && typeof value !== 'number') badInput('Valor monetário inválido.');
    let text = String(value).trim().replace(/^(R\$|BRL)\s*/i, '');
    if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
    return money(cents(text, key === 'initialBalance'));
  }
  if (DATE_FIELDS.has(key)) {
    if (typeof value !== 'string') badInput('Data inválida.');
    day(value.slice(0, 10));
    if (value.length !== 10 && !Number.isFinite(Date.parse(value))) badInput('Data inválida.');
  }
  return value;
}
function renderValue(key: string, value: unknown, names: Map<string, string>, currency: string): string {
  if (value == null) return 'Não informado';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'string' && REFERENCE.test(value)) return `Registro criado na ação ${value.match(REFERENCE)![1]}`;
  if (typeof value === 'string' && names.has(value)) return names.get(value)!;
  if (MONEY_FIELDS.has(key) && typeof value === 'string') {
    const minor = cents(value, true);
    const absolute = minor < 0n ? -minor : minor;
    const integer = String(absolute / 100n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${minor < 0n ? '-' : ''}${currency === 'BRL' ? 'R$' : currency} ${integer},${String(absolute % 100n).padStart(2, '0')}`;
  }
  if (DATE_FIELDS.has(key) && typeof value === 'string') return value.slice(0, 10).split('-').reverse().join('/');
  return typeof value === 'string' ? VALUES[value] ?? value : JSON.stringify(value);
}

export function createOperationRuntime(catalog: OperationCatalog): OperationRuntime {
  return {
    list: catalog.list, schema: catalog.schema,
    async read(context, name, args, search = '', offset = 0) {
      requireVerifiedUserId(context);
      if (!Number.isInteger(offset) || offset < 0 || offset > 100000) badInput('Página inválida.');
      const value = json<unknown>(await catalog.invoke(context, name, catalog.coerce(name, args, false), false));
      if (!Array.isArray(value)) return value;
      const needle = search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const matches = needle ? value.filter(item => JSON.stringify(item).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(needle)) : value;
      return { items: matches.slice(offset, offset + 50), total: matches.length, hasMore: offset + 50 < matches.length };
    },
    async prepare(context, action, id, previous) {
      const userId = requireVerifiedUserId(context);
      if (!Object.hasOwn(OPERATIONS, action.operation)) badInput('Operação não disponível.');
      let args = json<Arguments>(action.arguments);
      const fields = inputFields(catalog.graph, action.operation);
      const input = args.input === undefined ? args : object(args.input);
      if (fields.operationId) input.operationId = id;
      const creating = action.operation.startsWith('create') || (['saveFinancialAccount', 'saveCreditCard'].includes(action.operation) && !input.id);
      if (fields.financialAccountId && input.financialAccountId == null && creating) {
        const account = (await records(context, 'account')).find(item => item.isDefault && !item.archived);
        if (!account) badInput('Informe a conta bancária para este lançamento.');
        input.financialAccountId = account.id;
      }
      if (action.operation === 'saveFinancialAccount' && !input.id) {
        input.initialBalance ??= '0.00'; input.type ??= 'CHECKING'; input.isDefault ??= false;
      }
      if (action.operation === 'saveCreditCard' && !input.id) {
        input.businessDays ??= false;
        const existing = (await records(context, 'card')).some(item => {
          const revision = [...previous].reverse().find(prior => prior.operation === 'saveCreditCard' && object(prior.arguments.input).id === item.id);
          return revision ? object(revision.arguments.input).archived !== true : !item.archived;
        });
        const planned = previous.some(item => item.operation === 'saveCreditCard' && !object(item.arguments.input).id);
        input.isPrimary = Boolean(input.isPrimary) || (!existing && !planned);
      }
      if (action.operation === 'recordCardPurchase') { input.first ??= 1; input.total ??= 1; }
      if (action.operation === 'createAccountPayable' || action.operation === 'createAccountReceivable') input.status ??= 'PENDING';
      args = mapValues(args, (key, value) => normalize(value, key)) as Arguments;
      args = catalog.coerce(action.operation, args);
      const normalized = args.input === undefined ? args : object(args.input);
      const names = new Map<string, string>();
      const snapshots: Snapshot[] = [];
      let target: Arguments | undefined;
      const checkRecord = async (entity: string, value: string) => {
        const found = (await records(context, entity, value))[0];
        if (!found) badInput('Registro não encontrado para este usuário.', 'NOT_FOUND');
        names.set(value, recordName(found));
        if (!snapshots.some(item => item.entity === entity && item.id === value)) snapshots.push({ entity, id: value, hash: fingerprint(found) });
        return found;
      };
      if (action.operation === 'updateMyProfile') {
        target = (await records(context, 'profile'))[0];
        if (!target) badInput('Perfil não encontrado.', 'NOT_FOUND');
        snapshots.push({ entity: 'profile', id: String(target.id), hash: fingerprint(target) });
      }
      const inspect = async (values: Arguments): Promise<void> => {
        for (const [key, value] of Object.entries(values)) {
          if (Array.isArray(value)) { for (const item of value) if (item && typeof item === 'object') await inspect(object(item)); continue; }
          if (value && typeof value === 'object') { await inspect(object(value)); continue; }
          const entity = key === 'id' ? OPERATIONS[action.operation]!.entity : LINKS[key];
          if (!entity || value == null || value === '') continue;
          if (typeof value !== 'string') badInput('Identificador de registro inválido.');
          if (REFERENCE.test(value)) {
            const dependency = previous.find(item => item.key === value.match(REFERENCE)![1]);
            if (!dependency || OPERATIONS[dependency.operation]?.entity !== entity || dependency.operation.startsWith('delete')) badInput('Referência entre ações inválida.');
            continue;
          }
          if (!UUID.test(value)) badInput(`Use o identificador retornado pela consulta para ${LABELS[key] ?? key}.`);
          const found = await checkRecord(entity, value);
          if (key === 'id') target = found;
          if (key !== 'id' && ['account', 'card'].includes(entity) && found.archived) badInput('Conta ou cartão arquivado.');
          if (key === 'categoryId') {
            const income = /Income|Receivable/.test(action.operation) || normalized.type === 'INCOME';
            if (found.type !== 'BOTH' && found.type !== (income ? 'INCOME' : 'EXPENSE')) badInput('Categoria incompatível com o lançamento.');
          }
        }
      };
      await inspect(args);
      if (normalized.sourceId && normalized.sourceId === normalized.destinationId) badInput('Origem e destino devem ser diferentes.');
      const earlierProfile = [...previous].reverse().find(item => item.operation === 'updateMyProfile');
      const currency = String(earlierProfile ? object(earlierProfile.arguments.input).preferredCurrency : (await records(context, 'profile'))[0]?.preferredCurrency ?? 'BRL');
      const details: Detail[] = [];
      const flatten = (values: Arguments, before: Arguments = {}, prefix = '') => {
        for (const [key, value] of Object.entries(values)) {
          if (key === 'operationId') continue;
          if (value && typeof value === 'object' && !Array.isArray(value)) { flatten(object(value), before[key] && typeof before[key] === 'object' ? object(before[key]) : {}, prefix + (key === 'schedule' ? 'Série: ' : '')); continue; }
          details.push({ label: prefix + (LABELS[key] ?? key), before: before[key] === undefined ? null : renderValue(key, before[key], names, currency), after: renderValue(key, value, names, currency) });
        }
      };
      if (target) {
        for (const [field, entity] of Object.entries(LINKS)) {
          if (typeof target[field] !== 'string' || names.has(String(target[field]))) continue;
          const old = (await records(context, entity, String(target[field])))[0];
          if (old) names.set(String(old.id), recordName(old));
        }
      }
      flatten(normalized, target ? object(target.spec ?? target) : {});
      if (JSON.stringify(args).match(/"(amount|initialBalance|targetAmount|creditLimit)"/)) details.push({ label: 'Moeda', after: currency });
      if (normalized.isDefault === true) details.push({ label: 'Efeito', after: 'Esta será a conta padrão para novos lançamentos.' });
      if (normalized.isPrimary === true) details.push({ label: 'Efeito', after: 'Este será o cartão principal.' });
      if (action.operation.startsWith('delete') && target) {
        details.push({ label: 'Registro a excluir', before: recordName(target), after: 'Excluído conforme regras do aplicativo' });
      }
      for (const entity of [...(BULK[action.operation] ?? []), ...(action.operation === 'saveCreditCard' ? ['card'] : []), ...(action.operation === 'saveFinancialAccount' && normalized.isDefault ? ['account'] : [])]) {
        const items = await records(context, entity);
        snapshots.push({ entity: 'collection:' + entity, id: userId, hash: fingerprint(items) });
        details.push({ label: 'Registros considerados (' + entity + ')', after: String(items.length) });
      }
      const title = OPERATIONS[action.operation]!.label + (target ? ': ' + recordName(target) : '');
      return { arguments: args, title: title.slice(0, 300), details, snapshots };
    },
    async verify(context, snapshots) {
      const userId = requireVerifiedUserId(context);
      for (const snapshot of snapshots) {
        if (snapshot.entity.startsWith('collection:')) {
          if (snapshot.id !== userId || fingerprint(await records(context, snapshot.entity.slice(11))) !== snapshot.hash) badInput('Os registros mudaram após a revisão. Prepare um novo resumo.', 'CONFLICT');
          continue;
        }
        const table = TABLES[snapshot.entity];
        if (!table || !UUID.test(snapshot.id)) badInput('Referência de registro inválida.');
        // Table identifiers come only from the fixed registry, never from the model.
        await getPrismaClient().$queryRawUnsafe(`SELECT id FROM "${table}" WHERE id = $1::uuid FOR UPDATE`, snapshot.id);
        const found = (await records(context, snapshot.entity, snapshot.id))[0];
        if (!found || fingerprint(found) !== snapshot.hash) badInput('Registro alterado ou removido após a revisão. Prepare um novo resumo.', 'CONFLICT');
      }
    },
    async refresh(context, snapshots) {
      return Promise.all(snapshots.map(async snapshot => ({ ...snapshot, hash: fingerprint(snapshot.entity.startsWith('collection:')
        ? await records(context, snapshot.entity.slice(11)) : (await records(context, snapshot.entity, snapshot.id))[0] ?? null) })));
    },
    async execute(context, name, args) {
      // Resolve and validate references again, using exactly the reviewed arguments.
      const checked = await this.prepare(context, { key: 'execution', operation: name, arguments: args }, String(object(args.input ?? args).operationId ?? '00000000-0000-4000-8000-000000000000'), []);
      if (fingerprint(checked.arguments) !== fingerprint(args)) badInput('Os padrões da operação mudaram. Prepare um novo resumo.', 'CONFLICT');
      const before = name === 'saveFinancialAccount' && !object(args.input).id ? await records(context, 'account') : [];
      const result = json<unknown>(await catalog.invoke(context, name, checked.arguments));
      if (Array.isArray(result) && name === 'saveFinancialAccount') {
        const saved = result.find(item => object(item).id === object(args.input).id || !before.some(old => old.id === object(item).id));
        if (!saved) badInput('Não foi possível identificar a conta salva.');
        return { id: object(saved).id, data: result };
      }
      if (name === 'payCreditCardStatement') {
        const input = object(checked.arguments.input);
        const payment = await getPrismaClient().creditCardPayment.findUnique({ where: { cardId_operationId: { cardId: String(input.cardId), operationId: String(input.operationId) } } });
        if (!payment) badInput('Pagamento não encontrado após execução.');
        return { id: payment.id, value: result };
      }
      if (typeof result === 'string' && UUID.test(result)) return { id: result };
      if (result && typeof result === 'object' && !Array.isArray(result)) return object(result);
      const id = object(args.input ?? args).id;
      return { ...(typeof id === 'string' ? { id } : {}), value: result };
    }
  };
}
