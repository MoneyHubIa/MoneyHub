import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTestDatabase } from '../../../helpers/pglite-prisma.js';
import { ApolloServer } from '@apollo/server';
import { typeDefs, resolvers } from '../../../../src/core/graphql/graphql.js';
import { MANUAL_ONLY_OPERATIONS, OPERATIONS } from '../../../../src/modules/ai/operations/catalog.js';
import { askAiAssistant } from '../../../../src/modules/ai/service/ai-service.js';
import { MockLlmAdapter } from '../../../../src/modules/ai/llm-adapter/ai-llm-adapter.js';
import { operationStore } from '../../../../src/modules/ai/operations/store.js';
import { withDatabaseClient } from '../../../../src/core/database/database.js';
import { aiOperationRuntime, aiOperationCatalog, type GraphQLContext } from '../../../../src/core/graphql/graphql.js';
import { prepareAiOperations, confirmAiOperationPlan, cancelAiOperationPlan, getAiOperationPlan } from '../../../../src/modules/ai/operations/operations.js';

const userId = '11111111-1111-4111-8111-111111111111';
const profileId = '22222222-2222-4222-8222-222222222222';
const categoryId = '33333333-3333-4333-8333-333333333333';
const context: GraphQLContext = { requestId: 'test-ai', auth: { uid: 'ai', email: 'ai@example.test', emailVerified: true, userId, profileId } };

test('prepares two payables, requires confirmation, and replays without duplicates in PostgreSQL', async () => {
  const database = await createTestDatabase();
  try {
    await database.db.query("INSERT INTO users(id,firebase_uid,email,updated_at) VALUES($1,'ai','ai@example.test',now())", [userId]);
    await database.db.query("INSERT INTO profiles(id,user_id,full_name,updated_at) VALUES($1,$2,'AI User',now())", [profileId,userId]);
    await database.db.query("INSERT INTO financial_categories(id,user_id,name,type,updated_at) VALUES($1,$2,'Moradia','EXPENSE',now())", [categoryId,userId]);
    await withDatabaseClient(database.prisma, async () => {
      assert.ok(aiOperationCatalog.list().length > 40);
      const plan = await prepareAiOperations(context, [1,2].map(number => ({ key: 'bill' + number, operation: 'createAccountPayable', arguments: { input: { categoryId, description: 'Conta ' + number, amount: '2.000,00', dueDate: '2026-12-10' } } })), aiOperationRuntime);
      assert.equal(await database.prisma.accountPayable.count(), 0);
      assert.equal(plan.actions.length, 2);
      assert.ok(plan.actions[0]!.details.some(detail => detail.after === 'R$ 2.000,00'));
      assert.ok(plan.totals.some(total => total.includes('4.000,00')));
      const result = await confirmAiOperationPlan(context, plan.id, aiOperationRuntime);
      assert.equal(result.status, 'COMPLETED');
      assert.equal(await database.prisma.accountPayable.count(), 2);
      await confirmAiOperationPlan(context, plan.id, aiOperationRuntime);
      assert.equal(await database.prisma.accountPayable.count(), 2);
    });
  } finally { await database.close(); }
});


test('business catalog accounts for every user mutation and excludes manual file imports and orchestration', () => {
  const actual = Object.keys(aiOperationCatalog.graph.getMutationType()!.getFields()).filter(name => !['bootstrapProfile', 'askAiAssistant', 'confirmAiOperationPlan', 'cancelAiOperationPlan'].includes(name)).sort();
  assert.deepEqual([...Object.keys(OPERATIONS), ...Object.keys(MANUAL_ONLY_OPERATIONS)].sort(), actual);
  for (const operation of Object.keys(MANUAL_ONLY_OPERATIONS)) {
    assert.ok(!Object.hasOwn(OPERATIONS, operation));
    assert.throws(() => aiOperationCatalog.schema(operation));
  }
  assert.throws(() => aiOperationCatalog.schema('bootstrapProfile'));
  assert.throws(() => aiOperationCatalog.schema('dropTable'));
});

