import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from 'react-native';

const BOOTSTRAP_PROFILE = gql`
  mutation BootstrapProfile($input: BootstrapProfileInput!) {
    bootstrapProfile(input: $input) {
      created
    }
  }
`;

export default function OnboardingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = width >= 768;

  const [fullName, setFullName] = useState('');
  const [currency, setCurrency] = useState('BRL');
  const [theme, setTheme] = useState('SYSTEM');

  const [bootstrapProfile, { loading, error }] = useMutation(BOOTSTRAP_PROFILE, {
    refetchQueries: ['Me']
  });

  const handleSubmit = async () => {
    if (!fullName.trim()) return;
    
    try {
      await bootstrapProfile({
        variables: {
          input: {
            fullName,
            preferredCurrency: currency,
            theme
          }
        }
      });
      // Route the user to dashboard after success
      router.replace('/(app)');
    } catch (err) {
      // Error is handled by Apollo and displayed below
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={[styles.card, desktop && styles.cardDesktop]}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>Bem-vindo ao MoneyHub!</Text>
          <Text style={styles.subtitle}>
            Para começarmos, precisamos de alguns detalhes sobre você.
          </Text>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error.message}</Text>
          </View>
        )}

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Nome Completo</Text>
            <TextInput
              autoCapitalize="words"
              editable={!loading}
              onChangeText={setFullName}
              placeholder="Digite seu nome completo"
              style={styles.input}
              value={fullName}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Moeda Principal</Text>
            <View style={styles.buttonGroup}>
              {['BRL', 'USD', 'EUR'].map((c) => (
                <Pressable
                  key={c}
                  disabled={loading}
                  onPress={() => setCurrency(c)}
                  style={[
                    styles.groupButton,
                    currency === c && styles.groupButtonActive
                  ]}
                >
                  <Text style={[
                    styles.groupButtonText,
                    currency === c && styles.groupButtonTextActive
                  ]}>
                    {c}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Tema Preferido</Text>
            <View style={styles.buttonGroup}>
              {['SYSTEM', 'LIGHT', 'DARK'].map((t) => (
                <Pressable
                  key={t}
                  disabled={loading}
                  onPress={() => setTheme(t)}
                  style={[
                    styles.groupButton,
                    theme === t && styles.groupButtonActive
                  ]}
                >
                  <Text style={[
                    styles.groupButtonText,
                    theme === t && styles.groupButtonTextActive
                  ]}>
                    {t === 'SYSTEM' ? 'Sistema' : t === 'LIGHT' ? 'Claro' : 'Escuro'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={loading || !fullName.trim()}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.submitButton,
              (!fullName.trim() || loading) && styles.submitButtonDisabled,
              pressed && styles.submitButtonPressed
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>Concluir Cadastro</Text>
            )}
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: '100%',
    padding: 24,
    gap: 24
  },
  cardDesktop: {
    maxWidth: 480,
    padding: 32
  },
  header: {
    gap: 8
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a'
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b'
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecaca'
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14
  },
  form: {
    gap: 20
  },
  field: {
    gap: 8
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155'
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#0f172a'
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8
  },
  groupButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    backgroundColor: '#f8fafc'
  },
  groupButtonActive: {
    backgroundColor: '#e0f2fe',
    borderColor: '#38bdf8'
  },
  groupButtonText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 14
  },
  groupButtonTextActive: {
    color: '#0369a1'
  },
  submitButton: {
    backgroundColor: '#0f766e',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 8
  },
  submitButtonDisabled: {
    opacity: 0.6
  },
  submitButtonPressed: {
    backgroundColor: '#115e59'
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600'
  }
});
