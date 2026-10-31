import type { GraphQLContext } from '../../../core/graphql/graphql.js';
import { getPrismaClient } from '../../../core/database/database.js';
import { requireVerifiedUserId } from '../financial-categories/financial-categories.js';
import { installments, type Schedule } from './rules.js';
import { reverseCardPayment, updateSeries, type UpdateSeriesInput } from './banking.js';
import { accounts, brands, syncSeries, cancelSeries, changeTransfer, createSeries, payCard, purchase, saveAccount, saveCard, statements, transfer, type AccountInput, type CardInput, type PaymentInput, type PurchaseInput, type SeriesInput, type TransferInput } from './banking.js';

export const bankingTypeDefs = `
  type FinancialAccount { id: ID! name: String! type: String! accountNumber: String additionalData: String initialBalance: String! balance: String! isDefault: Boolean! archived: Boolean! }
  input FinancialAccountInput { id: ID name: String! type: String! accountNumber: String additionalData: String initialBalance: String! isDefault: Boolean! archived: Boolean }
  type Transfer { id: ID! sourceId: ID! destinationId: ID! amount: String! dueDate: String! effectiveDate: String status: String! }
  input TransferInput { operationId: ID! sourceId: ID! destinationId: ID! amount: String! dueDate: String! effectiveDate: String }
  type CreditCard { id: ID! financialAccountId: ID! name: String! brand: String! creditLimit: String! dueDay: Int! closingDay: Int! dynamicDays: Int businessDays: Boolean! isPrimary: Boolean! archived: Boolean! statements: [CreditCardStatement!]! payments: [CreditCardPayment!]! }
  type CreditCardPayment { id: ID! amount: String! paidOn: String! reversed: Boolean! }
  type CreditCardStatement { dueDate: String! closingDate: String! total: String! paid: String! outstanding: String! items: [CardPurchase!]! }
  type CardPurchase { id: ID! description: String! amount: String! paidAmount: String! installmentNumber: Int! installmentTotal: Int! }
  input CreditCardInput { id: ID financialAccountId: ID! name: String! brand: String! creditLimit: String! dueDay: Int! closingDay: Int! dynamicDays: Int businessDays: Boolean! isPrimary: Boolean! archived: Boolean }
  input PurchaseInput { operationId: ID! cardId: ID! categoryId: ID! description: String! amount: String! purchasedOn: String! total: Int! first: Int! }
  input CardPaymentInput { operationId: ID! cardId: ID! dueDate: String! paidOn: String! amount: String! }
  enum SeriesMode { ONCE INSTALLMENTS REPEAT FIXED }
  enum SeriesFrequency { DAILY WEEKLY MONTHLY QUARTERLY YEARLY CUSTOM }
  enum IntervalUnit { DAYS WEEKS MONTHS }
  input ScheduleInput { mode: SeriesMode! first: Int! total: Int! frequency: SeriesFrequency! interval: Int unit: IntervalUnit }
  type InstallmentPreview { number: Int! amount: String! dueDate: String! }
  input InstallmentOverrideInput { number: Int! amount: String dueDate: String effectiveDate: String }
  input UpdateCommitmentSeriesInput { id: ID! fromNumber: Int! financialAccountId: ID! categoryId: ID! costCenterId: ID reminderOffsetDays: Int description: String! amount: String! dueDate: String! }
  input CommitmentSeriesInput { operationId: ID! financialAccountId: ID categoryId: ID! costCenterId: ID reminderOffsetDays: Int description: String! amount: String! dueDate: String! type: String! schedule: ScheduleInput! effectiveDate: String overrides: [InstallmentOverrideInput!] }
  extend type Query { myFinancialAccounts: [FinancialAccount!]! myTransfers: [Transfer!]! myCreditCards: [CreditCard!]! creditCardBrands: [String!]! }
  extend type Query { previewCommitmentSeries(amount: String!, dueDate: String!, schedule: ScheduleInput!): [InstallmentPreview!]! }
  extend type Mutation {
    saveFinancialAccount(input: FinancialAccountInput!): [FinancialAccount!]!
    createTransfer(input: TransferInput!): Transfer!
    changeTransfer(id: ID!, cancel: Boolean!, effectiveDate: String!): Transfer!
    saveCreditCard(input: CreditCardInput!): CreditCard!
    recordCardPurchase(input: PurchaseInput!): Boolean!
    payCreditCardStatement(input: CardPaymentInput!): Boolean!
    reverseCreditCardPayment(id: ID!): Boolean!
    syncFinancialSeries: Boolean!
    cancelFinancialSeries(id: ID!, fromNumber: Int!): Boolean!
    updateCommitmentSeries(input: UpdateCommitmentSeriesInput!): Boolean!
    createCommitmentSeries(input: CommitmentSeriesInput!): ID!
  }
`;
const decimal = (p: Record<string, unknown>, _: unknown, _c: unknown, info: { fieldName: string }) => String(p[info.fieldName]);
const date = (p: Record<string, unknown>, _: unknown, _c: unknown, info: { fieldName: string }) => p[info.fieldName] instanceof Date ? (p[info.fieldName] as Date).toISOString().slice(0, 10) : null;
export const bankingResolvers = {
  Query: {
    previewCommitmentSeries: (_: unknown, a: { amount: string; dueDate: string; schedule: Schedule }, c: GraphQLContext) => {
      requireVerifiedUserId(c);
      return installments(a.amount, a.dueDate, a.schedule).map(part => ({ ...part, dueDate: part.dueDate.toISOString().slice(0, 10) }));
    },
    myFinancialAccounts: (_: unknown, _a: unknown, c: GraphQLContext) => accounts(c),
    myTransfers: (_: unknown, _a: unknown, c: GraphQLContext) => getPrismaClient().transfer.findMany({ where: { userId: requireVerifiedUserId(c) }, orderBy: { dueDate: 'desc' } }),
    myCreditCards: (_: unknown, _a: unknown, c: GraphQLContext) => getPrismaClient().creditCard.findMany({ where: { userId: requireVerifiedUserId(c) }, orderBy: { isPrimary: 'desc' } }),
    creditCardBrands: () => brands
  },
  Mutation: {
    saveFinancialAccount: (_: unknown, a: { input: AccountInput }, c: GraphQLContext) => saveAccount(c, a.input),
    createTransfer: (_: unknown, a: { input: TransferInput }, c: GraphQLContext) => transfer(c, a.input),
    changeTransfer: (_: unknown, a: { id: string; cancel: boolean; effectiveDate: string }, c: GraphQLContext) => changeTransfer(c, a.id, a.cancel, a.effectiveDate),
    saveCreditCard: (_: unknown, a: { input: CardInput }, c: GraphQLContext) => saveCard(c, a.input),
    recordCardPurchase: (_: unknown, a: { input: PurchaseInput }, c: GraphQLContext) => purchase(c, a.input),
    payCreditCardStatement: (_: unknown, a: { input: PaymentInput }, c: GraphQLContext) => payCard(c, a.input),
    reverseCreditCardPayment: (_: unknown, a: { id: string }, c: GraphQLContext) => reverseCardPayment(c, a.id),
    syncFinancialSeries: (_: unknown, _a: unknown, c: GraphQLContext) => syncSeries(c),
    cancelFinancialSeries: (_: unknown, a: { id: string; fromNumber: number }, c: GraphQLContext) => cancelSeries(c, a.id, a.fromNumber),
    updateCommitmentSeries: (_: unknown, a: { input: UpdateSeriesInput }, c: GraphQLContext) => updateSeries(c, a.input),
    createCommitmentSeries: (_: unknown, a: { input: SeriesInput }, c: GraphQLContext) => createSeries(c, a.input)
  },
  CreditCard: { creditLimit: decimal, statements: (p: { id: string }, _a: unknown, c: GraphQLContext) => statements(c, p.id), payments: (p: { id: string }, _a: unknown, c: GraphQLContext) => getPrismaClient().creditCardPayment.findMany({ where: { cardId: p.id, card: { userId: requireVerifiedUserId(c) } }, orderBy: { paidOn: 'desc' } }) },
  CreditCardPayment: { amount: decimal, paidOn: date },
  CardPurchase: { amount: decimal, paidAmount: decimal },
  Transfer: { amount: decimal, dueDate: date, effectiveDate: date }
};
