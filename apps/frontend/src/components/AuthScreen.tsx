import { Link } from 'expo-router';
import { WalletCards } from 'lucide-react-native';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { AuthForm } from './AuthForm';

type AuthScreenProps = Readonly<{
  mode: 'login' | 'register';
  onSubmit(email: string, password: string): Promise<void>;
}>;

export function AuthScreen({ mode, onSubmit }: AuthScreenProps) {
  const registering = mode === 'register';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.page}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <WalletCards color="#0f766e" size={32} />
          <Text accessibilityRole="header" style={styles.brandName}>MoneyHub</Text>
        </View>
        <View style={styles.authPanel}>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.title}>
              {registering ? 'Crie sua conta' : 'Acesse sua conta'}
            </Text>
            <Text style={styles.subtitle}>
              {registering
                ? 'Comece a organizar sua vida financeira.'
                : 'Continue acompanhando suas financas.'}
            </Text>
          </View>
          <AuthForm mode={mode} onSubmit={onSubmit} />
          <Text style={styles.alternative}>
            {registering ? 'Ja possui uma conta? ' : 'Ainda nao possui uma conta? '}
            <Link href={registering ? '/login' : '/register'} style={styles.link}>
              {registering ? 'Entrar' : 'Criar conta'}
            </Link>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  brand: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24
  },
  brandName: { color: '#0f172a', fontSize: 26, fontWeight: '700' },
  authPanel: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 24,
    maxWidth: 440,
    padding: 28,
    width: '100%'
  },
  heading: { gap: 8 },
  title: { color: '#0f172a', fontSize: 24, fontWeight: '700' },
  subtitle: { color: '#64748b', fontSize: 15, lineHeight: 22 },
  alternative: { color: '#64748b', fontSize: 14, textAlign: 'center' },
  link: { color: '#0f766e', fontWeight: '700' }
});
