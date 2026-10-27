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
import { useAppSafeArea } from '../../theme/useAppSafeArea';
import { useTheme } from '../../theme/ThemeContext';
import { useResponsive } from '../../theme/useResponsive';

export interface ThemedModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string | undefined;
  children: React.ReactNode;
  maxWidth?: number | undefined;
  contentStyle?: StyleProp<ViewStyle> | undefined;
}

export function ThemedModal({
  visible,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 540,
  contentStyle
}: ThemedModalProps): React.JSX.Element {
  const { theme } = useTheme();
  const { isMobile } = useResponsive();
  const insets = useAppSafeArea();

  const animationType = isMobile ? 'slide' : 'fade';
  const bottomInset = isMobile ? Math.max(insets.bottom, 16) : 20;

  return (
    <Modal
      animationType={animationType}
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.overlay, isMobile && styles.overlayMobile]}
      >
        <Pressable
          accessibilityLabel="Fechar modal ao clicar fora"
          onPress={onClose}
          style={styles.backdrop}
        />
        <View
          style={[
            styles.dialog,
            isMobile ? styles.dialogMobile : styles.dialogDesktop,
            {
              backgroundColor: theme.bgSurface,
              borderColor: theme.border,
              maxWidth: isMobile ? '100%' : maxWidth
            },
            contentStyle
          ]}
        >
          {isMobile && (
            <View style={styles.grabberContainer}>
              <View
                style={[
                  styles.grabber,
                  { backgroundColor: theme.separator || theme.textMuted }
                ]}
              />
            </View>
          )}

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
              accessibilityRole="button"
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                { backgroundColor: theme.bgElevated, opacity: pressed ? 0.7 : 1 }
              ]}
            >
              <X color={theme.textSecondary} size={18} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={[
              styles.body,
              { paddingBottom: bottomInset }
            ]}
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
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44
  },
  dialog: {
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '92%',
    overflow: 'hidden',
    zIndex: 1
  },
  dialogDesktop: {
    borderRadius: 16,
    width: '92%'
  },
  dialogMobile: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%'
  },
  grabber: {
    alignSelf: 'center',
    borderRadius: 2.5,
    height: 5,
    width: 36
  },
  grabberContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8
  },
  header: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    flex: 1,
    justifyContent: 'center',
    padding: 16
  },
  overlayMobile: {
    justifyContent: 'flex-end',
    padding: 0
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