test('operational flows use the real domain services, transactions and PostgreSQL receipts', async t => {
  const database = await createTestDatabase();
  try {
    await database.db.query("INSERT INTO users(id,firebase_uid,email,updated_at) VALUES($1,'ai','ai@example.test',now())", [userId]);
    await database.db.query("INSERT INTO profiles(id,user_id,full_name,updated_at) VALUES($1,$2,'AI User',now())", [profileId,userId]);
    await database.db.query("INSERT INTO financial_categories(id,user_id,name,type,updated_at) VALUES($1,$2,'Geral','BOTH',now())", [categoryId,userId]);
    await withDatabaseClient(database.prisma, async () => {
      const prepare = (actions: unknown[], prior?: string) => prepareAiOperations(context, actions, aiOperationRuntime, prior);
      const confirm = (id: string) => confirmAiOperationPlan(context, id, aiOperationRuntime);
      const action = (key: string, operation: string, input: Record<string, unknown>) => ({ key, operation, arguments: { input } });
      await t.test('bank, card, purchase and statement payment resolve dependencies and nested transactions', async () => {
        const plan = await prepare([
          action('bank','saveFinancialAccount',{ name:'Banco IA', initialBalance:'500.00' }),
          action('card','saveCreditCard',{ financialAccountId:'$ref:bank.id', name:'Cartão IA', brand:'Visa', creditLimit:'3000', dueDay:10, closingDay:25 }),
          action('purchase','recordCardPurchase',{ cardId:'$ref:card.id', categoryId, description:'Compra IA', amount:'100', purchasedOn:'2026-11-01', total:2 }),
          action('payment','payCreditCardStatement',{ cardId:'$ref:card.id', dueDate:'2026-12-10', paidOn:'2026-12-10', amount:'50' })
        ]);
        const result = await confirm(plan.id);
        assert.deepEqual(result.actions.map(item=>item.error), [null,null,null,null]);
        assert.equal(result.status,'COMPLETED');
        assert.equal(await database.prisma.creditCardPurchase.count(),2);
        assert.equal(await database.prisma.creditCardPayment.count(),1);
        const accounts = await aiOperationRuntime.read(context,'myFinancialAccounts',{},'Banco IA') as { items: { balance:string }[] };
        assert.equal(accounts.items[0]?.balance,'450.00');
      });
      await t.test('account receipts identify both new accounts and edits outside the first result', async () => {
        const created = await prepare([
          action('bank', 'saveFinancialAccount', { name: 'ZZ Conta para editar', initialBalance: '25' }),
          action('bill', 'createAccountPayable', { categoryId, financialAccountId: '$ref:bank.id', description: 'Conta nova referenciada', amount: '2', dueDate: '2026-12-15' })
        ]);
        const creation = await confirm(created.id);
        assert.equal(creation.status, 'COMPLETED');
        const account = await database.prisma.financialAccount.findFirstOrThrow({ where: { userId, name: 'ZZ Conta para editar' } });
        assert.equal(JSON.parse(creation.actions[0]!.resultJson!).id, account.id);
        assert.equal((await database.prisma.accountPayable.findFirstOrThrow({ where: { description: 'Conta nova referenciada' } })).financialAccountId, account.id);
        const listed = await aiOperationRuntime.read(context, 'myFinancialAccounts', {}) as { items: { id: string }[] };
        assert.notEqual(listed.items[0]!.id, account.id);

        const edited = await prepare([
          action('edit', 'saveFinancialAccount', { id: account.id, name: 'ZZ Conta editada', type: account.type, initialBalance: String(account.initialBalance), isDefault: false }),
          action('bill', 'createAccountPayable', { categoryId, financialAccountId: '$ref:edit.id', description: 'Conta editada referenciada', amount: '3', dueDate: '2026-12-15' })
        ]);
        const result = await confirm(edited.id);
        assert.equal(result.status, 'COMPLETED');
        assert.equal(JSON.parse(result.actions[0]!.resultJson!).id, account.id);
        assert.equal((await database.prisma.accountPayable.findFirstOrThrow({ where: { description: 'Conta editada referenciada' } })).financialAccountId, account.id);
      });
      await t.test('retry signatures resolve successful references before rejecting duplicate payables', async () => {
        const bill = { categoryId: '$ref:cat.id', description: 'Nao duplicar na retomada', amount: '10', dueDate: '2026-12-15' };
        const original = await prepare([
          action('cat', 'createCategory', { name: 'Categoria da retomada', type: 'BOTH' }),
          action('bill', 'createAccountPayable', bill),
          action('invalidGoal', 'createFinancialGoal', { name: 'Meta falha para retomada', targetAmount: '100', startDate: '2026-12-10', deadline: '2026-12-01' })
        ]);
        const result = await confirm(original.id);
        assert.equal(result.status, 'PARTIAL');
        assert.deepEqual(result.actions.map(item => item.status), ['SUCCEEDED', 'SUCCEEDED', 'FAILED']);
        const resolvedCategory = JSON.parse(result.actions[0]!.resultJson!).id as string;
        const planCount = await database.prisma.aiOperationPlan.count();
        for (const category of ['$ref:cat.id', resolvedCategory]) {
          await assert.rejects(prepare([action('retryBill', 'createAccountPayable', { ...bill, categoryId: category, amount: '10.00' })], original.id), /Esta operação já foi concluída/);
        }
        assert.equal(await database.prisma.aiOperationPlan.count(), planCount);
        assert.equal(await database.prisma.accountPayable.count({ where: { description: bill.description } }), 1);
      });
      await t.test('retry references preserve new local actions while resolving previous successes', async () => {
        const original = await prepare([
          action('cat', 'createCategory', { name: 'Categoria reutilizada', type: 'BOTH' }),
          action('center', 'createCostCenter', { name: 'Centro anterior' }),
          action('invalidGoal', 'createFinancialGoal', { name: 'Meta falha para referencias', targetAmount: '100', startDate: '2026-12-10', deadline: '2026-12-01' })
        ]);
        const result = await confirm(original.id);
        assert.equal(result.status, 'PARTIAL');
        const resolvedCategory = JSON.parse(result.actions[0]!.resultJson!).id as string;
        const previousCenter = JSON.parse(result.actions[1]!.resultJson!).id as string;
        const bill = { categoryId: '$ref:cat.id', costCenterId: '$ref:center.id', description: 'Referencias mistas', amount: '12', dueDate: '2026-12-15' };
        for (const reference of ['$ref:missing.id', '$ref:invalidGoal.id']) {
          await assert.rejects(prepare([action('bill', 'createAccountPayable', { ...bill, categoryId: reference })], original.id), /Inclua primeiro a ação pendente/);
        }
        await assert.rejects(prepare([
          action('bill', 'createAccountPayable', { ...bill, costCenterId: '$ref:future.id' }),
          action('future', 'createCostCenter', { name: 'Centro futuro' })
        ], original.id), /Inclua primeiro a ação pendente/);
        const retry = await prepare([
          action('center', 'createCostCenter', { name: 'Novo centro local' }),
          action('bill', 'createAccountPayable', bill)
        ], original.id);
        const stored = await getAiOperationPlan(context, retry.id);
        assert.equal((stored.actions[1]!.arguments.input as Record<string, unknown>).categoryId, resolvedCategory);
        assert.equal((stored.actions[1]!.arguments.input as Record<string, unknown>).costCenterId, '$ref:center.id');
        const confirmed = await confirm(retry.id);
        assert.equal(confirmed.status, 'COMPLETED');
        const newCenter = JSON.parse(confirmed.actions[0]!.resultJson!).id as string;
        assert.notEqual(newCenter, previousCenter);
        const payable = await database.prisma.accountPayable.findFirstOrThrow({ where: { description: bill.description } });
        assert.equal(payable.categoryId, resolvedCategory);
        assert.equal(payable.costCenterId, newCenter);
      });
      await t.test('income series and recurring edits validate the effective type regardless of input order', async () => {
        const account = await database.prisma.financialAccount.findFirstOrThrow({ where: { userId, isDefault: true } });
        const created = await prepare([
          action('incomeCategory', 'createCategory', { name: 'Somente receitas', type: 'INCOME' }),
          action('expenseCategory', 'createCategory', { name: 'Somente despesas', type: 'EXPENSE' }),
          action('series', 'createCommitmentSeries', { financialAccountId: account.id, categoryId: '$ref:incomeCategory.id', description: 'Serie de receitas', amount: '40', dueDate: '2026-12-15', type: 'INCOME', schedule: { mode: 'INSTALLMENTS', first: 1, total: 2, frequency: 'MONTHLY' } }),
          action('recurring', 'createRecurringTransaction', { categoryId: '$ref:incomeCategory.id', description: 'Recorrencia de receitas', amount: '10', type: 'INCOME', recurrenceRule: 'MONTHLY', startDate: '2026-12-01' })
        ]);
        const creation = await confirm(created.id);
        assert.equal(creation.status, 'COMPLETED');
        const [incomeCategory, expenseCategory, seriesId, recurringId] = creation.actions.map(item => JSON.parse(item.resultJson!).id as string);
        const seriesFields = { categoryId: incomeCategory!, fromNumber: 2, financialAccountId: account.id, description: 'Serie de receitas revisada', amount: '22', dueDate: '2027-01-15' };
        const seriesInput = { ...seriesFields, id: seriesId! };
        for (const idFirst of [false, true]) {
          const revised = await prepare([
            action('series', 'updateCommitmentSeries', idFirst ? { id: seriesId!, ...seriesFields } : seriesInput),
            action('recurring', 'updateRecurringTransaction', idFirst ? { id: recurringId!, categoryId: incomeCategory! } : { categoryId: incomeCategory!, id: recurringId! })
          ]);
          assert.equal((await confirm(revised.id)).status, 'COMPLETED');
        }
        const receivable = await database.prisma.accountReceivable.findFirstOrThrow({ where: { seriesId: seriesId!, installmentNumber: 2 } });
        assert.equal(receivable.description, seriesInput.description);
        assert.equal(receivable.amount.toString(), '22');
        assert.equal(receivable.categoryId, incomeCategory);
        assert.equal((await database.prisma.recurringTransaction.findUniqueOrThrow({ where: { id: recurringId! } })).type, 'INCOME');
        await assert.rejects(prepare([action('series', 'updateCommitmentSeries', { ...seriesInput, categoryId: expenseCategory! })]), /Categoria incompatível com o lançamento/);
        await assert.rejects(prepare([action('recurring', 'updateRecurringTransaction', { categoryId: expenseCategory!, id: recurringId! })]), /Categoria incompatível com o lançamento/);
        await assert.rejects(prepare([action('recurring', 'updateRecurringTransaction', { id: recurringId!, categoryId: incomeCategory!, type: 'EXPENSE' })]), /Categoria incompatível com o lançamento/);
        const changed = await prepare([action('recurring', 'updateRecurringTransaction', { categoryId: expenseCategory!, id: recurringId!, type: 'EXPENSE' })]);
        assert.equal((await confirm(changed.id)).status, 'COMPLETED');
        const recurring = await database.prisma.recurringTransaction.findUniqueOrThrow({ where: { id: recurringId! } });
        assert.equal(recurring.type, 'EXPENSE');
        assert.equal(recurring.categoryId, expenseCategory);
      });
      await t.test('partial failure rolls back its effects, blocks dependents and preserves independent successes', async () => {
        const plan = await prepare([
          action('bill','createAccountPayable',{categoryId,description:'Preservada',amount:'10',dueDate:'2026-12-15'}),
          action('invalidGoal','createFinancialGoal',{name:'Meta inválida',targetAmount:'100',startDate:'2026-12-10',deadline:'2026-12-01'}),
          action('dependent','recordFinancialGoalMovement',{goalId:'$ref:invalidGoal.id',type:'CONTRIBUTION',amount:'10',occurredOn:'2026-12-10'}),
          action('event','createCalendarEvent',{title:'Independente',scheduledDate:'2026-12-11'})
        ]);
        const result = await confirm(plan.id);
        assert.equal(result.status,'PARTIAL');
        assert.deepEqual(result.actions.map(item=>item.status),['SUCCEEDED','FAILED','BLOCKED','SUCCEEDED']);
        assert.equal(await database.prisma.financialGoal.count({where:{name:'Meta inválida'}}),0);
        assert.equal(await database.prisma.calendarEvent.count({where:{title:'Independente'}}),1);
        await confirm(plan.id);
        assert.equal(await database.prisma.accountPayable.count({where:{description:'Preservada'}}),1);
        const retry = await prepare([action('goal','createFinancialGoal',{name:'Meta corrigida',targetAmount:'100',startDate:'2026-12-01',deadline:'2026-12-10'})],plan.id);
        assert.equal((await confirm(retry.id)).status,'COMPLETED');
      });
      await t.test('confirmation concurrency cannot create duplicates', async () => {
        const plan = await prepare([action('bill','createAccountPayable',{categoryId,description:'Concorrente',amount:'15',dueDate:'2026-12-15'})]);
        await Promise.all([confirm(plan.id),confirm(plan.id)]);
        assert.equal(await database.prisma.accountPayable.count({where:{description:'Concorrente'}}),1);
      });
      await t.test('cancellation, expiration, corrections and missing fields never write business records', async () => {
        await assert.rejects(prepare([action('bill','createAccountPayable',{categoryId,amount:'15'})]));
        await assert.rejects(prepare([action('bill','createAccountPayable',{categoryId,description:'Data inválida',amount:'15',dueDate:'2026-02-30'})]));
        const cancelled = await prepare([action('bill','createAccountPayable',{categoryId,description:'Cancelada',amount:'15',dueDate:'2026-12-15'})]);
        await cancelAiOperationPlan(context,cancelled.id);
        await assert.rejects(confirm(cancelled.id));
        const expired = await prepare([action('bill','createAccountPayable',{categoryId,description:'Expirada',amount:'15',dueDate:'2026-12-15'})]);
        await database.prisma.aiOperationPlan.update({where:{id:expired.id},data:{expiresAt:new Date(0)}});
        await assert.rejects(confirm(expired.id));
        const original = await prepare([action('bill','createAccountPayable',{categoryId,description:'Original',amount:'15',dueDate:'2026-12-15'})]);
        const correction = await prepare([action('bill','createAccountPayable',{categoryId,description:'Corrigida',amount:'16',dueDate:'2026-12-15'})],original.id);
        await assert.rejects(confirm(original.id));
        assert.equal((await confirm(correction.id)).status,'COMPLETED');
        assert.equal(await database.prisma.accountPayable.count({where:{description:{in:['Cancelada','Expirada','Original']}}}),0);
      });
      await t.test('changed records require a new review and foreign users cannot inspect or execute a plan', async () => {
        const account = await database.prisma.financialAccount.findFirstOrThrow({where:{userId,isDefault:true}});
        const plan = await prepare([action('change','saveFinancialAccount',{id:account.id,name:'Novo nome',type:account.type,initialBalance:String(account.initialBalance),isDefault:true})]);
        await database.prisma.financialAccount.update({where:{id:account.id},data:{name:'Mudou fora do chat'}});
        assert.equal((await confirm(plan.id)).actions[0]?.status,'FAILED');
        const other = {...context,auth:{...context.auth!,userId:'99999999-9999-4999-8999-999999999999'}};
        await assert.rejects(getAiOperationPlan(other,plan.id));
        await assert.rejects(confirmAiOperationPlan(other,plan.id,aiOperationRuntime));
        await assert.rejects(prepareAiOperations(other,[action('x','deleteCategory',{id:categoryId})],aiOperationRuntime));
      });
      await t.test('goals, categories, cost centers, income, expenses, receivables and profile are operational', async () => {
        const plan = await prepare([
          action('category','createCategory',{name:'Categoria IA',type:'BOTH'}),
          action('center','createCostCenter',{name:'Centro IA'}),
          action('income','createIncome',{categoryId:'$ref:category.id',costCenterId:'$ref:center.id',description:'Receita IA',amount:'20',occurredAt:'2026-12-10'}),
          action('expense','createExpense',{categoryId:'$ref:category.id',description:'Despesa IA',amount:'5',occurredAt:'2026-12-10'}),
          action('receivable','createAccountReceivable',{categoryId,description:'Recebível IA',amount:'30',dueDate:'2026-12-10'}),
          {key:'receive',operation:'markAccountReceivableReceived',arguments:{id:'$ref:receivable.id',receivedAt:'2026-12-10'}},
          action('goal','createFinancialGoal',{name:'Meta IA',targetAmount:'100',startDate:'2026-12-01',deadline:'2026-12-31'}),
          action('contribution','recordFinancialGoalMovement',{goalId:'$ref:goal.id',type:'CONTRIBUTION',amount:'25',occurredOn:'2026-12-10'}),
          action('profile','updateMyProfile',{fullName:'Nome atualizado',preferredCurrency:'BRL',theme:'LIGHT'})
        ]);
        const result=await confirm(plan.id);
        assert.deepEqual(result.actions.map(item=>item.error),Array(9).fill(null));
        assert.equal(result.status,'COMPLETED');
        assert.equal((await database.prisma.financialGoal.findFirst({where:{name:'Meta IA'}}))?.accumulatedAmount.toString(),'25');
        assert.equal((await database.prisma.profile.findFirst({where:{userId}}))?.fullName,'Nome atualizado');
      });
      await t.test('edits, deletions, transfers, recurring series and notifications use the business catalog', async () => {
        const account = await database.prisma.financialAccount.findFirstOrThrow({where:{userId,isDefault:true}});
        const another = await database.prisma.financialAccount.findFirstOrThrow({where:{userId,name:'Banco IA'}});
        const plan = await prepare([
          action('category','createCategory',{name:'Temporária IA'}),
          action('categoryUpdate','updateCategory',{id:'$ref:category.id',name:'Temporária alterada'}),
          {key:'categoryDelete',operation:'deleteCategory',arguments:{id:'$ref:categoryUpdate.id'}},
          action('income','createIncome',{categoryId,description:'Editar e remover',amount:'10',occurredAt:'2026-12-10'}),
          action('incomeUpdate','updateIncome',{id:'$ref:income.id',description:'Alterada'}),
          {key:'incomeDelete',operation:'deleteIncome',arguments:{id:'$ref:incomeUpdate.id'}},
          action('transfer','createTransfer',{sourceId:another.id,destinationId:account.id,amount:'10',dueDate:'2026-12-10'}),
          {key:'completeTransfer',operation:'changeTransfer',arguments:{id:'$ref:transfer.id',cancel:false,effectiveDate:'2026-12-10'}},
          action('series','createCommitmentSeries',{financialAccountId:account.id,categoryId,description:'Série IA',amount:'40',dueDate:'2026-12-15',type:'EXPENSE',schedule:{mode:'INSTALLMENTS',first:1,total:2,frequency:'MONTHLY'}}),
          action('seriesUpdate','updateCommitmentSeries',{id:'$ref:series.id',fromNumber:2,financialAccountId:account.id,categoryId,description:'Série revisada',amount:'20',dueDate:'2027-01-15'}),
          {key:'seriesCancel',operation:'cancelFinancialSeries',arguments:{id:'$ref:seriesUpdate.id',fromNumber:2}},
          action('recurring','createRecurringTransaction',{categoryId,description:'Recorrência IA',amount:'10',type:'EXPENSE',recurrenceRule:'MONTHLY',startDate:'2026-12-01'}),
          action('recurringUpdate','updateRecurringTransaction',{id:'$ref:recurring.id',description:'Recorrência revisada'}),
          {key:'recurringDelete',operation:'deleteRecurringTransaction',arguments:{id:'$ref:recurringUpdate.id'}},
          action('reminder','createCalendarEvent',{title:'Lembrete IA',scheduledDate:'2026-12-11',reminderOffsetDays:1}),
          {key:'notifications',operation:'syncAgendaNotifications',arguments:{today:'2026-12-10'}},
          {key:'readAll',operation:'markAllNotificationsRead',arguments:{}}
        ]);
        const result = await confirm(plan.id);
        assert.deepEqual(result.actions.map(item=>item.error),Array(17).fill(null));
        assert.equal(result.status,'COMPLETED');
        assert.equal(await database.prisma.notification.count({where:{userId,readAt:null}}),0);
        assert.equal((await database.prisma.financialCategory.findFirst({where:{name:'Temporária alterada'}}))?.deletedAt instanceof Date,true);
        const payment = await database.prisma.creditCardPayment.findFirstOrThrow({where:{card:{userId}}});
        const reversal = await prepare([{key:'reverse',operation:'reverseCreditCardPayment',arguments:{id:payment.id}}]);
        assert.equal((await confirm(reversal.id)).status,'COMPLETED');
        assert.equal((await database.prisma.creditCardPayment.findUniqueOrThrow({where:{id:payment.id}})).reversed,true);
      });
      await t.test('same-record actions and bulk operations rebase only approved changes', async () => {
        const goal = await database.prisma.financialGoal.findFirstOrThrow({where:{name:'Meta IA'}});
        const plan = await prepare([
          action('rename','updateFinancialGoal',{id:goal.id,name:'Meta renomeada'}),
          action('fund','recordFinancialGoalMovement',{goalId:goal.id,type:'CONTRIBUTION',amount:'10',occurredOn:'2026-12-11'})
        ]);
        const result=await confirm(plan.id);
        assert.equal(result.status,'COMPLETED');
        assert.equal((await database.prisma.financialGoal.findUniqueOrThrow({where:{id:goal.id}})).accumulatedAmount.toString(),'35');
      });
      await t.test('GraphQL end-to-end: simulated model, review, confirmation and persisted business query', async () => {
        const model = new MockLlmAdapter({customResponder:()=>({content:'',toolCalls:[{id:'call-e2e',type:'function',function:{name:'prepare_operations',arguments:JSON.stringify({actions:[action('e2e','createAccountPayable',{categoryId,description:'GraphQL E2E',amount:'2000',dueDate:'2026-12-20'})]})}}]})});
        const server = new ApolloServer<GraphQLContext>({typeDefs,resolvers:{...resolvers,Mutation:{...resolvers.Mutation,
          askAiAssistant:(_:unknown,args:{input:Parameters<typeof askAiAssistant>[1]},ctx:GraphQLContext)=>askAiAssistant(ctx,args.input,{llmAdapter:model,operationRuntime:aiOperationRuntime,logger:{log:()=>{}}})
        }}});
        try {
          const response=await server.executeOperation({query:'mutation { askAiAssistant(input:{message:"Crie uma conta",timeZone:"America/Sao_Paulo"}) { answer pendingPlan { id status totals actions { title } } } }'},{contextValue:context});
          assert.equal(response.body.kind,'single');
          if(response.body.kind!=='single') return;
          assert.equal(response.body.singleResult.errors,undefined);
          const data=response.body.singleResult.data as {askAiAssistant:{pendingPlan:{id:string}}};
          assert.equal(await database.prisma.accountPayable.count({where:{description:'GraphQL E2E'}}),0);
          const confirmed=await server.executeOperation({query:'mutation Confirm($id:ID!){ confirmAiOperationPlan(id:$id){status actions{status error}} }',variables:{id:data.askAiAssistant.pendingPlan.id}},{contextValue:context});
          assert.equal(confirmed.body.kind,'single');
          if(confirmed.body.kind!=='single') return;
          assert.equal(confirmed.body.singleResult.errors,undefined);
          assert.equal((confirmed.body.singleResult.data as {confirmAiOperationPlan:{status:string}}).confirmAiOperationPlan.status,'COMPLETED');
          assert.equal(await database.prisma.accountPayable.count({where:{description:'GraphQL E2E'}}),1);
        } finally {await server.stop();}
      });
      await t.test('conversation tools prepare a plan without executing it and preserve user history', async () => {
        let called=false;
        const response=await askAiAssistant(context,{message:'Crie uma conta de 20 reais',history:[{role:'user',content:'Categoria Geral, vencimento 10/12/2026.'}],timeZone:'America/Sao_Paulo'},{
          operationRuntime:aiOperationRuntime,operationStore:operationStore(),logger:{log:()=>{}},
          llmAdapter:new MockLlmAdapter({customResponder:(_prompt,options)=>{
            called=true;
            assert.ok(options?.messages?.some(message=>message.content?.includes('Categoria Geral')));
            return {content:'',toolCalls:[{id:'call-1',type:'function',function:{name:'prepare_operations',arguments:JSON.stringify({actions:[action('bill','createAccountPayable',{categoryId,description:'Proposta via modelo',amount:'20',dueDate:'2026-12-10'})]})}}]};
          }})
        });
        assert.ok(called); assert.ok(response.pendingPlan);
        assert.equal(await database.prisma.accountPayable.count({where:{description:'Proposta via modelo'}}),0);
      });
    });
  } finally {await database.close();}
});
