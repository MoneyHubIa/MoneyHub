import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { cents, day, invalid, money } from '../banking/rules.js';

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_ROWS = 500;
export type CsvMapping = {
  delimiter: string;
  dateColumn: number;
  descriptionColumn: number;
  amountColumn?: number | null;
  debitColumn?: number | null;
  creditColumn?: number | null;
  dateFormat: 'DMY' | 'MDY' | 'ISO';
  decimalSeparator: string;
};
export type StatementRow = {
  rowNumber: number;
  date: string | null;
  description: string;
  amount: string | null;
  direction: 'INCOME' | 'EXPENSE' | null;
  sourceKey: string;
  fingerprint: string;
  error: string | null;
  warning: string | null;
};
export type ParsedStatement = {
  format: 'OFX' | 'CSV';
  fileHash: string;
  currency: string | null;
  sourceAccount: string | null;
  headers: string[];
  samples: string[][];
  delimiter: string;
  mappingRequired: boolean;
  rows: StatementRow[];
};

export function hash(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function fingerprint(date: string, description: string, signedAmount: string): string {
  return hash(JSON.stringify([date, description.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR'), signedAmount]));
}

function decode(bytes: Buffer): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, ''); }
  catch { return new TextDecoder('windows-1252').decode(bytes); }
}

function dateValue(value: string, format: CsvMapping['dateFormat'] | 'OFX'): string {
  let result = '';
  if (format === 'OFX') {
    const match = /^(\d{4})(\d{2})(\d{2})(?:\d{6}(?:\.\d+)?(?:\[[^\]]+\])?)?$/.exec(value.trim());
    if (match) result = `${match[1]}-${match[2]}-${match[3]}`;
  } else if (format === 'ISO') {
    result = value.trim();
  } else {
    const match = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(value.trim());
    if (match) result = `${match[3]}-${(format === 'DMY' ? match[2]! : match[1]!).padStart(2, '0')}-${(format === 'DMY' ? match[1]! : match[2]!).padStart(2, '0')}`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) invalid('Data inválida. Confira o formato selecionado.');
  day(result);
  return result;
}

function amountValue(value: string, decimal: string, signed = true): bigint {
  let text = value.trim().replace(/^(R\$|US\$|\$|€)\s*/, '').replace(/\s/g, '');
  if (/^\(.*\)$/.test(text)) text = '-' + text.slice(1, -1);
  const grouping = decimal === ',' ? '.' : ',';
  const escaped = grouping === '.' ? '\\.' : ',';
  const pattern = new RegExp(`^-?(?:\\d+|\\d{1,3}(?:${escaped}\\d{3})+)(?:${decimal === '.' ? '\\.' : ','}\\d{1,2})?$`);
  if (!pattern.test(text)) invalid('Valor inválido. Confira o separador decimal.');
  text = text.split(grouping).join('').replace(decimal, '.');
  const amount = cents(text, true);
  if ((!signed && amount < 0n) || amount === 0n || amount > 999999999999n || amount < -999999999999n) invalid('Valor deve ser diferente de zero e ter até 10 dígitos inteiros.');
  return amount;
}

function makeRow(rowNumber: number, fileHash: string, read: () => { date: string; description: string; signed: bigint }, sourceIdentity?: string, warning: string | null = null): StatementRow {
  const sourceKey = hash(sourceIdentity ?? `${fileHash}:${rowNumber}`);
  try {
    const value = read();
    if (!value.description.trim()) invalid('Descrição obrigatória.');
    const description = value.description.trim();
    return {
      rowNumber, date: value.date, description, amount: money(value.signed < 0n ? -value.signed : value.signed),
      direction: value.signed < 0n ? 'EXPENSE' : 'INCOME', sourceKey,
      fingerprint: fingerprint(value.date, description, money(value.signed)), error: null,
      warning
    };
  } catch (error) {
    return { rowNumber, date: null, description: '', amount: null, direction: null, sourceKey, fingerprint: hash(`${fileHash}:invalid:${rowNumber}`), error: error instanceof Error ? error.message : 'Linha inválida.', warning };
  }
}

