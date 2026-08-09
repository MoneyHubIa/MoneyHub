import { render, screen } from '@testing-library/react-native';
import { AuthScreen } from '../src/components/AuthScreen';

describe('AuthScreen', () => {
  test('offers password recovery from login only', async () => {
    const { rerender } = await render(
      <AuthScreen mode="login" onSubmit={jest.fn()} />
    );

    expect(screen.getByText('Esqueci minha senha')).toBeOnTheScreen();

    await rerender(<AuthScreen mode="register" onSubmit={jest.fn()} />);

    expect(screen.queryByText('Esqueci minha senha')).not.toBeOnTheScreen();
  });
});
