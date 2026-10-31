import { X } from 'lucide-react-native';
import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export interface ThemedModalProps {
  visible: boolean;
  dismissDisabled?: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string | undefined;
  children: React.ReactNode;
  maxWidth?: number | undefined;
  contentStyle?: StyleProp<ViewStyle> | undefined;
}

export function ThemedModal({
  visible,
  dismissDisabled = false,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 540,
  contentStyle
}: ThemedModalProps): React.JSX.Element {
  const { theme } = useTheme();

  return (
    <Modal
      animationType="fade"
      onRequestClose={() => { if (!dismissDisabled) onClose(); }}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable
          accessibilityLabel="Fechar modal ao clicar fora"
          disabled={dismissDisabled}
          onPress={onClose}
          style={styles.backdrop}
        />
        <View
          style={[
            styles.dialog,
            {
              backgroundColor: theme.bgSurface,
              borderColor: theme.border,
              maxWidth
            },
            contentStyle
          ]}
        >
          <View style={styles.header}>
            <View style={styles.titleGroup}>
              <Text
                accessibilityRole="header"
                style={[styles.title, { color: theme.textPrimary }]}
              >
                {title}
              </Text>
              {subtitle && (
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  {subtitle}
                </Text>
              )}
            </View>
            <Pressable
              accessibilityLabel="Fechar modal"
              disabled={dismissDisabled}
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                { backgroundColor: theme.bgElevated, opacity: dismissDisabled ? 0.5 : pressed ? 0.7 : 1 }
              ]}
            >
              <X color={theme.textSecondary} size={18} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill
  },
  body: {
    padding: 20
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  dialog: {
    borderRadius: 16,
    borderWidth: 1,
    maxHeight: '90%',
    overflow: 'hidden',
    width: '92%',
    zIndex: 1
  },
  header: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    flex: 1,
    justifyContent: 'center',
    padding: 16
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2
  },
  title: {
    fontSize: 18,
    fontWeight: '700'
  },
  titleGroup: {
    flex: 1,
    marginRight: 12
  }
});
