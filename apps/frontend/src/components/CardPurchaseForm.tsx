import { gql } from '@apollo/client';
import { useApolloClient, useQuery } from '@apollo/client/react';
import { randomUUID } from 'expo-crypto';
import { useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { decimal, integer, isoDate, validText } from '../utils/validation';
import { Button, ChoiceButton, ThemedModal } from './ui';
import { ValidatedInput } from './ui/ValidatedInput';

export const CARD_PURCHASE_CONTEXT = gql`query CardPurchaseContext {
  myCreditCards { id name brand archived }
  myCategories { id name type }
}`;
type Card = { id: string; name: string; brand: string; archived: boolean };
type Category = { id: string; name: string; type: string };
type Context = { myCreditCards: Card[]; myCategories: Category[] };
const PURCHASE = gql`mutation Purchase($input: PurchaseInput!) { recordCardPurchase(input:$input) }`;
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function CardPurchaseForm({ cards, categories, cardId, onSelectCard, onSuccess, onBusyChange, onRegisterCard, onCreateCategory }: {
  cards: Card[]; categories: Category[]; cardId: string; onSelectCard(id: string): void;
  onSuccess(): void; onBusyChange(busy: boolean): void;
  onRegisterCard?: (() => void) | undefined; onCreateCategory?: (() => void) | undefined;
}) {
  const { theme } = useTheme();
  const client = useApolloClient();
  const [form, setForm] = useState({ description: '', amount: '', purchasedOn: today(), first: '1', total: '1', categoryId: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const inFlight = useRef(false);
  const operation = useRef<{ key: string; id: string } | null>(null);
  const activeCards = cards.filter(card => !card.archived);
  const eligibleCategories = categories.filter(category => category.type === 'EXPENSE' || category.type === 'BOTH');
  const valid = activeCards.some(card => card.id === cardId) && eligibleCategories.some(category => category.id === form.categoryId) && validText(form.description, 120) && !!decimal(form.amount) && isoDate(form.purchasedOn) && integer(form.first) && integer(form.total) && Number(form.first) <= Number(form.total);

  async function save() {
    if (!valid || inFlight.current) return;
    const input = { cardId, categoryId: form.categoryId, description: form.description.trim(), amount: decimal(form.amount)!, purchasedOn: form.purchasedOn, first: Number(form.first), total: Number(form.total) };
    const key = JSON.stringify(input);
    if (operation.current?.key !== key) operation.current = { key, id: randomUUID() };
    inFlight.current = true; setBusy(true); onBusyChange(true); setMessage('');
    try {
      await client.mutate({ mutation: PURCHASE, variables: { input: { ...input, operationId: operation.current.id } } });
      await client.refetchQueries({ include: 'active' });
      operation.current = null;
      setForm({ description: '', amount: '', purchasedOn: today(), first: '1', total: '1', categoryId: '' });
      onSuccess();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível registrar a compra. Tente novamente.'); }
    finally { inFlight.current = false; setBusy(false); onBusyChange(false); }
  }

  const field = (name: 'description' | 'amount' | 'purchasedOn' | 'first' | 'total', label: string) => <View style={{ gap: 6 }}>
    <Text style={{ color: theme.textSecondary }}>{label}</Text>
    <ValidatedInput accessibilityLabel={label} value={form[name]} editable={!busy} moneyDigits={name === 'amount' ? 10 : undefined} integerOnly={name === 'first' || name === 'total'} maxLength={name === 'description' ? 120 : name === 'purchasedOn' ? 10 : undefined} onChangeText={value => setForm(previous => ({ ...previous, [name]: value }))} style={{ backgroundColor: theme.bgElevated, color: theme.textPrimary, borderColor: theme.borderElevated, borderWidth: 1, borderRadius: 8, minHeight: 48, padding: 12 }} />
  </View>;
  return <View style={{ gap: 16 }}>
    <Text style={{ color: theme.textSecondary }}>Cartão</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{activeCards.map(card => <ChoiceButton key={card.id} title={`${card.name} • ${card.brand}`} selected={cardId === card.id} disabled={busy} onPress={() => onSelectCard(card.id)} />)}</View>
    {!activeCards.length && <><Text style={{ color: theme.textSecondary }}>Cadastre um cartão ativo para registrar a despesa.</Text>{onRegisterCard && <Button title="Cadastrar cartão" variant="secondary" onPress={onRegisterCard} />}</>}
    {field('description', 'Descrição da compra')}
    {field('amount', 'Valor total da compra')}
    {field('purchasedOn', 'Data da compra (YYYY-MM-DD)')}
    {field('first', 'Parcela inicial')}
    {field('total', 'Total de parcelas')}
    <Text style={{ color: theme.textSecondary }}>Categoria</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{eligibleCategories.map(category => <ChoiceButton key={category.id} title={category.name} selected={form.categoryId === category.id} disabled={busy} onPress={() => setForm(previous => ({ ...previous, categoryId: category.id }))} />)}</View>
    {!eligibleCategories.length && <><Text style={{ color: theme.textSecondary }}>Cadastre uma categoria de despesa para continuar.</Text>{onCreateCategory && <Button title="Criar categoria" variant="secondary" onPress={onCreateCategory} />}</>}
    {!valid && <Text style={{ color: theme.textSecondary }}>Selecione cartão e categoria; preencha descrição, valor positivo, data válida e parcelas entre 1 e 1200.</Text>}
    {!!message && <Text accessibilityRole="alert" style={{ color: theme.expense }}>{message}</Text>}
    <Button title="Salvar" loading={busy} disabled={!valid} onPress={() => void save()} style={{ minHeight: 48 }} />
  </View>;
}

export function CardPurchaseModal({ onClose, onRegisterCard, onCreateCategory }: { onClose(): void; onRegisterCard(): void; onCreateCategory(): void }) {
  const { theme } = useTheme();
  const { data, loading, error, refetch } = useQuery<Context>(CARD_PURCHASE_CONTEXT);
  const [cardId, setCardId] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const close = () => { if (!busyRef.current) onClose(); };
  return <ThemedModal visible title="Despesa Cartão" subtitle="Registrar compra à vista ou parcelada no cartão" onClose={close} dismissDisabled={busy}>
    {loading ? <ActivityIndicator color={theme.income} /> : error ? <View style={{ gap: 12 }}><Text accessibilityRole="alert" style={{ color: theme.expense }}>Não foi possível carregar cartões e categorias.</Text><Button title="Tentar novamente" onPress={() => void refetch().catch(() => undefined)} /></View> : <CardPurchaseForm cards={data?.myCreditCards ?? []} categories={data?.myCategories ?? []} cardId={cardId} onSelectCard={setCardId} onSuccess={onClose} onBusyChange={value => { busyRef.current = value; setBusy(value); }} onRegisterCard={onRegisterCard} onCreateCategory={onCreateCategory} />}
    <Button title="Cancelar" variant="secondary" disabled={busy} onPress={close} style={{ marginTop: 12, minHeight: 48 }} />
  </ThemedModal>;
}
