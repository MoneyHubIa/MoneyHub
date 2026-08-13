import { Link, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { authErrorMessage } from '../services/authErrorMessage';
import type { PasswordRecoveryClient } from '../services/passwordRecoveryClient';

const INVALID_LINK_MESSAGE =
  'Este link de recuperação é inválido, expirou ou já foi usado.';

function recoveryErrorCode(error: unknown) {
  return typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : null;
}

type ForgotPasswordScreenProps = Readonly<{
  client: PasswordRecoveryClient;
}>;

type ResetPasswordScreenProps = Readonly<{
  client: PasswordRecoveryClient;
  logout(): Promise<void>;
  mode?: string | undefined;
  oobCode?: string | undefined;
}>;

function RecoveryPage({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.page}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.brand}>MoneyHub</Text>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SubmitButton({
  label,
  loading,
  onPress
}: Readonly<{
  label: string;
  loading: boolean;
  onPress(): void;
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.submit,
        pressed && styles.submitPressed,
        loading && styles.submitDisabled
      ]}
    >
      {loading ? <ActivityIndicator color="#ffffff" /> : null}
      <Text style={styles.submitText}>{label}</Text>
    </Pressable>
  );
}

export function ForgotPasswordScreen({ client }: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    setMessage(null);
    setSubmitting(true);
    try {
      await client.request(email);
      setMessage(
        'Se houver uma conta para este e-mail, enviaremos um link de recuperação.'
      );
    } catch {
      setMessage('Não foi possível solicitar a recuperação. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RecoveryPage>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>Recuperar senha</Text>
        <Text style={styles.subtitle}>
          Informe seu e-mail para receber as próximas instruções.
        </Text>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>E-mail</Text>
        <TextInput
          accessibilityLabel="E-mail"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          style={styles.input}
          value={email}
        />
      </View>
      {message ? <Text accessibilityRole="alert" style={styles.feedback}>{message}</Text> : null}
      <SubmitButton
        label="Enviar link de recuperação"
        loading={submitting}
        onPress={() => void submit()}
      />
      <Link href="/login" style={styles.link}>Voltar para login</Link>
    </RecoveryPage>
  );
}

export function ResetPasswordScreen(props: ResetPasswordScreenProps) {
  const actionIdentity = `${props.mode ?? ''}:${props.oobCode ?? ''}`;

  return <ResetPasswordFlow key={actionIdentity} {...props} />;
}

function ResetPasswordFlow({
  client,
  logout,
  mode,
  oobCode
}: ResetPasswordScreenProps) {
  const validParameters = mode === 'resetPassword' && Boolean(oobCode?.trim());
  const [checking, setChecking] = useState(validParameters);
  const [validCode, setValidCode] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    validParameters ? null : INVALID_LINK_MESSAGE
  );
  const [retryableVerificationError, setRetryableVerificationError] = useState(false);
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!validParameters || !oobCode) {
      setChecking(false);
      setValidCode(false);
      setRetryableVerificationError(false);
      setError(INVALID_LINK_MESSAGE);
      return;
    }
    let active = true;

    setChecking(true);
    setValidCode(false);
    setRetryableVerificationError(false);
    setError(null);

    void client.verifyCode(oobCode).then(
      () => {
        if (!active) return;
        setValidCode(true);
        setChecking(false);
      },
      (verifyError) => {
        if (!active) return;
        const code = recoveryErrorCode(verifyError);
        const invalidCode =
          code === 'auth/expired-action-code' ||
          code === 'auth/invalid-action-code';
        setRetryableVerificationError(!invalidCode);
        setError(invalidCode ? INVALID_LINK_MESSAGE : authErrorMessage(verifyError));
        setChecking(false);
      }
    );

    return () => {
      active = false;
    };
  }, [client, oobCode, validParameters, verificationAttempt]);

  const submit = async () => {
    setError(null);
    if (!password || !confirmation) {
      setError('Informe e confirme a nova senha.');
      return;
    }
    if (password !== confirmation) {
      setError('As senhas não coincidem.');
      return;
    }
    if (!oobCode) {
      setError(INVALID_LINK_MESSAGE);
      return;
    }

    setSubmitting(true);
    try {
      await client.confirm(oobCode, password);
      await logout();
      setCompleted(true);
    } catch (submitError) {
      const code = recoveryErrorCode(submitError);
      if (
        code === 'auth/expired-action-code' ||
        code === 'auth/invalid-action-code'
      ) {
        setError(INVALID_LINK_MESSAGE);
        setValidCode(false);
        return;
      }
      setError(authErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <RecoveryPage>
        <View accessibilityLabel="Validando link de recuperação" style={styles.loading}>
          <ActivityIndicator color="#0f766e" size="large" />
          <Text style={styles.subtitle}>Validando seu link...</Text>
        </View>
      </RecoveryPage>
    );
  }

  if (!validCode) {
    return (
      <RecoveryPage>
        <Text accessibilityRole="header" style={styles.title}>
          {retryableVerificationError
            ? 'Não foi possível validar o link'
            : 'Link indisponível'}
        </Text>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {retryableVerificationError ? (
          <SubmitButton
            label="Tentar novamente"
            loading={false}
            onPress={() => setVerificationAttempt((attempt) => attempt + 1)}
          />
        ) : (
          <Link href={'/forgot-password' as Href} style={styles.link}>
            Solicitar novo link
          </Link>
        )}
      </RecoveryPage>
    );
  }

  if (completed) {
    return (
      <RecoveryPage>
        <Text accessibilityRole="header" style={styles.title}>
          Senha redefinida com sucesso.
        </Text>
        <Link href="/login" style={styles.link}>Ir para login</Link>
      </RecoveryPage>
    );
  }

  return (
    <RecoveryPage>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>Crie uma nova senha</Text>
        <Text style={styles.subtitle}>O Firebase validará os requisitos de segurança.</Text>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Nova senha</Text>
        <TextInput
          accessibilityLabel="Nova senha"
          autoComplete="new-password"
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          value={password}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Confirmar nova senha</Text>
        <TextInput
          accessibilityLabel="Confirmar nova senha"
          autoComplete="new-password"
          onChangeText={setConfirmation}
          secureTextEntry
          style={styles.input}
          value={confirmation}
        />
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <SubmitButton
        label="Redefinir senha"
        loading={submitting}
        onPress={() => void submit()}
      />
    </RecoveryPage>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#f8fafc', flex: 1 },
  content: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24
  },
  panel: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 20,
    maxWidth: 440,
    padding: 28,
    width: '100%'
  },
  brand: { color: '#0f766e', fontSize: 20, fontWeight: '700' },
  heading: { gap: 8 },
  title: { color: '#0f172a', fontSize: 24, fontWeight: '700' },
  subtitle: { color: '#64748b', fontSize: 15, lineHeight: 22 },
  field: { gap: 6 },
  label: { color: '#334155', fontSize: 14, fontWeight: '600' },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 6,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 12
  },
  feedback: { color: '#334155', fontSize: 14 },
  error: { color: '#b91c1c', fontSize: 14 },
  submit: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 6,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16
  },
  submitPressed: { backgroundColor: '#115e59' },
  submitDisabled: { opacity: 0.7 },
  submitText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  link: { color: '#0f766e', fontWeight: '700', textAlign: 'center' },
  loading: { alignItems: 'center', gap: 12 }
});
