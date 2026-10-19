export type ThemeMode = 'dark' | 'light';

export interface ColorTokens {
  bgPrimary: string;
  bgSurface: string;
  bgElevated: string;
  border: string;
  borderElevated: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  income: string;
  incomeBadge: string;
  expense: string;
  expenseBadge: string;
  warning: string;
  warningBadge: string;
  brandAI: string;
  brandAIBadge: string;
  info: string;
  infoBadge: string;
}

export const tokens: Record<ThemeMode, ColorTokens> = {
  dark: {
    bgPrimary: '#0B0F19',
    bgSurface: '#111827',
    bgElevated: '#1E293B',
    border: '#1E293B',
    borderElevated: '#334155',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    income: '#10B981',
    incomeBadge: 'rgba(16, 185, 129, 0.15)',
    expense: '#F43F5E',
    expenseBadge: 'rgba(244, 63, 94, 0.15)',
    warning: '#F59E0B',
    warningBadge: 'rgba(245, 158, 11, 0.15)',
    brandAI: '#6366F1',
    brandAIBadge: 'rgba(99, 102, 241, 0.15)',
    info: '#06B6D4',
    infoBadge: 'rgba(6, 182, 212, 0.15)'
  },
  light: {
    bgPrimary: '#F8FAFC',
    bgSurface: '#FFFFFF',
    bgElevated: '#F1F5F9',
    border: '#E2E8F0',
    borderElevated: '#CBD5E1',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    income: '#10B981',
    incomeBadge: 'rgba(16, 185, 129, 0.15)',
    expense: '#F43F5E',
    expenseBadge: 'rgba(244, 63, 94, 0.15)',
    warning: '#F59E0B',
    warningBadge: 'rgba(245, 158, 11, 0.15)',
    brandAI: '#6366F1',
    brandAIBadge: 'rgba(99, 102, 241, 0.15)',
    info: '#06B6D4',
    infoBadge: 'rgba(6, 182, 212, 0.15)'
  }
};
