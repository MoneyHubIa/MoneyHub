import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { useAuth } from '../providers/AuthProvider';
import { hasGraphQLErrorCode } from '../services/graphqlErrors';

const MY_PROFILE_QUERY = gql`
  query MyProfile {
    myProfile {
      id
      fullName
      preferredCurrency
      theme
    }
  }
`;

const UPDATE_MY_PROFILE_MUTATION = gql`
  mutation UpdateMyProfile($input: UpdateMyProfileInput!) {
    updateMyProfile(input: $input) {
      id
      fullName
      preferredCurrency
      theme
    }
  }
`;

type ProfileTheme = 'SYSTEM' | 'LIGHT' | 'DARK';

type Profile = {
  id: string;
  fullName: string;
  preferredCurrency: string;
  theme: ProfileTheme;
};

type MyProfileData = { myProfile: Profile };
type UpdateProfileData = { updateMyProfile: Profile };
type UpdateProfileInput = Readonly<{
  fullName: string;
  preferredCurrency: string;
  theme: ProfileTheme;
}>;

const currencies = ['BRL', 'USD', 'EUR'];
const themes: Array<{ value: ProfileTheme; label: string }> = [
  { value: 'SYSTEM', label: 'Sistema' },
  { value: 'LIGHT', label: 'Claro' },
  { value: 'DARK', label: 'Escuro' }
];

