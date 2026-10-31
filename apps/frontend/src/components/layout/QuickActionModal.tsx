import {
  CreditCard,
  CalendarClock,
  HandCoins,
  Tag,
  WalletCards
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

export interface QuickActionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectAction: (action: 'a_pagar' | 'a_receber' | 'transacao' | 'categoria' | 'despesa_cartao') => void;
}

export function QuickActionModal({
  visible,
  onClose,
  onSelectAction
}: QuickActionModalProps): React.JSX.Element {
  const { theme } = useTheme();

  const handleSelect = (action: 'a_pagar' | 'a_receber' | 'transacao' | 'categoria' | 'despesa_cartao') => {
    onClose();
    onSelectAction(action);
  };

  const actionItems = [
    { id: 'despesa_cartao' as const, title: 'Despesa Cartão', subtitle: 'Registrar compra à vista ou parcelada no cartão', icon: CreditCard, color: theme.expense, bg: theme.expenseBadge },
    {
      id: 'a_pagar' as const,
      title: 'Nova Conta a Pagar',
      subtitle: 'Despesa futura ou boleto para agendar',
      icon: CalendarClock,
      color: theme.expense,
      bg: theme.expenseBadge
    },
    {
      id: 'a_receber' as const,
      title: 'Nova Conta a Receber',
      subtitle: 'Receita prevista ou entrada a confirmar',
      icon: HandCoins,
      color: theme.income,
      bg: theme.incomeBadge
    },
    {
      id: 'transacao' as const,
      title: 'Nova Transação',
      subtitle: 'Lançamento imediato de entrada ou saída',
      icon: WalletCards,
      color: theme.info,
      bg: theme.infoBadge
    },
    {
      id: 'categoria' as const,
      title: 'Nova Categoria',
      subtitle: 'Criar categoria personalizada com cor e ícone',
      icon: Tag,
      color: theme.warning,
      bg: theme.warningBadge
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
      <View style={styles.list}>
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