function csvRecords(text: string, delimiter: string): string[][] {
  try {
    return parse(text, { delimiter, bom: true, skip_empty_lines: true, relax_column_count: true, max_record_size: 100_000 }) as string[][];
  } catch { return invalid('CSV inválido. Confira separador, aspas e tamanho das linhas.'); }
}

function parseCsv(text: string, fileHash: string, mapping?: CsvMapping | null, delimiterOverride?: string | null): ParsedStatement {
  let delimiter = mapping?.delimiter ?? delimiterOverride ?? ';';
  if (!mapping && !delimiterOverride) {
    let most = 0;
    for (const candidate of [';', ',', '\t']) {
      try {
        const count = csvRecords(text, candidate)[0]?.length ?? 0;
        if (count > most) { most = count; delimiter = candidate; }
      } catch { /* A delimiter inside a quoted field can make the other dialect invalid. */ }
    }
  }
  if (![';', ',', '\t'].includes(delimiter)) invalid('Separador CSV inválido.');
  const records = csvRecords(text, delimiter);
  const headers = records.shift() ?? [];
  if (headers.length < 2 || records.length === 0) invalid('CSV precisa de cabeçalho e movimentações.');
  if (records.length > MAX_ROWS) invalid(`Limite de ${MAX_ROWS} movimentações por arquivo.`);
  const result: ParsedStatement = { format: 'CSV', fileHash, currency: null, sourceAccount: null, headers, samples: records.slice(0, 3), delimiter, mappingRequired: !mapping, rows: [] };
  if (!mapping) return result;
  if (!['DMY', 'MDY', 'ISO'].includes(mapping.dateFormat) || !['.', ','].includes(mapping.decimalSeparator)) invalid('Formato de data ou valor inválido.');
  const columns = [mapping.dateColumn, mapping.descriptionColumn, mapping.amountColumn, mapping.debitColumn, mapping.creditColumn].filter((column): column is number => column != null);
  if (columns.some(column => !Number.isInteger(column) || column < 0 || column >= headers.length) || new Set(columns).size !== columns.length) invalid('Selecione colunas distintas e válidas.');
  if (mapping.amountColumn == null && (mapping.debitColumn == null || mapping.creditColumn == null)) invalid('Selecione valor ou as duas colunas de débito e crédito.');
  if (mapping.amountColumn != null && (mapping.debitColumn != null || mapping.creditColumn != null)) invalid('Use valor assinado ou débito/crédito, não ambos.');
  result.rows = records.map((record, index) => makeRow(index + 2, fileHash, () => {
    if (record.length !== headers.length) invalid('Quantidade de colunas diferente do cabeçalho.');
    let signed: bigint;
    if (mapping.amountColumn != null) signed = amountValue(record[mapping.amountColumn] ?? '', mapping.decimalSeparator);
    else {
      const debitText = record[mapping.debitColumn!] ?? '';
      const creditText = record[mapping.creditColumn!] ?? '';
      // Banks commonly export the unused side as an empty cell or formatted zero.
      const nonzero = (value: string) => !/^[-+]?0*(?:[.,]0+)?$/.test(value.trim()) && value.trim() !== '';
      const debit = nonzero(debitText) ? amountValue(debitText, mapping.decimalSeparator, false) : 0n;
      const credit = nonzero(creditText) ? amountValue(creditText, mapping.decimalSeparator, false) : 0n;
      if ((debit > 0n) === (credit > 0n)) invalid('Informe somente débito ou crédito na linha.');
      signed = credit - debit;
    }
    return { date: dateValue(record[mapping.dateColumn] ?? '', mapping.dateFormat), description: record[mapping.descriptionColumn] ?? '', signed };
  }));
  return result;
}

function tag(block: string, name: string): string {
  const match = new RegExp(`<${name}>([^<]*)`, 'i').exec(block);
  if (!match) return '';
  // Decode entities with the XML parser rather than interpreting markup as text.
  try { return String(new XMLParser({ parseTagValue: false, trimValues: false }).parse(`<v>${match[1]}</v>`).v ?? '').trim(); }
  catch { return invalid('Texto OFX inválido.'); }
}

