import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

type AuthFormProps = Readonly<{
  mode: 'login' | 'register';
  onSubmit(email: string, password: string): Promise<void>;
}>;

function authErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return 'Nao foi possivel autenticar. Tente novamente.';
}

export function AuthForm({ mode, onSubmit }: AuthFormProps) {
  const registering = mode === 'register';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setError(null);
    if (registering && password !== confirmation) {
      setError('As senhas nao coincidem.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(email, password);
    } catch (submitError) {
      setError(authErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.form}>
      <View style={styles.field}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          accessibilityLabel="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          style={styles.input}
          value={email}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Senha</Text>
        <TextInput
          accessibilityLabel="Senha"
          autoComplete={registering ? 'new-password' : 'current-password'}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          value={password}
        />
      </View>
      {registering ? (
        <View style={styles.field}>
          <Text style={styles.label}>Confirmar senha</Text>
          <TextInput
            accessibilityLabel="Confirmar senha"
            autoComplete="new-password"
            onChangeText={setConfirmation}
            secureTextEntry
            style={styles.input}
            value={confirmation}
          />
        </View>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={submitting}
        onPress={submit}
        style={({ pressed }) => [
          styles.submit,
          pressed && styles.submitPressed,
          submitting && styles.submitDisabled
        ]}
      >
        {submitting ? <ActivityIndicator color="#ffffff" /> : null}
        <Text style={styles.submitText}>
          {registering ? 'Criar conta' : 'Entrar'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
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
  submitText: { color: '#ffffff', fontSize: 16, fontWeight: '700' }
});
