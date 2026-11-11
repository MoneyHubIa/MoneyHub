import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_FILE_BYTES, parseStatement, type CsvMapping } from '../../../../src/modules/finance/bank-statement-imports/parsers.js';

const base64 = (text: string) => Buffer.from(text).toString('base64');
export const mapping: CsvMapping = { delimiter: ';', dateColumn: 0, descriptionColumn: 1, amountColumn: 2, dateFormat: 'DMY', decimalSeparator: ',' };
const ofx = (transactions: string, currency = 'BRL') => `OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\n\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>${currency}<BANKACCTFROM><BANKID>001<ACCTID>123</BANKACCTFROM><BANKTRANLIST>${transactions}</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
const transaction = (amount: string, id = 'unique') => `<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261109120000[-3:BRT]<TRNAMT>${amount}<FITID>${id}<MEMO>Mercado &amp; padaria</STMTTRN>`;

test('CSV mapping preserves exact money, quoted records, multiline text and regional dates', () => {
  const text = '\uFEFFData;Descrição;Valor\r\n09/11/2026;"Mercado; bairro";-1.234,56\r\n10/11/2026;"Serviço\nmensal";2.000,01';
  const initial = parseStatement('extrato.csv', base64(text));
  assert.equal(initial.mappingRequired, true);
  assert.equal(initial.delimiter, ';');
  assert.equal(initial.samples.length, 2);
  const parsed = parseStatement('extrato.csv', base64(text), mapping);
  assert.deepEqual(parsed.rows.map(row => [row.date, row.description, row.amount, row.direction]), [
    ['2026-11-09', 'Mercado; bairro', '1234.56', 'EXPENSE'], ['2026-11-10', 'Serviço\nmensal', '2000.01', 'INCOME']
  ]);
  const american = parseStatement('us.csv', base64('Date,Description,Amount\n11/09/2026,Work,"1,234.56"'), { ...mapping, delimiter: ',', dateFormat: 'MDY', decimalSeparator: '.' });
  assert.equal(american.rows[0]?.amount, '1234.56');
  assert.equal(american.rows[0]?.date, '2026-11-09');
});

test('CSV supports separate debit/credit and rejects ambiguous mappings and invalid lines', () => {
  const parsed = parseStatement('extrato.csv', base64('Data;Histórico;Débito;Crédito\n09/11/2026;Compra;10,25;0,00\n10/11/2026;Salário;;100,00\n31/02/2026;Inválida;1;\n10/11/2026;Ambígua;10;20\n10/11/2026;Zero;0;0'), { ...mapping, amountColumn: null, debitColumn: 2, creditColumn: 3 });
  assert.deepEqual(parsed.rows.slice(0, 2).map(row => [row.amount, row.direction]), [['10.25', 'EXPENSE'], ['100.00', 'INCOME']]);
  assert.ok(parsed.rows.slice(2).every(row => row.error));
  assert.throws(() => parseStatement('bad.csv', base64('a;b;c\n1;x;2'), { ...mapping, descriptionColumn: 0 }), /colunas distintas/);
  assert.throws(() => parseStatement('bad.csv', base64('a;b;c\n1;x;2'), { ...mapping, debitColumn: 1 }), /distintas|não ambos/);
});

test('OFX SGML and XML preserve identifiers, date and encoded descriptions', () => {
  const parsed = parseStatement('extrato.ofx', base64(ofx(transaction('-12.34'))));
  assert.equal(parsed.currency, 'BRL');
  assert.equal(parsed.rows[0]?.date, '2026-11-09');
  assert.equal(parsed.rows[0]?.description, 'Mercado & padaria');
  assert.equal(parsed.rows[0]?.amount, '12.34');
  const anotherFile = parseStatement('outro.ofx', base64(ofx(transaction('-12.34') + transaction('1.00', 'new'))));
  assert.equal(anotherFile.rows[0]?.sourceKey, parsed.rows[0]?.sourceKey);
  const xml = '<?xml version="1.0"?><?OFX OFXHEADER="200" VERSION="220"?><OFX><STMTRS><CURDEF>BRL</CURDEF><BANKACCTFROM><BANKID>001</BANKID><ACCTID>123</ACCTID></BANKACCTFROM><BANKTRANLIST><STMTTRN><DTPOSTED>20261110</DTPOSTED><TRNAMT>15.00</TRNAMT><FITID>xml</FITID><NAME>Pix recebido</NAME></STMTTRN></BANKTRANLIST></STMTRS></OFX>';
  assert.equal(parseStatement('xml.ofx', base64(xml)).rows[0]?.direction, 'INCOME');
  assert.ok(parseStatement('repeat.ofx', base64(ofx(transaction('1') + transaction('1')))).rows[1]?.error);
  assert.ok(parseStatement('zero.ofx', base64(ofx(transaction('0')))).rows[0]?.error);
});

test('parser rejects binary, malformed, oversized, unsupported and excessive input', () => {
  assert.throws(() => parseStatement('image.pdf', base64('pdf')), /Formato não suportado/);
  assert.throws(() => parseStatement('bad.csv', base64('a\0b')), /binário/);
  assert.throws(() => parseStatement('bad.csv', '%%%='), /Arquivo inválido/);
  assert.throws(() => parseStatement('big.csv', Buffer.alloc(MAX_FILE_BYTES + 1, 'a').toString('base64')), /2 MiB/);
  assert.throws(() => parseStatement('many.csv', base64('a;b\n' + Array.from({ length: 501 }, () => '1;2').join('\n'))), /500/);
  assert.throws(() => parseStatement('broken.csv', base64('a;b\n"not closed')), /CSV inválido/);
  assert.throws(() => parseStatement('external.ofx', base64('<!DOCTYPE OFX><OFX></OFX>')), /externas/);
  assert.throws(() => parseStatement('bad.ofx', base64(ofx(transaction('1')).replace('</STMTTRN>', ''))), /incompleta/);
  assert.throws(() => parseStatement('card.ofx', base64('<OFX><CCSTMTRS></CCSTMTRS></OFX>')), /conta bancária/);
});

test('Windows-1252 accents decode without altering signed values', () => {
  const bytes = Buffer.from('Data;Descri\xe7\xe3o;Valor\n09/11/2026;Sal\xe1rio;123,45', 'latin1');
  assert.equal(parseStatement('latin.csv', bytes.toString('base64'), mapping).rows[0]?.description, 'Salário');
});