export function ProfileSettings() {
  const { resendEmailVerification, refreshEmailVerification } = useAuth();
  const { data, error, loading } = useQuery<MyProfileData>(MY_PROFILE_QUERY);
  const [saveProfile, { loading: saving }] = useMutation<UpdateProfileData>(
    UPDATE_MY_PROFILE_MUTATION
  );
  const [fullName, setFullName] = useState('');
  const [preferredCurrency, setPreferredCurrency] = useState('BRL');
  const [theme, setTheme] = useState<ProfileTheme>('SYSTEM');
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [refreshingVerification, setRefreshingVerification] = useState(false);
  const loadedProfileId = useRef<string | null>(null);
  const rejectedProfileInput = useRef<UpdateProfileInput | null>(null);

  useEffect(() => {
    if (!data) return;
    if (loadedProfileId.current === data.myProfile.id) return;
    loadedProfileId.current = data.myProfile.id;
    setFullName(data.myProfile.fullName);
    setPreferredCurrency(data.myProfile.preferredCurrency);
    setTheme(data.myProfile.theme);
  }, [data]);

  const persistProfile = async (input: UpdateProfileInput) => {
    setVerificationMessage(null);
    await saveProfile({
      variables: { input }
    });
    rejectedProfileInput.current = null;
    setFullName(input.fullName);
    setVerificationRequired(false);
    setSuccessMessage('Alterações salvas com sucesso.');
  };

  const handleSave = async () => {
    const normalizedName = fullName.trim();
    if (!normalizedName) {
      setFormError('Informe seu nome completo.');
      setSuccessMessage(null);
      return;
    }

    setFormError(null);
    setSuccessMessage(null);
    setVerificationRequired(false);
    setVerificationMessage(null);
    rejectedProfileInput.current = null;

    const input: UpdateProfileInput = {
      fullName: normalizedName,
      preferredCurrency,
      theme
    };

    try {
      await persistProfile(input);
    } catch (error: unknown) {
      if (hasGraphQLErrorCode(error, 'EMAIL_NOT_VERIFIED')) {
        rejectedProfileInput.current = input;
        setVerificationRequired(true);
        return;
      }
      setFormError('Não foi possível salvar as alterações. Tente novamente.');
    }
  };

  const handleResendVerification = async () => {
    setResendingVerification(true);
    setVerificationMessage(null);
    try {
      await resendEmailVerification();
      setVerificationMessage(
        'Enviamos um novo e-mail de verificação. Confira também a caixa de spam.'
      );
    } catch {
      setVerificationMessage(
        'Não foi possível reenviar o e-mail de verificação. Tente novamente.'
      );
    } finally {
      setResendingVerification(false);
    }
  };

  const handleRefreshVerification = async () => {
    const input = rejectedProfileInput.current;
    setRefreshingVerification(true);
    setVerificationMessage(null);
    try {
      const verified = await refreshEmailVerification();
      if (!verified) {
        setVerificationMessage('A verificação ainda não foi detectada.');
        return;
      }

      try {
        if (!input) throw new Error('Missing rejected profile input.');
        await persistProfile(input);
      } catch (error: unknown) {
        if (hasGraphQLErrorCode(error, 'EMAIL_NOT_VERIFIED')) {
          setVerificationMessage('A verificação ainda não foi detectada.');
          return;
        }
        throw error;
      }
    } catch {
      setVerificationMessage(
        'Não foi possível atualizar o status da verificação. Tente novamente.'
      );
    } finally {
      setRefreshingVerification(false);
    }
  };

  const actionsDisabled = saving || resendingVerification || refreshingVerification;

  if (loading) {
    return <ActivityIndicator accessibilityLabel="Carregando perfil" color="#0f766e" />;
  }

  if (error || !data) {
    return (
      <View style={styles.messagePanel}>
        <Text style={styles.errorText}>Não foi possível carregar seu perfil.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Conta</Text>
        <Text accessibilityRole="header" style={styles.title}>Ajustes de perfil</Text>
        <Text style={styles.subtitle}>
          Personalize a forma como o MoneyHub funciona para você.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Nome completo</Text>
        <TextInput
          accessibilityLabel="Nome completo"
          autoCapitalize="words"
          onChangeText={setFullName}
          placeholder="Seu nome"
          style={styles.input}
          value={fullName}
        />

        <Text style={styles.label}>Moeda preferida</Text>
        <View style={styles.choiceRow}>
          {currencies.map((currency) => (
            <Pressable
              accessibilityLabel={currency}
              accessibilityRole="button"
              accessibilityState={{ selected: preferredCurrency === currency }}
              key={currency}
              onPress={() => setPreferredCurrency(currency)}
              style={[
                styles.choice,
                preferredCurrency === currency && styles.choiceSelected
              ]}
            >
              <Text style={preferredCurrency === currency ? styles.choiceTextSelected : styles.choiceText}>
                {currency}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Tema</Text>
        <View style={styles.choiceRow}>
          {themes.map((option) => (
            <Pressable
              accessibilityLabel={option.label}
              accessibilityRole="button"
              accessibilityState={{ selected: theme === option.value }}
              key={option.value}
              onPress={() => setTheme(option.value)}
              style={[styles.choice, theme === option.value && styles.choiceSelected]}
            >
              <Text style={theme === option.value ? styles.choiceTextSelected : styles.choiceText}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

        {verificationRequired ? (
          <View
            accessibilityLabel="Verificação de e-mail necessária"
            style={styles.verificationPanel}
          >
            <Text accessibilityRole="header" style={styles.verificationTitle}>
              Verifique seu e-mail para salvar alterações
            </Text>
            <Text style={styles.verificationDescription}>
              Confirme seu endereço de e-mail e tente salvar novamente.
            </Text>
            {verificationMessage ? (
              <Text style={styles.verificationMessage}>{verificationMessage}</Text>
            ) : null}
            <View style={styles.verificationActions}>
              <Pressable
                accessibilityLabel="Reenviar e-mail"
                accessibilityRole="button"
                disabled={actionsDisabled}
                onPress={handleResendVerification}
                style={[
                  styles.verificationButton,
                  actionsDisabled && styles.saveButtonDisabled
                ]}
              >
                <Text style={styles.verificationButtonText}>Reenviar e-mail</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Já verifiquei"
                accessibilityRole="button"
                disabled={actionsDisabled}
                onPress={handleRefreshVerification}
                style={[
                  styles.verificationButton,
                  styles.verificationButtonPrimary,
                  actionsDisabled && styles.saveButtonDisabled
                ]}
              >
                <Text style={styles.verificationButtonPrimaryText}>Já verifiquei</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Pressable
          accessibilityLabel="Salvar alterações"
          accessibilityRole="button"
          disabled={actionsDisabled}
          onPress={handleSave}
          style={[styles.saveButton, actionsDisabled && styles.saveButtonDisabled]}
        >
          {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveText}>Salvar alterações</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 20 },
  header: { gap: 8 },
  eyebrow: { color: '#0f766e', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  title: { color: '#0f172a', fontSize: 30, fontWeight: '700' },
  subtitle: { color: '#64748b', fontSize: 16, lineHeight: 24, maxWidth: 620 },
  card: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: 8, borderWidth: 1, gap: 10, maxWidth: 640, padding: 20 },
  label: { color: '#334155', fontSize: 14, fontWeight: '700', marginTop: 8 },
  input: { borderColor: '#94a3b8', borderRadius: 6, borderWidth: 1, color: '#0f172a', fontSize: 16, minHeight: 44, paddingHorizontal: 12 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { borderColor: '#cbd5e1', borderRadius: 6, borderWidth: 1, minHeight: 40, paddingHorizontal: 14, paddingVertical: 10 },
  choiceSelected: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  choiceText: { color: '#334155', fontSize: 14, fontWeight: '600' },
  choiceTextSelected: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  saveButton: { alignItems: 'center', backgroundColor: '#0f766e', borderRadius: 6, justifyContent: 'center', marginTop: 12, minHeight: 44, paddingHorizontal: 16 },
  saveButtonDisabled: { opacity: 0.6 },
  saveText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  errorText: { color: '#b91c1c', fontSize: 14, marginTop: 6 },
  successText: { color: '#047857', fontSize: 14, marginTop: 6 },
  messagePanel: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderRadius: 8, borderWidth: 1, padding: 16 },
  verificationPanel: { backgroundColor: '#f0fdfa', borderColor: '#99f6e4', borderRadius: 8, borderWidth: 1, gap: 8, marginTop: 6, padding: 16 },
  verificationTitle: { color: '#115e59', fontSize: 16, fontWeight: '700' },
  verificationDescription: { color: '#475569', fontSize: 14, lineHeight: 20 },
  verificationMessage: { color: '#334155', fontSize: 14, lineHeight: 20 },
  verificationActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  verificationButton: { alignItems: 'center', borderColor: '#0f766e', borderRadius: 6, borderWidth: 1, justifyContent: 'center', minHeight: 40, paddingHorizontal: 14 },
  verificationButtonPrimary: { backgroundColor: '#0f766e' },
  verificationButtonText: { color: '#0f766e', fontSize: 14, fontWeight: '700' },
  verificationButtonPrimaryText: { color: '#ffffff', fontSize: 14, fontWeight: '700' }
});
