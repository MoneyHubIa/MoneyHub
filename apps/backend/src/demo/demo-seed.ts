import type { Auth } from 'firebase-admin/auth';
import type { PrismaClient } from '../generated/prisma/client.js';
import { assertDemoEnvironment, demoDates, demoId, DEMO_EMAIL, DEMO_PASSWORD, DEMO_UID } from './demo-data.js';

export async function seedDemo(
  prisma: PrismaClient,
  auth: Pick<Auth, 'getUser' | 'createUser'>,
  environment: NodeJS.ProcessEnv = process.env
): Promise<void> {
  assertDemoEnvironment(environment);
  try {
    await auth.getUser(DEMO_UID);
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
    await auth.createUser({
      uid: DEMO_UID, email: DEMO_EMAIL, password: DEMO_PASSWORD,
      emailVerified: true, displayName: 'Usuário Demonstração'
    });
  }

  // Firebase calls stay outside the transaction. Existing rows are never reset.
  await prisma.$transaction(async (tx) => {
    const userId = demoId('user');
    await tx.user.createMany({ data: [{
      id: userId, firebaseUid: DEMO_UID, email: DEMO_EMAIL, emailVerifiedAt: new Date()
    }], skipDuplicates: true });
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const { day, month } = demoDates(user.createdAt);
    await tx.profile.createMany({ data: [{
      id: demoId('profile'), userId, fullName: 'Usuário Demonstração', preferredCurrency: 'BRL'
    }], skipDuplicates: true });

    const salary = demoId('category-salary');
    const freelance = demoId('category-freelance');
    const housing = demoId('category-housing');
    const food = demoId('category-food');
    const leisure = demoId('category-leisure');
    await tx.financialCategory.createMany({ data: [
      { id: salary, userId, name: 'Salário', type: 'INCOME', color: '#10B981', icon: 'wallet' },
      { id: freelance, userId, name: 'Freelance', type: 'INCOME', color: '#3B82F6', icon: 'briefcase' },
      { id: housing, userId, name: 'Moradia', type: 'EXPENSE', color: '#F59E0B', icon: 'home' },
      { id: food, userId, name: 'Alimentação', type: 'EXPENSE', color: '#EF4444', icon: 'utensils' },
      { id: leisure, userId, name: 'Lazer', type: 'EXPENSE', color: '#8B5CF6', icon: 'tag' }
    ], skipDuplicates: true });
    const personal = demoId('center-personal');
    const work = demoId('center-work');
    await tx.costCenter.createMany({ data: [
      { id: personal, userId, name: 'Pessoal', description: 'Despesas pessoais e da casa' },
      { id: work, userId, name: 'Trabalho', description: 'Projetos e serviços profissionais' }
    ], skipDuplicates: true });

    for (let offset = -3; offset <= 0; offset++) {
      const occurredAt = month(offset);
      await tx.income.createMany({ data: [
        { id: demoId(`salary-${offset}`), userId, categoryId: salary, costCenterId: personal,
          description: 'Salário mensal', amount: '6500.00', occurredAt },
        { id: demoId(`freelance-${offset}`), userId, categoryId: freelance, costCenterId: work,
          description: 'Projeto de consultoria', amount: String(1200 + (offset + 3) * 200), occurredAt }
      ], skipDuplicates: true });
      await tx.expense.createMany({ data: [
        { id: demoId(`rent-${offset}`), userId, categoryId: housing, costCenterId: personal,
          description: 'Aluguel', amount: '1800.00', occurredAt },
        { id: demoId(`market-${offset}`), userId, categoryId: food, costCenterId: personal,
          description: 'Supermercado', amount: String(650 + (offset + 3) * 40), occurredAt },
        { id: demoId(`leisure-${offset}`), userId, categoryId: leisure, costCenterId: personal,
          description: 'Passeios e cinema', amount: '180.00', occurredAt }
      ], skipDuplicates: true });
    }

    await tx.accountPayable.createMany({ data: [
      { id: demoId('payable-pending'), userId, categoryId: housing, costCenterId: personal,
        description: 'Conta de energia', amount: '210.00', dueDate: day(3), reminderOffsetDays: 3 },
      { id: demoId('payable-overdue'), userId, categoryId: housing, costCenterId: personal,
        description: 'Internet em atraso', amount: '120.00', dueDate: day(-3) },
      { id: demoId('payable-paid'), userId, categoryId: leisure, costCenterId: personal,
        description: 'Assinatura de streaming', amount: '39.90', dueDate: day(-2), status: 'PAID', paidAt: day(-2) }
    ], skipDuplicates: true });
    await tx.accountReceivable.createMany({ data: [
      { id: demoId('receivable-pending'), userId, categoryId: freelance, costCenterId: work,
        description: 'Próxima consultoria', amount: '1500.00', dueDate: day(5), reminderOffsetDays: 1 },
      { id: demoId('receivable-received'), userId, categoryId: freelance, costCenterId: work,
        description: 'Serviço concluído', amount: '800.00', dueDate: day(-1), status: 'RECEIVED', receivedAt: day(-1) }
    ], skipDuplicates: true });
    await tx.expense.createMany({ data: [{
      id: demoId('settled-streaming'), userId, categoryId: leisure, costCenterId: personal,
      description: 'Assinatura de streaming', amount: '39.90', occurredAt: day(-2)
    }], skipDuplicates: true });
    await tx.income.createMany({ data: [{
      id: demoId('settled-service'), userId, categoryId: freelance, costCenterId: work,
      description: 'Serviço concluído', amount: '800.00', occurredAt: day(-1)
    }], skipDuplicates: true });
    await tx.recurringTransaction.createMany({ data: [
      { id: demoId('recurring-income'), userId, type: 'INCOME', categoryId: salary, costCenterId: personal,
        description: 'Salário recorrente', amount: '6500.00', recurrenceRule: 'MONTHLY', startDate: month(1) },
      { id: demoId('recurring-expense'), userId, type: 'EXPENSE', categoryId: housing, costCenterId: personal,
        description: 'Aluguel recorrente', amount: '1800.00', recurrenceRule: 'MONTHLY', startDate: month(1) }
    ], skipDuplicates: true });
    await tx.calendarEvent.createMany({ data: [
      { id: demoId('event-review'), userId, title: 'Revisar orçamento', scheduledDate: day(0),
        recurrenceRule: 'MONTHLY', reminderOffsetDays: 0, notes: 'Confira as despesas e acompanhe suas metas.' },
      { id: demoId('event-meeting'), userId, title: 'Reunião com cliente', scheduledDate: day(3),
        reminderOffsetDays: 1, notes: 'Planejar o próximo projeto de consultoria.' }
    ], skipDuplicates: true });
    await tx.notification.createMany({ data: [
      { id: demoId('notification-review'), userId, source: 'EVENT', sourceId: demoId('event-review'),
        title: 'Revisar orçamento', occurrenceDate: day(0), reminderDate: day(0) },
      { id: demoId('notification-payable'), userId, source: 'PAYABLE', sourceId: demoId('payable-pending'),
        title: 'Conta de energia', occurrenceDate: day(3), reminderDate: day(0) }
    ], skipDuplicates: true });
    for (const goal of [
      { key: 'reserve', name: 'Reserva de emergência', targetAmount: '20000.00', accumulatedAmount: '4500.00' },
      { key: 'trip', name: 'Viagem de férias', targetAmount: '6000.00', accumulatedAmount: '1500.00' }
    ]) {
      const id = demoId(`goal-${goal.key}`);
      // Nested creation keeps the opening balance and its movement atomic.
      await tx.financialGoal.upsert({ where: { id }, update: {}, create: {
        id, userId, name: goal.name, targetAmount: goal.targetAmount,
        accumulatedAmount: goal.accumulatedAmount, startDate: month(-1), deadline: month(6),
        movements: { create: {
          id: demoId(`movement-${goal.key}`), type: 'CONTRIBUTION', amount: goal.accumulatedAmount,
          occurredOn: day(0), operationId: demoId(`operation-${goal.key}`), notes: 'Aporte inicial de demonstração'
        } }
      } });
    }
  });
}
