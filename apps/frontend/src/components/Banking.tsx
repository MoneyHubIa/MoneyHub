import { CardPurchaseForm } from './CardPurchaseForm';
import { Button, ChoiceButton, ToggleButton } from './ui';
import { decimal, integer, isoDate, validText } from '../utils/validation';
import { ValidatedInput as TextInput } from './ui/ValidatedInput';
import { randomUUID } from 'expo-crypto';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { gql } from '@apollo/client';
import { useApolloClient, useQuery } from '@apollo/client/react';
import { useTheme } from '../theme/ThemeContext';
import { FINANCIAL_ACCOUNTS_QUERY, FinancialAccountSelector, type FinancialAccountItem } from './FinancialAccountSelector';

const CONTEXT = gql`query BankingContext {
  myTransfers { id sourceId destinationId amount dueDate effectiveDate status }
  myCreditCards { id name brand financialAccountId creditLimit dueDay closingDay dynamicDays businessDays isPrimary archived payments { id amount paidOn reversed } statements { dueDate closingDate total paid outstanding items { id description amount installmentNumber installmentTotal } } }
  creditCardBrands
  myCategories { id name type }
}`;
type Statement = { dueDate: string; closingDate: string; total: string; paid: string; outstanding: string; items: { id: string; description: string; amount: string; installmentNumber: number; installmentTotal: number }[] };
type Card = { id: string; name: string; brand: string; financialAccountId: string; creditLimit: string; dueDay: number; closingDay: number; dynamicDays: number | null; businessDays: boolean; isPrimary: boolean; archived: boolean; payments?: { id: string; amount: string; paidOn: string; reversed: boolean }[]; statements: Statement[] };
type Transfer = { id: string; sourceId: string; destinationId: string; amount: string; dueDate: string; status: string };
const today = () => new Date().toISOString().slice(0, 10);
export function Banking({ section }: { section: 'accounts' | 'cards' | 'transfers' }) {
  const { theme } = useTheme();
  const client = useApolloClient();
  const { data: accountData } = useQuery<{ myFinancialAccounts: FinancialAccountItem[] }>(FINANCIAL_ACCOUNTS_QUERY);
  const { data, loading, error } = useQuery<{ myTransfers: Transfer[]; myCreditCards: Card[]; creditCardBrands: string[]; myCategories: { id: string; name: string; type: string }[] }>(CONTEXT);
  const [form, setForm] = useState<Record<string, string>>({ initialBalance: '0', type: 'CHECKING', dueDay: '10', closingDay: '3', first: '1', total: '1', dueDate: today(), purchasedOn: today(), paidOn: today() });
  const [selectedAccount, setSelectedAccount] = useState<string[]>([]);
  const [destination, setDestination] = useState<string[]>([]);
  const [primary, setPrimary] = useState(false);
  const [business, setBusiness] = useState(false);
  const [dynamic, setDynamic] = useState(false);
  const [immediate, setImmediate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [cardId, setCardId] = useState('');
  const [action, setAction] = useState<'card' | 'purchase' | 'payment'>('card');
  const operation = useRef<{ key: string; id: string } | null>(null);
  const inFlight = useRef(false);
  const uuid = () => {
    const key = JSON.stringify({ section, action, form, selectedAccount, destination, immediate, cardId });
    if (operation.current?.key !== key) operation.current = { key, id: randomUUID() };
    return operation.current.id;
  };
  const accounts = accountData?.myFinancialAccounts ?? [];
  const accountId = selectedAccount[0] ?? accounts.find(a => a.isDefault)?.id;
  const field = (name: string, label: string, numeric = false) => <View key={name} style={{ gap: 4 }}><Text style={{ color: theme.textSecondary }}>{label}</Text><TextInput moneyDigits={numeric && !['dueDay', 'closingDay', 'dynamicDays', 'first', 'total'].includes(name) ? name === 'initialBalance' ? 16 : 10 : undefined} signed={name === 'initialBalance'} integerOnly={['dueDay', 'closingDay', 'dynamicDays', 'first', 'total'].includes(name)} maxLength={numeric ? undefined : ['dueDate', 'purchasedOn', 'paidOn'].includes(name) ? 10 : name === 'additionalData' ? 1000 : name === 'customBrand' ? 60 : 120} accessibilityLabel={label} keyboardType={numeric ? 'decimal-pad' : 'default'} value={form[name] ?? ''} onChangeText={v => setForm(p => ({ ...p, [name]: v }))} style={{ color: theme.textPrimary, borderColor: theme.borderElevated, borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 44 }} /></View>;
  const button = (label: string, fn: () => void, selected?: boolean) => selected !== undefined
    ? <ChoiceButton key={label} title={label} selected={selected} disabled={busy} onPress={fn} />
    : <Button key={label} title={label} variant={label === 'Salvar' ? 'primary' : /^(Cancelar|Estornar)/.test(label) ? 'danger' : 'secondary'} disabled={busy || (label === 'Salvar' && !formValid)} onPress={fn} style={{ minHeight: 48 }} />;
  const toggle = (label: string, value: boolean, change: (v: boolean) => void) => <ToggleButton label={label} value={value} onChange={change} disabled={busy} />;
  async function mutate(document: string, variables: Record<string, unknown>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setMessage('');
    try {
      await client.mutate({ mutation: gql(document), variables });
      await client.refetchQueries({ include: 'active' });
      operation.current = null;
      setMessage('Operação concluída.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  const activeAccount = !!accounts.find(a => a.id === accountId && !a.archived);
  const activeCard = !!data?.myCreditCards.find(c => c.id === cardId && !c.archived);
  const formValid = section === 'accounts' ? validText(form.name ?? '', 120) && !!decimal(form.initialBalance ?? '0', 16, true) && ['CHECKING', 'SAVINGS', 'INVESTMENT', 'OTHER'].includes(form.type ?? '') && (form.accountNumber?.length ?? 0) <= 120 && (form.additionalData?.length ?? 0) <= 1000
    : section === 'transfers' ? activeAccount && !!accounts.find(a => a.id === destination[0] && !a.archived && a.id !== accountId) && !!decimal(form.amount ?? '') && isoDate(form.dueDate ?? '')
    : action === 'card' ? activeAccount && validText(form.name ?? '', 120) && validText(form.brand === 'Outra' ? form.customBrand ?? '' : form.brand ?? 'Visa', 60) && !!decimal(form.creditLimit ?? '') && integer(form.dueDay ?? '', 31) && (dynamic || integer(form.closingDay ?? '', 31)) && (!dynamic || integer(form.dynamicDays ?? '7', 28))
    : activeCard && !!decimal(form.amount ?? '') && (action === 'purchase' ? validText(form.description ?? '', 120) && !!data?.myCategories.some(c => c.id === form.categoryId && c.type !== 'INCOME') && isoDate(form.purchasedOn ?? '') && integer(form.first ?? '') && integer(form.total ?? '') && Number(form.first) <= Number(form.total) : isoDate(form.dueDate ?? '') && isoDate(form.paidOn ?? ''));
  function save() {
    if (!formValid || busy) return;
    if (section === 'accounts') void mutate('mutation SaveAccount($input: FinancialAccountInput!) { saveFinancialAccount(input:$input) { id } }', { input: { ...(form.id ? { id: form.id } : {}), name: form.name, type: form.type, accountNumber: form.accountNumber || null, additionalData: form.additionalData || null, initialBalance: decimal(form.initialBalance ?? '0', 16, true), isDefault: primary, archived: form.archived === 'true' } });
    if (section === 'transfers') void mutate('mutation Transfer($input: TransferInput!) { createTransfer(input:$input) { id } }', { input: { operationId: uuid(), sourceId: accountId, destinationId: destination[0], amount: decimal(form.amount ?? ''), dueDate: form.dueDate, ...(immediate ? { effectiveDate: form.dueDate } : {}) } });
    if (section === 'cards' && action === 'card') void mutate('mutation SaveCard($input: CreditCardInput!) { saveCreditCard(input:$input) { id } }', { input: { ...(form.id ? { id: form.id } : {}), name: form.name, financialAccountId: accountId, brand: form.brand === 'Outra' ? form.customBrand : form.brand ?? 'Visa', creditLimit: decimal(form.creditLimit ?? ''), dueDay: Number(form.dueDay), closingDay: Number(dynamic ? form.dueDay : form.closingDay), dynamicDays: dynamic ? Number(form.dynamicDays ?? '7') : null, businessDays: business, isPrimary: primary, archived: form.archived === 'true' } });
    if (section === 'cards' && action === 'payment') void mutate('mutation PayCard($input: CardPaymentInput!) { payCreditCardStatement(input:$input) }', { input: { cardId, operationId: uuid(), dueDate: form.dueDate, paidOn: form.paidOn, amount: decimal(form.amount ?? '') } });
  }
  return <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
    <Text style={{ color: theme.textPrimary, fontSize: 24, fontWeight: '700' }}>{section === 'accounts' ? 'Contas financeiras' : section === 'cards' ? 'Cartões de crédito' : 'Transferências'}</Text>
    {loading && <ActivityIndicator />}{error && <Text accessibilityRole="alert" style={{ color: theme.expense }}>{error.message}</Text>}
    {section === 'accounts' && accounts.map(a => <View key={a.id} style={{ padding: 16, borderColor: theme.borderElevated, borderWidth: 1, borderRadius: 12, gap: 8 }}><Text style={{ color: theme.textPrimary }}>{a.name}{a.isDefault ? ' • Padrão' : ''}{a.archived ? ' • Arquivada' : ''}</Text><Text style={{ color: theme.textPrimary, fontSize: 24 }}>{a.balance}</Text><Text style={{ color: theme.textSecondary }}>{a.accountNumber}</Text>{button(`Editar ${a.name}`, () => { setForm({ id: a.id, name: a.name, type: a.type, accountNumber: a.accountNumber ?? '', additionalData: a.additionalData ?? '', initialBalance: a.initialBalance, archived: String(a.archived) }); setPrimary(a.isDefault); })}</View>)}
    {section === 'cards' && <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{button('Cadastrar cartão', () => { setAction('card'); setForm(p => ({ ...p, id: '' })); }, action === 'card')}{button('Registrar compra', () => setAction('purchase'), action === 'purchase')}{button('Pagar fatura', () => setAction('payment'), action === 'payment')}</View>
      {(data?.myCreditCards ?? []).map(card => {
        const debt = card.statements.reduce((sum, s) => sum + Number(s.outstanding), 0);
        return <View key={card.id} style={{ borderWidth: 1, borderColor: cardId === card.id ? theme.income : theme.borderElevated, borderRadius: 12, padding: 16, gap: 8 }}>
          {action !== 'purchase' && button(`${card.name} • ${card.brand}${card.isPrimary ? ' • Principal' : ''}`, () => setCardId(card.id), cardId === card.id)}
          {button(`Editar ${card.name}`, () => {
            setAction('card'); setCardId(card.id); setSelectedAccount([card.financialAccountId]);
            setForm(p => ({ ...p, id: card.id, name: card.name, brand: card.brand, creditLimit: card.creditLimit, dueDay: String(card.dueDay), closingDay: String(card.closingDay), dynamicDays: String(card.dynamicDays ?? 7), archived: String(card.archived) }));
            setBusiness(card.businessDays); setDynamic(card.dynamicDays !== null); setPrimary(card.isPrimary);
          })}
          <Text style={{ color: theme.textPrimary }}>Limite: {card.creditLimit} • Disponível: {(Number(card.creditLimit) - debt).toFixed(2)}</Text>
          {debt > Number(card.creditLimit) && <Text style={{ color: theme.expense }}>Limite excedido</Text>}
          {card.payments?.filter(p => !p.reversed).map(p => button('Estornar pagamento ' + p.amount + ' de ' + p.paidOn, () => void mutate('mutation ReverseCardPayment($id: ID!) { reverseCreditCardPayment(id:$id) }', { id: p.id })))}
          {card.statements.map(s => <View key={s.dueDate} style={{ gap: 4 }}><Text style={{ color: theme.textPrimary }}>Vencimento {s.dueDate} • Fechamento {s.closingDate}</Text><Text style={{ color: theme.textSecondary }}>Total {s.total} • Pago {s.paid} • Em aberto {s.outstanding}</Text>{s.items.map(i => <Text key={i.id} style={{ color: theme.textSecondary }}>{i.description} • {i.installmentNumber}/{i.installmentTotal} • {i.amount}</Text>)}{button(`Pagar fatura ${s.dueDate}`, () => { setAction('payment'); setCardId(card.id); setForm(p => ({ ...p, dueDate: s.dueDate, amount: s.outstanding })); })}</View>)}
        </View>;
      })}
    </>}
    {section !== 'cards' || action === 'card' ? <>
      {section !== 'accounts' && <FinancialAccountSelector value={selectedAccount} onChange={setSelectedAccount} />}
      {section === 'accounts' && <>{field('name', 'Nome da conta')}<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[['CHECKING', 'Conta Corrente'], ['SAVINGS', 'Poupança'], ['INVESTMENT', 'Investimentos'], ['OTHER', 'Outra']].map(([id, label]) => button(label!, () => setForm(p => ({ ...p, type: id! })), form.type === id))}</View>{field('accountNumber', 'Número da conta')}{field('additionalData', 'Dados adicionais')}{field('initialBalance', 'Saldo inicial', true)}{toggle('Conta padrão', primary, setPrimary)}</>}
      {section === 'transfers' && <><Text style={{ color: theme.textPrimary }}>Conta destino</Text><FinancialAccountSelector value={destination} onChange={setDestination} />{field('amount', 'Valor', true)}{field('dueDate', 'Data prevista (YYYY-MM-DD)')}{toggle('Já efetivada', immediate, setImmediate)}</>}
      {section === 'cards' && <>{field('name', 'Nome do cartão')}<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(data?.creditCardBrands ?? []).map(brand => button(brand, () => setForm(p => ({ ...p, brand })), (form.brand ?? 'Visa') === brand))}</View>{form.brand === 'Outra' && field('customBrand', 'Nome da outra bandeira')}{field('creditLimit', 'Limite', true)}{field('dueDay', 'Dia de vencimento', true)}{toggle('Vencimento no próximo dia útil', business, setBusiness)}{toggle('Fechamento dinâmico', dynamic, setDynamic)}{dynamic ? field('dynamicDays', 'Dias antes do vencimento', true) : field('closingDay', 'Dia de fechamento', true)}{toggle('Cartão principal', primary, setPrimary)}</>}
    </> : action === 'purchase' ? <CardPurchaseForm cards={data?.myCreditCards ?? []} categories={data?.myCategories ?? []} cardId={cardId} onSelectCard={setCardId} onBusyChange={setBusy} onSuccess={() => setMessage('Operação concluída.')} onRegisterCard={() => setAction('card')} /> : <><Text style={{ color: theme.textSecondary }}>Selecione cartão acima.</Text>{field('dueDate', 'Vencimento da fatura (YYYY-MM-DD)')}{field('paidOn', 'Data do pagamento (YYYY-MM-DD)')}{field('amount', 'Valor do pagamento', true)}</>}
    {(section === 'accounts' || (section === 'cards' && action === 'card')) && form.id && toggle('Arquivada', form.archived === 'true', value => setForm(p => ({ ...p, archived: String(value) })))}
    {!(section === 'cards' && action === 'purchase') && !formValid && <Text accessibilityRole="alert" style={{ color: theme.textSecondary }}>Preencha os campos obrigatórios, selecione contas ou cartão e confira valores, datas e parcelas.</Text>}
    {!(section === 'cards' && action === 'purchase') && (busy ? <ActivityIndicator /> : button('Salvar', save))}
    {!!message && <Text accessibilityRole="alert" style={{ color: theme.textPrimary }}>{message}</Text>}
    {section === 'transfers' && data?.myTransfers.map(t => <View key={t.id} style={{ gap: 8 }}><Text style={{ color: theme.textPrimary }}>{accounts.find(a => a.id === t.sourceId)?.name} para {accounts.find(a => a.id === t.destinationId)?.name} • {t.amount} • {t.dueDate} • {t.status}</Text>{t.status === 'PENDING' && button('Efetivar transferência', () => void mutate('mutation CompleteTransfer($id: ID!, $cancel:Boolean!, $effectiveDate:String!) { changeTransfer(id:$id,cancel:$cancel,effectiveDate:$effectiveDate) { id } }', { id: t.id, cancel: false, effectiveDate: today() }))}{t.status !== 'CANCELLED' && button('Cancelar / estornar transferência', () => void mutate('mutation CancelTransfer($id: ID!, $cancel:Boolean!, $effectiveDate:String!) { changeTransfer(id:$id,cancel:$cancel,effectiveDate:$effectiveDate) { id } }', { id: t.id, cancel: true, effectiveDate: today() }))}</View>)}
  </ScrollView>;
}
