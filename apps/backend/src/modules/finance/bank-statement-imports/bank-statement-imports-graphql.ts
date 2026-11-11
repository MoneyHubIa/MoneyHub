import type { GraphQLContext } from '../../../core/graphql/graphql.js';
import { confirmBankStatementImport, getBankStatementImport, previewBankStatementImport, type ImportDecision, type PreviewInput } from './bank-statement-imports.js';

export const bankStatementImportsTypeDefs = `#graphql
  enum BankStatementAction { CREATE LINK_ACCOUNT TRANSFER CARD_PAYMENT IGNORE }
  enum BankStatementDateFormat { DMY MDY ISO }
  input BankStatementCsvMapping {
    delimiter: String!
    dateColumn: Int!
    descriptionColumn: Int!
    amountColumn: Int
    debitColumn: Int
    creditColumn: Int
    dateFormat: BankStatementDateFormat!
    decimalSeparator: String!
  }
  input PreviewBankStatementImportInput {
    financialAccountId: ID!
    fileName: String!
    base64: String!
    csvMapping: BankStatementCsvMapping
    csvDelimiter: String
  }
  input BankStatementDecision {
    rowNumber: Int!
    action: BankStatementAction!
    description: String
    categoryId: ID
    targetId: ID
    otherAccountId: ID
    cardId: ID
    statementDueDate: String
    acknowledgeDuplicate: Boolean
  }
  input ConfirmBankStatementImportInput { id: ID! decisions: [BankStatementDecision!]! }
  type BankStatementCandidate {
    id: ID!
    kind: String!
    label: String!
    amount: String!
    date: String!
    status: String!
    otherAccountId: ID
    cardId: ID
    statementDueDate: String
  }
  type BankStatementRow {
    rowNumber: Int!
    date: String
    description: String!
    amount: String
    direction: String
    error: String
    warning: String
    duplicate: Boolean!
    possibleDuplicate: Boolean!
    candidates: [BankStatementCandidate!]!
  }
  type BankStatementImportedEntry { rowNumber: Int! entityKind: String! entityId: ID! amount: String! }
  type BankStatementImportResult {
    created: Int! linked: Int! ignored: Int! transfers: Int! cardPayments: Int!
    incomeTotal: String! expenseTotal: String!
    entries: [BankStatementImportedEntry!]!
  }
  type BankStatementImport {
    id: ID! status: String! fileName: String! financialAccountId: ID! currency: String! expiresAt: String!
    rows: [BankStatementRow!]!
    result: BankStatementImportResult
  }
  type BankStatementImportPreview {
    mappingRequired: Boolean!
    headers: [String!]!
    samples: [[String!]!]!
    delimiter: String!
    sourceAccount: String
    batch: BankStatementImport
  }
  extend type Query { bankStatementImport(id: ID!): BankStatementImport! }
  extend type Mutation {
    previewBankStatementImport(input: PreviewBankStatementImportInput!): BankStatementImportPreview!
    confirmBankStatementImport(input: ConfirmBankStatementImportInput!): BankStatementImportResult!
  }
`;

export const bankStatementImportsResolvers = {
  Query: {
    bankStatementImport: (_: unknown, args: { id: string }, context: GraphQLContext) => getBankStatementImport(context, args.id)
  },
  Mutation: {
    previewBankStatementImport: (_: unknown, args: { input: PreviewInput }, context: GraphQLContext) => previewBankStatementImport(context, args.input),
    confirmBankStatementImport: (_: unknown, args: { input: { id: string; decisions: ImportDecision[] } }, context: GraphQLContext) => confirmBankStatementImport(context, args.input)
  }
};
