import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react-native';
import {
  ForgotPasswordScreen,
  ResetPasswordScreen
} from '../src/components/PasswordRecoveryScreens';
import type { PasswordRecoveryClient } from '../src/services/passwordRecoveryClient';

function client(overrides: Partial<PasswordRecoveryClient> = {}): PasswordRecoveryClient {
  return {
    request: jest.fn().mockResolvedValue(undefined),
    verifyCode: jest.fn().mockResolvedValue(undefined),
    confirm: jest.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe('forgot password screen', () => {
  test('shows the same neutral confirmation after an accepted request', async () => {
    const recovery = client();
    await render(<ForgotPasswordScreen client={recovery} />);

    await fireEvent.changeText(
      screen.getByLabelText('E-mail'),
      'unknown@example.com'
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Enviar link de recuperação' })
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Se houver uma conta para este e-mail, enviaremos um link de recuperação.'
      );
    });
    expect(recovery.request).toHaveBeenCalledWith('unknown@example.com');
  });

  test('disables submission while the request is pending', async () => {
    let resolveRequest: (() => void) | undefined;
    const recovery = client({
      request: jest.fn(() => new Promise<void>((resolve) => {
        resolveRequest = resolve;
      }))
    });
    await render(<ForgotPasswordScreen client={recovery} />);

    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'person@example.com');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Enviar link de recuperação' })
    );

    expect(
      screen.getByRole('button', { name: 'Enviar link de recuperação' })
    ).toBeDisabled();
    await act(async () => {
      resolveRequest?.();
    });
  });
});

