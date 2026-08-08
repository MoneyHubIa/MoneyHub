import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { ProfileSettings } from '../src/components/ProfileSettings';

const mockSaveProfile = jest.fn();
const mockResendEmailVerification = jest.fn();
const mockRefreshEmailVerification = jest.fn();

jest.mock('../src/providers/AuthProvider', () => ({
  useAuth: () => ({
    resendEmailVerification: mockResendEmailVerification,
    refreshEmailVerification: mockRefreshEmailVerification
  })
}));

jest.mock('@apollo/client/react', () => ({
  useMutation: () => [mockSaveProfile, { loading: false }],
  useQuery: () => ({
    data: {
      myProfile: {
        id: 'profile-1',
        fullName: 'Ana Souza',
        preferredCurrency: 'BRL',
        theme: 'SYSTEM'
      }
    },
    error: undefined,
    loading: false
  })
}));

const emailNotVerifiedError = () => new CombinedGraphQLErrors({
  errors: [{
    message: 'Verify email', extensions: { code: 'EMAIL_NOT_VERIFIED' }
  }]
});

async function submitEditedProfile(fullName = 'Ana Silva') {
  await fireEvent.changeText(screen.getByLabelText('Nome completo'), fullName);
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar alterações' }));
}

describe('ProfileSettings', () => {
  beforeEach(() => {
    mockSaveProfile.mockReset();
    mockResendEmailVerification.mockReset();
    mockRefreshEmailVerification.mockReset();
    mockSaveProfile.mockResolvedValue({
      data: {
        updateMyProfile: {
          id: 'profile-1',
          fullName: 'Ana Silva',
          preferredCurrency: 'USD',
          theme: 'DARK'
        }
      }
    });
    mockResendEmailVerification.mockResolvedValue(undefined);
    mockRefreshEmailVerification.mockResolvedValue(false);
  });

  test('loads the persisted profile and saves the supported settings', async () => {
    await render(<ProfileSettings />);

    expect(screen.getByDisplayValue('Ana Souza')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Nome completo'), 'Ana Silva');
    await fireEvent.press(screen.getByRole('button', { name: 'USD' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Escuro' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(mockSaveProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          input: { fullName: 'Ana Silva', preferredCurrency: 'USD', theme: 'DARK' }
        }
      })
    );
  });

  test('offers email verification recovery only for a rejected unverified save', async () => {
    mockSaveProfile.mockRejectedValueOnce(emailNotVerifiedError());
    await render(<ProfileSettings />);

    await submitEditedProfile();

    expect(await screen.findByText('Verifique seu e-mail para salvar alterações')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Reenviar e-mail' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Já verifiquei' })).toBeOnTheScreen();
    expect(screen.queryByText('Não foi possível salvar as alterações. Tente novamente.')).not.toBeOnTheScreen();
  });

  test('resends the verification email and confirms delivery', async () => {
    mockSaveProfile.mockRejectedValueOnce(emailNotVerifiedError());
    await render(<ProfileSettings />);
    await submitEditedProfile();

    await fireEvent.press(await screen.findByRole('button', { name: 'Reenviar e-mail' }));

    expect(mockResendEmailVerification).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(
      'Enviamos um novo e-mail de verificação. Confira também a caixa de spam.'
    )).toBeOnTheScreen();
  });

  test('reports a verification email resend failure', async () => {
    mockSaveProfile.mockRejectedValueOnce(emailNotVerifiedError());
    mockResendEmailVerification.mockRejectedValueOnce(new Error('resend failed'));
    await render(<ProfileSettings />);
    await submitEditedProfile();

    await fireEvent.press(await screen.findByRole('button', { name: 'Reenviar e-mail' }));

    expect(await screen.findByText(
      'Não foi possível reenviar o e-mail de verificação. Tente novamente.'
    )).toBeOnTheScreen();
  });

  test('preserves edits and does not retry when verification is not detected', async () => {
    mockSaveProfile.mockRejectedValueOnce(emailNotVerifiedError());
    mockRefreshEmailVerification.mockResolvedValueOnce(false);
    await render(<ProfileSettings />);
    await submitEditedProfile('Ana Editada');

    await fireEvent.press(await screen.findByRole('button', { name: 'Já verifiquei' }));

    expect(await screen.findByText('A verificação ainda não foi detectada.')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('Ana Editada')).toBeOnTheScreen();
    expect(mockSaveProfile).toHaveBeenCalledTimes(1);
  });

  test('retries once with the rejected variables despite later form edits', async () => {
    mockSaveProfile
      .mockRejectedValueOnce(emailNotVerifiedError())
      .mockResolvedValueOnce({ data: { updateMyProfile: {} } });
    mockRefreshEmailVerification.mockResolvedValueOnce(true);
    await render(<ProfileSettings />);

    await fireEvent.changeText(screen.getByLabelText('Nome completo'), '  Ana Silva  ');
    await fireEvent.press(screen.getByRole('button', { name: 'USD' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Escuro' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar alterações' }));

    await screen.findByText('Verifique seu e-mail para salvar alterações');
    await fireEvent.changeText(screen.getByLabelText('Nome completo'), '');
    await fireEvent.press(screen.getByRole('button', { name: 'EUR' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Claro' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Já verifiquei' }));

    const expectedMutation = {
      variables: {
        input: { fullName: 'Ana Silva', preferredCurrency: 'USD', theme: 'DARK' }
      }
    };
    expect(mockSaveProfile).toHaveBeenCalledTimes(2);
    expect(mockSaveProfile).toHaveBeenNthCalledWith(1, expectedMutation);
    expect(mockSaveProfile).toHaveBeenNthCalledWith(2, expectedMutation);
    expect(await screen.findByText('Alterações salvas com sucesso.')).toBeOnTheScreen();
  });

  test('keeps recovery open and retries at most once when the retry is still rejected', async () => {
    mockSaveProfile.mockRejectedValue(emailNotVerifiedError());
    mockRefreshEmailVerification.mockResolvedValueOnce(true);
    await render(<ProfileSettings />);
    await submitEditedProfile('Ana Editada');

    await fireEvent.press(await screen.findByRole('button', { name: 'Já verifiquei' }));

    expect(await screen.findByText('A verificação ainda não foi detectada.')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('Ana Editada')).toBeOnTheScreen();
    expect(mockSaveProfile).toHaveBeenCalledTimes(2);
  });

  test('reports a verification refresh failure without retrying the save', async () => {
    mockSaveProfile.mockRejectedValueOnce(emailNotVerifiedError());
    mockRefreshEmailVerification.mockRejectedValueOnce(new Error('refresh failed'));
    await render(<ProfileSettings />);
    await submitEditedProfile();

    await fireEvent.press(await screen.findByRole('button', { name: 'Já verifiquei' }));

    expect(await screen.findByText(
      'Não foi possível atualizar o status da verificação. Tente novamente.'
    )).toBeOnTheScreen();
    expect(mockSaveProfile).toHaveBeenCalledTimes(1);
  });

  test('keeps generic save handling and hides recovery for unrelated failures', async () => {
    mockSaveProfile.mockRejectedValueOnce(new Error('network failed'));
    await render(<ProfileSettings />);

    await submitEditedProfile();

    expect(await screen.findByText(
      'Não foi possível salvar as alterações. Tente novamente.'
    )).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Reenviar e-mail' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Já verifiquei' })).not.toBeOnTheScreen();
  });

  test.each([
    ['resend', mockResendEmailVerification, 'Reenviar e-mail'],
    ['refresh', mockRefreshEmailVerification, 'Já verifiquei']
  ])('disables every save and recovery action during %s', async (_, operation, actionName) => {
    mockSaveProfile.mockRejectedValueOnce(emailNotVerifiedError());
    let finishOperation: ((value?: unknown) => void) | undefined;
    operation.mockReturnValueOnce(new Promise((resolve) => {
      finishOperation = resolve;
    }));
    await render(<ProfileSettings />);
    await submitEditedProfile();

    const pressPromise = fireEvent.press(
      await screen.findByRole('button', { name: actionName })
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Reenviar e-mail' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Já verifiquei' })).toBeDisabled();
    });

    await act(async () => {
      finishOperation?.(actionName === 'Já verifiquei' ? false : undefined);
      await pressPromise;
    });
  });
});
