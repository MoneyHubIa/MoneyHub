import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import type { AiOperationPlan } from '../services/aiOperations';

const STATUS: Record<string, string> = {
  PENDING: 'Aguardando confirmação', EXECUTING: 'Execução em andamento', COMPLETED: 'Operações concluídas',
  PARTIAL: 'Conclusão parcial', FAILED: 'Operações não concluídas', CANCELLED: 'Proposta cancelada', EXPIRED: 'Proposta expirada',
  SUCCEEDED: 'Salvo', BLOCKED: 'Bloqueado por dependência'
};
export function AiOperationPlanCard({ plan, busy, editing, onConfirm, onCancel, onEdit, onRefresh }: {
  plan: AiOperationPlan; busy: boolean; editing: boolean;
  onConfirm: () => void; onCancel: () => void; onEdit: () => void; onRefresh: () => void;
}) {
  const { theme } = useTheme();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (plan.status !== 'PENDING') return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, Date.parse(plan.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [plan.id, plan.status, plan.expiresAt]);
  const expired = plan.status === 'PENDING' && !plan.confirmedAt && Date.parse(plan.expiresAt) <= now;
  const pending = plan.status === 'PENDING' && !expired;
  const continuing = plan.status === 'EXECUTING';
  const retryable = ['PARTIAL', 'FAILED'].includes(plan.status);
  const button = (label: string, handler: () => void, primary = false, disabled = busy) => (
    <Pressable key={label} accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ disabled }} disabled={disabled} onPress={handler}
      style={({ pressed }) => [styles.button, { backgroundColor: primary ? theme.brandAI : theme.bgSurface, borderColor: theme.brandAI, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }]}>
      <Text style={{ color: primary ? '#ffffff' : theme.textPrimary, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
  return (
    <View accessibilityLabel="Resumo das operações" style={[styles.card, { borderColor: theme.borderElevated }]}>
      <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[styles.title, { color: theme.textPrimary }]}>
        {expired ? STATUS.EXPIRED : STATUS[plan.status] ?? plan.status}
      </Text>
      {plan.actions.map((action, index) => (
        <View key={action.id} style={[styles.action, { borderColor: theme.borderElevated }]}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>{index + 1}. {action.title}</Text>
          {action.details.map((detail, detailIndex) => (
            <View key={detailIndex} style={styles.detail}>
              <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>{detail.label}</Text>
              {detail.before != null && detail.before !== detail.after && (
                <Text style={{ color: theme.textPrimary }}>Antes: {detail.before}</Text>
              )}
              <Text style={{ color: theme.textPrimary }}>{detail.before != null && detail.before !== detail.after ? 'Depois: ' : ''}{detail.after}</Text>
            </View>
          ))}
          {plan.confirmedAt && <Text style={{ color: theme.textPrimary }}>{action.status === 'PENDING' ? 'Aguardando execução' : action.status === 'FAILED' ? 'Falhou' : STATUS[action.status] ?? action.status}</Text>}
          {action.error && <Text accessibilityLiveRegion="polite" style={{ color: theme.textPrimary }}>{action.error}</Text>}
        </View>
      ))}
      {plan.totals?.map(total => <Text key={total} style={{ color: theme.textPrimary, fontWeight: '700' }}>Total proposto — {total}</Text>)}
      {editing && <Text style={{ color: theme.textPrimary }}>Descreva a correção no campo de mensagem para gerar um novo resumo.</Text>}
      <View style={styles.buttons}>
        {(pending || continuing) && button(continuing ? 'Continuar execução' : 'Confirmar operações', onConfirm, true, busy || editing)}
        {pending && button('Corrigir pedido', onEdit)}
        {pending && button('Cancelar proposta', onCancel)}
        {(retryable || expired) && button(retryable ? 'Revisar pendências' : 'Preparar novo resumo', onEdit)}
        {plan.confirmedAt && button('Consultar resultado', onRefresh)}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 8, padding: 12, gap: 12, marginTop: 12 },
  title: { fontSize: 14, fontWeight: '700' },
  action: { borderTopWidth: 1, paddingTop: 10, gap: 8 },
  detail: { gap: 2 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { minHeight: 48, padding: 10, borderWidth: 1, borderRadius: 8, justifyContent: 'center' }
});