describe('reset password screen', () => {
  test('rejects missing or unrelated action parameters without calling backend verification', async () => {
    const recovery = client();
    await render(
      <ResetPasswordScreen
        client={recovery}
        logout={jest.fn()}
        mode="verifyEmail"
        oobCode=""
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Este link de recuperação é inválido, expirou ou já foi usado.'
    );
    expect(screen.getByText('Solicitar novo link')).toBeOnTheScreen();
    expect(recovery.verifyCode).not.toHaveBeenCalled();
  });

  test('clears a previously validated code when route parameters become invalid', async () => {
    const recovery = client();
    const view = await render(
      <ResetPasswordScreen
        client={recovery}
        logout={jest.fn()}
        mode="resetPassword"
        oobCode="valid-code"
      />
    );
    await screen.findByLabelText('Nova senha');

    await view.rerender(
      <ResetPasswordScreen
        client={recovery}
        logout={jest.fn()}
        mode="verifyEmail"
        oobCode="valid-code"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Solicitar novo link')).toBeOnTheScreen();
    });
    expect(screen.queryByLabelText('Nova senha')).not.toBeOnTheScreen();
  });

  test('clears password fields when navigating between valid action codes', async () => {
    let resolveSecondCode: (() => void) | undefined;
    const recovery = client({
      verifyCode: jest.fn((code: string) =>
        code === 'code-a'
          ? Promise.resolve(undefined)
          : new Promise<void>((resolve) => {
              resolveSecondCode = resolve;
            })
      )
    });
    const view = await render(
      <ResetPasswordScreen
        client={recovery}
        logout={jest.fn()}
        mode="resetPassword"
        oobCode="code-a"
      />
    );
    await screen.findByLabelText('Nova senha');
    await fireEvent.changeText(screen.getByLabelText('Nova senha'), 'secret-a');
    await fireEvent.changeText(
      screen.getByLabelText('Confirmar nova senha'),
      'secret-a'
    );

    await view.rerender(
      <ResetPasswordScreen
        client={recovery}
        logout={jest.fn()}
        mode="resetPassword"
        oobCode="code-b"
      />
    );
    await act(async () => {
      resolveSecondCode?.();
    });

    expect(screen.getByLabelText('Nova senha')).toHaveProp('value', '');
    expect(screen.getByLabelText('Confirmar nova senha')).toHaveProp('value', '');
  });

  test('clears completed state when navigating to another valid action code', async () => {
    const recovery = client();
    const logout = jest.fn().mockResolvedValue(undefined);
    const view = await render(
      <ResetPasswordScreen
        client={recovery}
        logout={logout}
        mode="resetPassword"
        oobCode="code-a"
      />
    );
    await screen.findByLabelText('Nova senha');
    await fireEvent.changeText(screen.getByLabelText('Nova senha'), 'strong-password');
    await fireEvent.changeText(
      screen.getByLabelText('Confirmar nova senha'),
      'strong-password'
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Redefinir senha' }));
    await screen.findByText('Senha redefinida com sucesso.');

    await view.rerender(
      <ResetPasswordScreen
        client={recovery}
        logout={logout}
        mode="resetPassword"
        oobCode="code-b"
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Nova senha')).toBeOnTheScreen();
    });
    expect(screen.queryByText('Senha redefinida com sucesso.')).not.toBeOnTheScreen();
  });

  test('ignores completion state from an earlier action code still in flight', async () => {
    let resolveConfirmation: (() => void) | undefined;
    const recovery = client({
      confirm: jest.fn(() => new Promise<void>((resolve) => {
        resolveConfirmation = resolve;
      }))
    });
    const logout = jest.fn().mockResolvedValue(undefined);
    const view = await render(
      <ResetPasswordScreen
        client={recovery}
        logout={logout}
        mode="resetPassword"
        oobCode="code-a"
      />
    );
    await screen.findByLabelText('Nova senha');
    await fireEvent.changeText(screen.getByLabelText('Nova senha'), 'strong-password');
    await fireEvent.changeText(
      screen.getByLabelText('Confirmar nova senha'),
      'strong-password'
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Redefinir senha' }));

    await view.rerender(
      <ResetPasswordScreen
        client={recovery}
        logout={logout}
        mode="resetPassword"
        oobCode="code-b"
      />
    );
    await screen.findByLabelText('Nova senha');
    await act(async () => {
      resolveConfirmation?.();
    });
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));

    expect(screen.getByLabelText('Nova senha')).toBeOnTheScreen();
    expect(screen.queryByText('Senha redefinida com sucesso.')).not.toBeOnTheScreen();
  });

  test('reveals the password form only after backend validates the code', async () => {
    let resolveVerification: (() => void) | undefined;
    const recovery = client({
      verifyCode: jest.fn(() => new Promise<void>((resolve) => {
        resolveVerification = resolve;
      }))
    });
    await render(
      <ResetPasswordScreen
        client={recovery}
        logout={jest.fn()}
        mode="resetPassword"
        oobCode="valid-code"
      />
    );

    expect(screen.queryByLabelText('Nova senha')).not.toBeOnTheScreen();
    await act(async () => {
      resolveVerification?.();
    });
    await waitFor(() => {
      expect(screen.getByLabelText('Nova senha')).toBeOnTheScreen();
    });
    expect(recovery.verifyCode).toHaveBeenCalledWith('valid-code');
  });

  test('offers a new request when backend verification rejects an invalid, expired, or used code', async () => {
    const recovery = client({
      verifyCode: jest.fn().mockRejectedValue(
        Object.assign(new Error('expired'), { code: 'auth/expired-action-code' })
      )
    });
    await render(
      <ResetPasswordScreen
        client={recovery}
        logout={jest.fn()}
        mode="resetPassword"
        oobCode="expired-code"
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Este link de recuperação é inválido, expirou ou já foi usado.'
      );
    });
    expect(screen.getByText('Solicitar novo link')).toBeOnTheScreen();
  });

  test('does not call backend confirmation when password confirmation differs', async () => {
    const recovery = client();
    await render(
      <ResetPasswordScreen
        client={recovery}
        logout={jest.fn()}
        mode="resetPassword"
        oobCode="valid-code"
      />
    );
    await screen.findByLabelText('Nova senha');

    await fireEvent.changeText(screen.getByLabelText('Nova senha'), 'new-password');
    await fireEvent.changeText(screen.getByLabelText('Confirmar nova senha'), 'different');
    await fireEvent.press(screen.getByRole('button', { name: 'Redefinir senha' }));

    expect(screen.getByRole('alert')).toHaveTextContent('As senhas não coincidem.');
    expect(recovery.confirm).not.toHaveBeenCalled();
  });

  test('requires both password fields before calling backend confirmation', async () => {
    const recovery = client();
    await render(
      <ResetPasswordScreen
        client={recovery}
        logout={jest.fn()}
        mode="resetPassword"
        oobCode="valid-code"
      />
    );
    await screen.findByLabelText('Nova senha');

    await fireEvent.press(screen.getByRole('button', { name: 'Redefinir senha' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Informe e confirme a nova senha.'
    );
    expect(recovery.confirm).not.toHaveBeenCalled();
  });

  test('uses the safe existing message when backend confirmation rejects a weak password', async () => {
    const recovery = client({
      confirm: jest.fn().mockRejectedValue(
        Object.assign(new Error('Firebase leaked policy'), {
          code: 'auth/weak-password'
        })
      )
    });
    await render(
      <ResetPasswordScreen
        client={recovery}
        logout={jest.fn()}
        mode="resetPassword"
        oobCode="valid-code"
      />
    );
    await screen.findByLabelText('Nova senha');

    await fireEvent.changeText(screen.getByLabelText('Nova senha'), 'weak');
    await fireEvent.changeText(screen.getByLabelText('Confirmar nova senha'), 'weak');
    await fireEvent.press(screen.getByRole('button', { name: 'Redefinir senha' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'A senha informada não atende aos requisitos de segurança.'
      );
    });
    expect(screen.queryByText('Firebase leaked policy')).not.toBeOnTheScreen();
  });

  test('offers a new request when the code expires during confirmation', async () => {
    const recovery = client({
      confirm: jest.fn().mockRejectedValue(
        Object.assign(new Error('expired'), { code: 'auth/expired-action-code' })
      )
    });
    await render(
      <ResetPasswordScreen
        client={recovery}
        logout={jest.fn()}
        mode="resetPassword"
        oobCode="valid-code"
      />
    );
    await screen.findByLabelText('Nova senha');

    await fireEvent.changeText(screen.getByLabelText('Nova senha'), 'strong-password');
    await fireEvent.changeText(
      screen.getByLabelText('Confirmar nova senha'),
      'strong-password'
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Redefinir senha' }));

    await waitFor(() => {
      expect(screen.getByText('Solicitar novo link')).toBeOnTheScreen();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Este link de recuperação é inválido, expirou ou já foi usado.'
    );
  });

  test('signs out after confirmation and offers a return to login', async () => {
    const recovery = client();
    const logout = jest.fn().mockResolvedValue(undefined);
    await render(
      <ResetPasswordScreen
        client={recovery}
        logout={logout}
        mode="resetPassword"
        oobCode="valid-code"
      />
    );
    await screen.findByLabelText('Nova senha');

    await fireEvent.changeText(screen.getByLabelText('Nova senha'), 'strong-password');
    await fireEvent.changeText(
      screen.getByLabelText('Confirmar nova senha'),
      'strong-password'
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Redefinir senha' }));

    await waitFor(() => {
      expect(screen.getByText('Senha redefinida com sucesso.')).toBeOnTheScreen();
    });
    expect(recovery.confirm).toHaveBeenCalledWith('valid-code', 'strong-password');
    expect(logout).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Ir para login')).toBeOnTheScreen();
  });
});
