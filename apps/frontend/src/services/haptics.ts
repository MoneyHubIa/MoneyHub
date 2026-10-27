import { Platform } from 'react-native';

export const haptic = {
  selection: async (): Promise<void> => {
    if (Platform.OS === 'web') return;
    try {
      const Haptics = await import('expo-haptics');
      await Haptics.selectionAsync();
    } catch {
      // Fallback gracioso quando expo-haptics não estiver disponível
    }
  },
  impactLight: async (): Promise<void> => {
    if (Platform.OS === 'web') return;
    try {
      const Haptics = await import('expo-haptics');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Fallback gracioso
    }
  },
  impactMedium: async (): Promise<void> => {
    if (Platform.OS === 'web') return;
    try {
      const Haptics = await import('expo-haptics');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Fallback gracioso
    }
  },
  success: async (): Promise<void> => {
    if (Platform.OS === 'web') return;
    try {
      const Haptics = await import('expo-haptics');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Fallback gracioso
    }
  },
  warning: async (): Promise<void> => {
    if (Platform.OS === 'web') return;
    try {
      const Haptics = await import('expo-haptics');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {
      // Fallback gracioso
    }
  }
};
