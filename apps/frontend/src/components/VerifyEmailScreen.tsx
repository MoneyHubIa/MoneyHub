import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { CheckCircle2, LogOut, Mail, RefreshCw, Send } from 'lucide-react-native';
import { useAuth } from '../providers/AuthProvider';

export function VerifyEmailScreen() {
  const { user, refreshEmailVerification, resendEmailVerification, logout } = useAuth();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleRefresh = async () => {
    setChecking(true);
    setFeedback(null);
    try {
      const isVerified = await refreshEmailVerification();
      if (!isVerified) {
        setFeedback({
          type: 'info',
          message: 'Seu e-mail ainda não foi confirmado. Se você já clicou no link recebido, aguarde alguns segundos e tente novamente.'
        });
      }
    } catch (error: unknown) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Erro ao atualizar o status de verificação.'
      });
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setResending(true);
    setFeedback(null);
    try {
      await resendEmailVerification();
      setCooldown(60);
      setFeedback({
        type: 'success',
        message: 'E-mail de confirmação reenviado com sucesso! Verifique sua caixa de entrada e spam.'
      });
    } catch (error: unknown) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Erro ao reenviar e-mail de confirmação.'
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.page}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.iconBadge}>
            <Mail color="#0f766e" size={36} />
          </View>

          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.title}>
              Verifique seu e-mail
            </Text>
            <Text style={styles.subtitle}>
              Para garantir a segurança da sua conta e acessar seus dados financeiros, confirme seu endereço de e-mail através do link que enviamos.
            </Text>
          </View>

          {feedback ? (
            <View
              style={[
                styles.feedbackBox,
                feedback.type === 'success' && styles.feedbackSuccess,
                feedback.type === 'error' && styles.feedbackError,
                feedback.type === 'info' && styles.feedbackInfo
              ]}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 color="#059669" size={18} />
              ) : null}
              <Text
                style={[
                  styles.feedbackText,
                  feedback.type === 'success' && styles.feedbackSuccessText,
                  feedback.type === 'error' && styles.feedbackErrorText,
                  feedback.type === 'info' && styles.feedbackInfoText
                ]}
              >
                {feedback.message}
              </Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              accessibilityLabel="Já verifiquei meu e-mail"
              accessibilityRole="button"
              disabled={checking}
              onPress={handleRefresh}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
                checking && styles.buttonDisabled
              ]}
            >
              {checking ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <RefreshCw color="#ffffff" size={18} />
              )}
              <Text style={styles.primaryButtonText}>
                {checking ? 'Verificando...' : 'Já verifiquei meu e-mail'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityLabel="Reenviar e-mail de confirmação"
              accessibilityRole="button"
              disabled={resending || cooldown > 0}
              onPress={handleResend}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.secondaryButtonPressed,
                (resending || cooldown > 0) && styles.buttonDisabled
              ]}
            >
              {resending ? (
                <ActivityIndicator color="#0f766e" size="small" />
              ) : (
                <Send color="#0f766e" size={18} />
              )}
              <Text style={styles.secondaryButtonText}>
                {cooldown > 0
                  ? `Reenviar e-mail (${cooldown}s)`
                  : resending
                    ? 'Enviando...'
                    : 'Reenviar e-mail de confirmação'}
              </Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityLabel="Sair / Entrar com outra conta"
            accessibilityRole="button"
            onPress={logout}
            style={({ pressed }) => [
              styles.logoutButton,
              pressed && styles.logoutButtonPressed
            ]}
          >
            <LogOut color="#64748b" size={16} />
            <Text style={styles.logoutText}>Sair / Entrar com outra conta</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#f8fafc',
    flex: 1
  },
  content: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    gap: 20,
    maxWidth: 460,
    padding: 32,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3
  },
  iconBadge: {
    alignItems: 'center',
    backgroundColor: '#ccfbf1',
    borderRadius: 9999,
    height: 72,
    justifyContent: 'center',
    width: 72
  },
  heading: {
    alignItems: 'center',
    gap: 8
  },
  title: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center'
  },
  subtitle: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center'
  },
  feedbackBox: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    width: '100%'
  },
  feedbackSuccess: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0'
  },
  feedbackSuccessText: {
    color: '#065f46'
  },
  feedbackError: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca'
  },
  feedbackErrorText: {
    color: '#991b1b'
  },
  feedbackInfo: {
    backgroundColor: '#f0fdfa',
    borderColor: '#99f6e4'
  },
  feedbackInfoText: {
    color: '#115e59'
  },
  feedbackText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18
  },
  actions: {
    gap: 12,
    width: '100%'
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    height: 44,
    justifyContent: 'center',
    width: '100%'
  },
  primaryButtonPressed: {
    backgroundColor: '#115e59'
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600'
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#f0fdfa',
    borderColor: '#0f766e',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    height: 44,
    justifyContent: 'center',
    width: '100%'
  },
  secondaryButtonPressed: {
    backgroundColor: '#ccfbf1'
  },
  secondaryButtonText: {
    color: '#0f766e',
    fontSize: 14,
    fontWeight: '600'
  },
  buttonDisabled: {
    opacity: 0.6
  },
  logoutButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    padding: 8
  },
  logoutButtonPressed: {
    opacity: 0.7
  },
  logoutText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500'
  }
});