function parseOfx(text: string, fileHash: string): ParsedStatement {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) invalid('Declarações externas não são aceitas em OFX.');
  const start = text.search(/<OFX>/i);
  if (start < 0 || !/<\/OFX>\s*$/i.test(text)) invalid('OFX inválido ou incompleto.');
  const body = text.slice(start);
  if (/OFXHEADER:200|<\?OFX\b/i.test(text) || /^\s*<\?xml/i.test(text)) {
    if (XMLValidator.validate(body) !== true) invalid('XML OFX inválido.');
  }
  if (/<CCSTMTRS>|<INVSTMTRS>/i.test(body)) invalid('Selecione extrato de conta bancária, não de cartão ou investimentos.');
  if ((body.match(/<STMTRS>/gi) ?? []).length !== 1 || (body.match(/<\/STMTRS>/gi) ?? []).length !== 1) invalid('Importe um extrato de uma conta bancária por arquivo.');
  const statements = body.match(/<STMTRS>[\s\S]*?<\/STMTRS>/gi) ?? [];
  if (statements.length !== 1) invalid('Importe um extrato de uma conta bancária por arquivo.');
  const statement = statements[0]!;
  const currency = tag(statement, 'CURDEF').toUpperCase();
  const bank = tag(statement, 'BANKID');
  const account = tag(statement, 'ACCTID');
  if (!currency || !bank || !account) invalid('OFX precisa identificar moeda, banco e conta.');
  const openingCount = (statement.match(/<STMTTRN>/gi) ?? []).length;
  const closingCount = (statement.match(/<\/STMTTRN>/gi) ?? []).length;
  if (openingCount > MAX_ROWS) invalid(`Limite de ${MAX_ROWS} movimentações por arquivo.`);
  if (openingCount !== closingCount) invalid('OFX contém movimentação incompleta.');
  const blocks = statement.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  if (openingCount !== blocks.length) invalid('OFX contém movimentação incompleta.');
  if (!blocks.length) invalid('Extrato sem movimentações.');
  if (blocks.length > MAX_ROWS) invalid(`Limite de ${MAX_ROWS} movimentações por arquivo.`);
  const seen = new Set<string>();
  const rows = blocks.map((block, index) => {
    const fitid = tag(block, 'FITID');
    const identity = fitid ? JSON.stringify(['OFX', bank, account, fitid]) : undefined;
    const row = makeRow(index + 1, fileHash, () => {
      if (/<CORRECTFITID>|<CORRECTACTION>/i.test(block)) invalid('Correção OFX exige revisão no banco antes de importar.');
      const signed = amountValue(tag(block, 'TRNAMT'), '.');
      return { date: dateValue(tag(block, 'DTPOSTED'), 'OFX'), description: tag(block, 'MEMO') || tag(block, 'NAME'), signed };
    }, identity, fitid ? null : 'OFX sem FITID. Confira possíveis duplicados.');
    if (seen.has(row.sourceKey)) row.error = 'Identificador bancário repetido no arquivo.';
    seen.add(row.sourceKey);
    return row;
  });
  return { format: 'OFX', fileHash, currency, sourceAccount: `${bank} / ${account}`, headers: [], samples: [], delimiter: '', mappingRequired: false, rows };
}

export function parseStatement(fileName: string, base64: string, mapping?: CsvMapping | null, csvDelimiter?: string | null): ParsedStatement {
  if (!fileName.trim() || fileName.length > 255) invalid('Nome de arquivo inválido.');
  if (base64.length > Math.ceil(MAX_FILE_BYTES / 3) * 4 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) invalid('Arquivo inválido ou maior que 2 MiB.');
  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.length || bytes.length > MAX_FILE_BYTES) invalid('Arquivo vazio ou maior que 2 MiB.');
  const text = decode(bytes);
  if (text.includes('\0')) invalid('Arquivo binário não suportado. Use OFX ou CSV.');
  const fileHash = hash(bytes);
  if (/\.ofx$/i.test(fileName)) return parseOfx(text, fileHash);
  if (/\.csv$/i.test(fileName)) return parseCsv(text, fileHash, mapping, csvDelimiter);
  return invalid('Formato não suportado. Selecione OFX ou CSV.');
}
