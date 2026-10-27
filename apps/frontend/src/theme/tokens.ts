export type ThemeMode = 'dark' | 'light';

export interface ColorTokens {
  bgPrimary: string;
  bgSurface: string;
  bgElevated: string;
  bgOverlay: string;
  border: string;
  borderElevated: string;
  separator: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  income: string;
  incomePressed: string;
  incomeBadge: string;
  incomeBadgeText: string;
  expense: string;
  expensePressed: string;
  expenseBadge: string;
  expenseBadgeText: string;
  warning: string;
  warningBadge: string;
  warningBadgeText: string;
  brandAI: string;
  brandAIBadge: string;
  brandAIBadgeText: string;
  info: string;
  infoBadge: string;
  infoBadgeText: string;
  cardHighlight: string;
}

export const tokens: Record<ThemeMode, ColorTokens> = {
  dark: {
    bgPrimary: '#090D16',
    bgSurface: '#111827',
    bgElevated: '#1F2937',
    bgOverlay: 'rgba(0, 0, 0, 0.65)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderElevated: 'rgba(255, 255, 255, 0.15)',
    separator: 'rgba(255, 255, 255, 0.06)',
    textPrimary: '#F9FAFB',
    textSecondary: '#9CA3AF',
    textMuted: '#6B7280',
    income: '#10B981',
    incomePressed: '#059669',
    incomeBadge: 'rgba(16, 185, 129, 0.16)',
    incomeBadgeText: '#34D399',
    expense: '#F43F5E',
    expensePressed: '#E11D48',
    expenseBadge: 'rgba(244, 63, 94, 0.16)',
    expenseBadgeText: '#FB7185',
    warning: '#F59E0B',
    warningBadge: 'rgba(245, 158, 11, 0.16)',
    warningBadgeText: '#FBBF24',
    brandAI: '#818CF8',
    brandAIBadge: 'rgba(129, 140, 248, 0.16)',
    brandAIBadgeText: '#A5B4FC',
    info: '#06B6D4',
    infoBadge: 'rgba(6, 182, 212, 0.16)',
    infoBadgeText: '#22D3EE',
    cardHighlight: 'rgba(255, 255, 255, 0.03)'
  },
  light: {
    bgPrimary: '#F2F2F7',
    bgSurface: '#FFFFFF',
    bgElevated: '#E5E5EA',
    bgOverlay: 'rgba(0, 0, 0, 0.4)',
    border: 'rgba(0, 0, 0, 0.08)',
    borderElevated: 'rgba(0, 0, 0, 0.14)',
    separator: 'rgba(60, 60, 67, 0.12)',
    textPrimary: '#000000',
    textSecondary: '#475569',
    textMuted: '#64748B',
    income: '#047857',
    incomePressed: '#065F46',
    incomeBadge: 'rgba(4, 120, 87, 0.12)',
    incomeBadgeText: '#047857',
    expense: '#BE123C',
    expensePressed: '#9F1239',
    expenseBadge: 'rgba(190, 18, 60, 0.12)',
    expenseBadgeText: '#BE123C',
    warning: '#B45309',
    warningBadge: 'rgba(180, 83, 9, 0.12)',
    warningBadgeText: '#B45309',
    brandAI: '#4F46E5',
    brandAIBadge: 'rgba(79, 70, 229, 0.12)',
    brandAIBadgeText: '#4F46E5',
    info: '#0E7490',
    infoBadge: 'rgba(14, 116, 144, 0.12)',
    infoBadgeText: '#0E7490',
    cardHighlight: 'rgba(0, 0, 0, 0.01)'
  }
};
