import {
  Calendar,
  Compass,
  Plane,
  Plus,
  ShieldCheck,
  Sparkles,
  Target
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { ProgressBar } from './ui/ProgressBar';
import { ThemedModal } from './ui/ThemedModal';

export interface GoalPreviewItem {
  id: string;
  title: string;
  category: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  color: string;
  icon: typeof ShieldCheck;
}

const PREVIEW_GOALS: GoalPreviewItem[] = [
  {
    id: 'goal-1',
    title: 'Reserva de Emergência',
    category: 'Segurança',
    targetAmount: 30000,
    currentAmount: 18500,
    deadline: 'Dezembro / 2026',
    color: '#10B981',
    icon: ShieldCheck
  },
  {
    id: 'goal-2',
    title: 'Viagem dos Sonhos',
    category: 'Lazer',
    targetAmount: 12000,
    currentAmount: 8400,
    deadline: 'Julho / 2026',
    color: '#06B6D4',
    icon: Plane
  },
  {
    id: 'goal-3',
    title: 'Troca de Carro',
    category: 'Bens',
    targetAmount: 50000,
    currentAmount: 15000,
    deadline: 'Junho / 2027',
    color: '#6366F1',
    icon: Target
  }
];

export function FinancialGoalsPreview(): React.JSX.Element {
  const { theme } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={[styles.eyebrow, { color: theme.brandAI }]}>
            PLANEJAMENTO INTELIGENTE
          </Text>
          <Badge icon={Sparkles} label="Em breve" tone="brandAI" />
        </View>

        <Text
          accessibilityRole="header"
          style={[styles.title, { color: theme.textPrimary }]}
        >
          Metas Financeiras
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Defina objetivos financeiros, acompanhe o progresso das suas reservas e realize seus planos com projeções inteligentes.
        </Text>
      </View>

      {/* Info Card - Em preparação */}
      <Card style={[styles.noticeCard, { borderColor: theme.brandAI }]} variant="elevated">
        <View style={styles.noticeHeader}>
          <View
            style={[
              styles.noticeIconWrap,
              { backgroundColor: 'rgba(99, 102, 241, 0.15)' }
            ]}
          >
            <Compass color={theme.brandAI} size={22} />
          </View>
          <View style={styles.noticeContent}>
            <Text style={[styles.noticeTitle, { color: theme.textPrimary }]}>
              Módulo de Metas em Preparação
            </Text>
            <Text style={[styles.noticeText, { color: theme.textSecondary }]}>
              Em breve você poderá cadastrar metas customizadas, vincular aportes automáticos a partir das suas receitas e receber análises preditivas da MoneyHub IA.
            </Text>
          </View>
        </View>

        <Button
          icon={Plus}
          onPress={() => setModalVisible(true)}
          style={{ marginTop: 12 }}
          title="Nova Meta (Demonstração)"
          variant="primary"
        />
      </Card>

      {/* Preview Goals Grid */}
      <View style={styles.goalsSection}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
          Metas em Andamento (Simulação)
        </Text>

        <View style={styles.grid}>
          {PREVIEW_GOALS.map((goal) => {
            const Icon = goal.icon;
            const progress = goal.currentAmount / goal.targetAmount;
            const progressPercent = Math.round(progress * 100);

            return (
              <Card key={goal.id} style={styles.goalCard} variant="surface">
                <View style={styles.goalCardHeader}>
                  <View
                    style={[
                      styles.goalIconWrap,
                      { backgroundColor: goal.color + '20' }
                    ]}
                  >
                    <Icon color={goal.color} size={22} />
                  </View>
                  <View style={styles.goalCardInfo}>
                    <Text style={[styles.goalTitle, { color: theme.textPrimary }]}>
                      {goal.title}
                    </Text>
                    <Text style={[styles.goalCategory, { color: theme.textMuted }]}>
                      {goal.category}
                    </Text>
                  </View>
                  <Badge
                    label={`${progressPercent}%`}
                    tone={progressPercent >= 70 ? 'income' : 'brandAI'}
                  />
                </View>

                {/* Progress bar */}
                <View style={styles.progressWrap}>
                  <ProgressBar
                    color={goal.color}
                    progress={progress}
                  />
                </View>

                {/* Financial figures */}
                <View style={styles.figuresRow}>
                  <View>
                    <Text style={[styles.figureLabel, { color: theme.textSecondary }]}>
                      Acumulado
                    </Text>
                    <Text style={[styles.figureValue, { color: theme.income }]}>
                      {`R$ ${goal.currentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.figureLabel, { color: theme.textSecondary }]}>
                      Meta Final
                    </Text>
                    <Text style={[styles.figureValue, { color: theme.textPrimary }]}>
                      {`R$ ${goal.targetAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    </Text>
                  </View>
                </View>

                {/* Deadline */}
                <View
                  style={[
                    styles.deadlineContainer,
                    { borderTopColor: theme.borderElevated }
                  ]}
                >
                  <Calendar color={theme.textMuted} size={13} />
                  <Text style={[styles.deadlineText, { color: theme.textMuted }]}>
                    Previsão de conclusão: {goal.deadline}
                  </Text>
                </View>
              </Card>
            );
          })}
        </View>
      </View>

      {/* Demo Modal */}
      <ThemedModal
        onClose={() => setModalVisible(false)}
        title="Criar Nova Meta (Preview)"
        visible={modalVisible}
      >
        <View style={styles.modalBody}>
          <Text style={[styles.modalText, { color: theme.textSecondary }]}>
            O backend para cadastro e conciliação de metas estará disponível em uma próxima atualização da API GraphQL da MoneyHub.
          </Text>
          <Text style={[styles.modalText, { color: theme.textSecondary, marginTop: 8 }]}>
            Você poderá conectar contas de investimento e programar alocações recorrentes.
          </Text>
          <Button
            onPress={() => setModalVisible(false)}
            style={{ marginTop: 16 }}
            title="Entendi"
            variant="primary"
          />
        </View>
      </ThemedModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
    paddingBottom: 40
  },
  deadlineContainer: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    paddingTop: 10
  },
  deadlineText: {
    fontSize: 12
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  figureLabel: {
    fontSize: 11,
    fontWeight: '500'
  },
  figureValue: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2
  },
  figuresRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4
  },
  goalCard: {
    flexBasis: 280,
    flexGrow: 1,
    gap: 12,
    padding: 16
  },
  goalCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12
  },
  goalCardInfo: {
    flex: 1
  },
  goalCategory: {
    fontSize: 12
  },
  goalIconWrap: {
    alignItems: 'center',
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    width: 42
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '700'
  },
  goalsSection: {
    gap: 12
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14
  },
  header: {
    gap: 6
  },
  headerTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10
  },
  modalBody: {
    gap: 8,
    paddingVertical: 8
  },
  modalText: {
    fontSize: 14,
    lineHeight: 22
  },
  noticeCard: {
    borderWidth: 1,
    gap: 12,
    padding: 18
  },
  noticeContent: {
    flex: 1,
    gap: 4
  },
  noticeHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 14
  },
  noticeIconWrap: {
    alignItems: 'center',
    borderRadius: 10,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 20
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '700'
  },
  progressWrap: {
    marginVertical: 4
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700'
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 720
  },
  title: {
    fontSize: 26,
    fontWeight: '700'
  }
});
