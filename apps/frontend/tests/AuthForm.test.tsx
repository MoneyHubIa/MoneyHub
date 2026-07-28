import { fireEvent, render, screen } from '@testing-library/react-native';
import { AuthForm } from '../src/components/AuthForm';

describe('AuthForm', () => {
  test('submits email and password for login', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await render(<AuthForm mode="login" onSubmit={onSubmit} />);

    await fireEvent.changeText(screen.getByLabelText('Email'), 'person@example.com');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'firebase-only');
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));

    expect(onSubmit).toHaveBeenCalledWith('person@example.com', 'firebase-only');
  });

  test('blocks registration when password confirmation differs', async () => {
    const onSubmit = jest.fn();
    await render(<AuthForm mode="register" onSubmit={onSubmit} />);

    await fireEvent.changeText(screen.getByLabelText('Email'), 'person@example.com');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'firebase-only');
    await fireEvent.changeText(screen.getByLabelText('Confirmar senha'), 'different');
    await fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }));

    expect(screen.getByText('As senhas nao coincidem.')).toBeOnTheScreen();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('shows a friendly message when the registration email is already in use', async () => {
    const firebaseMessage =
      'Firebase: Error (auth/email-already-in-use).';
    const onSubmit = jest.fn().mockRejectedValue(
      Object.assign(new Error(firebaseMessage), {
        code: 'auth/email-already-in-use'
      })
    );
    await render(<AuthForm mode="register" onSubmit={onSubmit} />);

    await fireEvent.changeText(
      screen.getByLabelText('Email'),
      'person@example.com'
    );
    await fireEvent.changeText(
      screen.getByLabelText('Senha'),
      'firebase-only'
    );
    await fireEvent.changeText(
      screen.getByLabelText('Confirmar senha'),
      'firebase-only'
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Este e-mail já está em uso.'
    );
    expect(screen.queryByText(firebaseMessage)).not.toBeOnTheScreen();
  });
});
