import {
  CreditCard,
  ArrowLeftRight,
  CalendarClock,
  HandCoins
} from 'lucide-react-native';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { ThemedModal } from '../ui/ThemedModal';

export type QuickAction = 'a_pagar' | 'a_receber' | 'despesa_cartao' | 'transferencia';

export interface QuickActionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectAction: (action: QuickAction) => void;
}

export function QuickActionModal({
  visible,
  onClose,
  onSelectAction
}: QuickActionModalProps): React.JSX.Element {
  const { theme } = useTheme();

  const handleSelect = (action: QuickAction) => {
    onClose();
    onSelectAction(action);
  };

  const actionItems = [
    { id: 'despesa_cartao' as const, title: 'Despesa Cartão', subtitle: 'Registrar compra à vista ou parcelada no cartão', icon: CreditCard, color: theme.expense, bg: theme.expenseBadge },
    {
      id: 'a_pagar' as const,
      title: 'Conta a Pagar',
      subtitle: 'Despesa futura ou boleto para agendar',
      icon: CalendarClock,
      color: theme.expense,
      bg: theme.expenseBadge
    },
    {
      id: 'a_receber' as const,
      title: 'Conta a Receber',
      subtitle: 'Receita prevista ou entrada a confirmar',
      icon: HandCoins,
      color: theme.income,
      bg: theme.incomeBadge
    },
    {
      id: 'transferencia' as const,
      title: 'Transferência',
      subtitle: 'Transferir ou agendar valores entre contas',
      icon: ArrowLeftRight,
      color: theme.info,
      bg: theme.infoBadge
    }
  ];

  return (
    <ThemedModal
      maxWidth={440}
      onClose={onClose}
      subtitle="Escolha o tipo de lançamento que deseja realizar"
      title="Novo Lançamento Rápido"
      visible={visible}
    >
      <View testID="quick-action-options" style={styles.list}>
        {actionItems.map((item) => {
          const Icon = item.icon;
          return (
            <Pressable
              accessibilityLabel={`Criar ${item.title}`}
              accessibilityRole="button"
              key={item.id}
              onPress={() => handleSelect(item.id)}
              style={({ pressed }) => [
                styles.itemCard,
                {
                  backgroundColor: theme.bgElevated,
                  borderColor: theme.borderElevated,
                  opacity: pressed ? 0.8 : 1
                }
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: item.bg }]}>
                <Icon color={item.color} size={20} />
              </View>
              <View style={styles.textWrap}>
                <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>
                  {item.title}
                </Text>
                <Text style={[styles.itemSubtitle, { color: theme.textSecondary }]}>
                  {item.subtitle}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </ThemedModal>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    borderRadius: 10,
    height: 42,
    justifyContent: 'center',
    width: 42
  },
  itemCard: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  itemSubtitle: {
    fontSize: 12,
    marginTop: 2
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700'
  },
  list: {
    gap: 10
  },
  textWrap: {
    flex: 1
  }
});
