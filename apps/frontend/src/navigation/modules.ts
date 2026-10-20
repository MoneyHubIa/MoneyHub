import {
  CalendarClock,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  LucideIcon,
  Repeat,
  Settings,
  Sparkles,
  Tag,
  Target,
  WalletCards
} from 'lucide-react-native';

export type NavigationId =
  | 'dashboard'
  | 'transacoes'
  | 'a_pagar'
  | 'a_receber'
  | 'financeiro'
  | 'metas'
  | 'ai'
  | 'recorrencias'
  | 'contas'
  | 'agenda'
  | 'ajustes';

export interface NavigationItem {
  id: NavigationId;
  label: string;
  icon: LucideIcon;
  isPrimary: boolean;
  badgeCountKey?: 'payables' | 'receivables' | undefined;
}

export const primaryModules: NavigationItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, isPrimary: true },
  { id: 'transacoes', label: 'Transações', icon: WalletCards, isPrimary: true },
  {
    id: 'a_pagar',
    label: 'Contas',
    icon: CalendarClock,
    isPrimary: true,
    badgeCountKey: 'payables'
  },
  { id: 'financeiro', label: 'Categorias', icon: Tag, isPrimary: true },
  { id: 'metas', label: 'Metas', icon: Target, isPrimary: true },
  { id: 'ai', label: 'MoneyHub IA', icon: Sparkles, isPrimary: true }
];

export const secondaryModules: NavigationItem[] = [
  { id: 'recorrencias', label: 'Recorrências', icon: Repeat, isPrimary: false },
  { id: 'contas', label: 'Centros de Custo', icon: CreditCard, isPrimary: false },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays, isPrimary: false }
];

export const allNavigationItems: NavigationItem[] = [
  ...primaryModules,
  ...secondaryModules,
  { id: 'ajustes', label: 'Ajustes', icon: Settings, isPrimary: false }
];
