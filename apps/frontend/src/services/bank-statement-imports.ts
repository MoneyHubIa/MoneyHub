import { gql } from '@apollo/client';

export type StatementCandidate = { id: string; kind: string; label: string; amount: string; date: string; status: string; otherAccountId: string | null; cardId: string | null; statementDueDate: string | null };
export type StatementRow = {
  rowNumber: number; date: string | null; description: string; amount: string | null;
  direction: 'INCOME' | 'EXPENSE' | null; error: string | null; warning: string | null;
  duplicate: boolean; possibleDuplicate: boolean; candidates: StatementCandidate[];
};
export type StatementDecision = {
  rowNumber: number; action: 'CREATE' | 'LINK_ACCOUNT' | 'TRANSFER' | 'CARD_PAYMENT' | 'IGNORE';
  description: string; categoryId: string | null; targetId: string | null;
  otherAccountId: string | null; cardId: string | null; statementDueDate: string | null; acknowledgeDuplicate: boolean;
};
export type StatementResult = {
  created: number; linked: number; ignored: number; transfers: number; cardPayments: number;
  incomeTotal: string; expenseTotal: string;
  entries: { rowNumber: number; entityKind: string; entityId: string; amount: string }[];
};
export type StatementBatch = { id: string; status: string; fileName: string; financialAccountId: string; currency: string; expiresAt: string; rows: StatementRow[]; result: StatementResult | null };
export type StatementPreview = { mappingRequired: boolean; headers: string[]; samples: string[][]; delimiter: string; sourceAccount: string | null; batch: StatementBatch | null };
export type CsvMapping = { delimiter: string; dateColumn: number; descriptionColumn: number; amountColumn: number | null; debitColumn: number | null; creditColumn: number | null; dateFormat: 'DMY' | 'MDY' | 'ISO'; decimalSeparator: string };

const RESULT = gql`fragment StatementImportResult on BankStatementImportResult {
  created linked ignored transfers cardPayments incomeTotal expenseTotal entries { rowNumber entityKind entityId amount }
}`;
const BATCH = gql`fragment StatementImportBatch on BankStatementImport {
  id status fileName financialAccountId currency expiresAt
  rows { rowNumber date description amount direction error warning duplicate possibleDuplicate candidates { id kind label amount date status otherAccountId cardId statementDueDate } }
  result { ...StatementImportResult }
} ${RESULT}`;

export const PREVIEW_BANK_STATEMENT = gql`mutation PreviewBankStatementImport($input: PreviewBankStatementImportInput!) {
  previewBankStatementImport(input: $input) { mappingRequired headers samples delimiter sourceAccount batch { ...StatementImportBatch } }
} ${BATCH}`;
export const GET_BANK_STATEMENT_IMPORT = gql`query BankStatementImport($id: ID!) {
  bankStatementImport(id: $id) { ...StatementImportBatch }
} ${BATCH}`;
export const CONFIRM_BANK_STATEMENT = gql`mutation ConfirmBankStatementImport($input: ConfirmBankStatementImportInput!) {
  confirmBankStatementImport(input: $input) { ...StatementImportResult }
} ${RESULT}`;
export const BANK_STATEMENT_CONTEXT = gql`query BankStatementImportContext {
  myProfile { id }
  myFinancialAccounts { id name isDefault archived }
  myCategories { id name type }
}`;

export const STATEMENT_DESCRIPTION_MAX_LENGTH = 120;

/** Preserve valid UTF-16 when the limit lands inside a supplementary character. */
export function limitStatementDescription(description: string): string {
  const limited = description.slice(0, STATEMENT_DESCRIPTION_MAX_LENGTH);
  const lastUnit = limited.charCodeAt(limited.length - 1);
  return lastUnit >= 0xD800 && lastUnit <= 0xDBFF ? limited.slice(0, -1) : limited;
}

export function defaultStatementDecision(row: StatementRow): StatementDecision {
  return {
    rowNumber: row.rowNumber, action: row.error || row.duplicate || row.possibleDuplicate ? 'IGNORE' : 'CREATE',
    description: limitStatementDescription(row.description.trim()).trimEnd(), categoryId: null, targetId: null, otherAccountId: null,
    cardId: null, statementDueDate: null, acknowledgeDuplicate: false
  };
}

export function validStatementDecision(row: StatementRow, decision: StatementDecision, accountId: string): boolean {
  return statementDecisionIssues(row, decision, accountId).length === 0;
}

/** Use the same reasons for inline errors, cross-page review and submission. */
export function statementDecisionIssues(row: StatementRow, decision: StatementDecision | undefined, accountId: string): string[] {
  if (!decision) return ['Revise esta movimentação antes de confirmar.'];
  if (decision.action === 'IGNORE') return [];
  if (row.error) return [`Movimentação inválida: ${row.error} Escolha Ignorar ou corrija o arquivo.`];
  if (row.duplicate) return ['Movimentação já importada. Escolha Ignorar.'];
  const issues: string[] = [];
  if (!row.date) issues.push('Data da movimentação inválida.');
  if (!row.amount) issues.push('Valor da movimentação inválido.');
  if (!row.direction) issues.push('Não foi possível identificar entrada ou saída.');
  if (row.possibleDuplicate && !decision.acknowledgeDuplicate) issues.push('Confirme que revisou o possível duplicado.');
  switch (decision.action) {
    case 'CREATE': {
      if (!decision.categoryId) issues.push('Selecione uma categoria.');
      const length = decision.description.trim().length;
      if (!length) issues.push('Preencha a descrição.');
      else if (length > 120) issues.push(`Descrição com ${length} caracteres; o limite é 120.`);
      break;
    }
    case 'LINK_ACCOUNT':
      if (!row.candidates.some(item => item.id === decision.targetId && item.kind === (row.direction === 'EXPENSE' ? 'PAYABLE' : 'RECEIVABLE'))) issues.push('Selecione uma conta compatível para vincular.');
      break;
    case 'TRANSFER':
      if (decision.targetId) {
        if (!row.candidates.some(item => item.id === decision.targetId && item.kind === 'TRANSFER')) issues.push('Selecione uma transferência compatível.');
      } else if (!decision.otherAccountId || decision.otherAccountId === accountId) issues.push('Selecione outra conta para a transferência.');
      break;
    case 'CARD_PAYMENT':
      if (row.direction !== 'EXPENSE') issues.push('Pagamento de fatura precisa ser uma saída.');
      else if (!row.candidates.some(item => decision.targetId
        ? item.kind === 'CARD_PAYMENT' && item.id === decision.targetId
        : item.kind === 'CARD_STATEMENT' && item.cardId === decision.cardId && item.statementDueDate === decision.statementDueDate)) issues.push('Selecione uma fatura ou pagamento compatível.');
      break;
    default:
      issues.push('Selecione uma ação válida para a movimentação.');
  }
  return issues;
}

/** Keep totals exact while the user changes review decisions. */
export function statementReviewTotals(rows: StatementRow[], decisions: Record<number, StatementDecision>) {
  let income = 0n, expense = 0n;
  for (const row of rows) {
    if (!row.amount || !decisions[row.rowNumber] || decisions[row.rowNumber]!.action === 'IGNORE') continue;
    const [whole = '0', fraction = ''] = row.amount.split('.');
    const value = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
    if (row.direction === 'INCOME') income += value; else expense += value;
  }
  const decimal = (value: bigint) => `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
  return { income: decimal(income), expense: decimal(expense) };
}
