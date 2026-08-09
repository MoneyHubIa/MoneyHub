import {
  createPasswordRecoveryClient,
  resolvePasswordRecoveryEndpoint
} from '../src/services/passwordRecoveryClient';

describe('PasswordRecoveryClient', () => {
  test('requests backend recovery through the platform endpoint', async () => {
    const fetchRequest = jest.fn().mockResolvedValue({ ok: true });
    const client = createPasswordRecoveryClient({
      endpoint: 'https://moneyhub.example/auth/password-recovery',
      fetchRequest,
      verifyPasswordResetCode: jest.fn(),
      confirmPasswordReset: jest.fn()
    });

    await expect(client.request('person@example.com')).resolves.toBeUndefined();
    expect(fetchRequest).toHaveBeenCalledWith(
      'https://moneyhub.example/auth/password-recovery',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'person@example.com' })
      }
    );
  });

  test('rejects a backend refusal without exposing its response body', async () => {
    const client = createPasswordRecoveryClient({
      endpoint: '/auth/password-recovery',
      fetchRequest: jest.fn().mockResolvedValue({ ok: false }),
      verifyPasswordResetCode: jest.fn(),
      confirmPasswordReset: jest.fn()
    });

    await expect(client.request('invalid')).rejects.toThrow(
      'Password recovery request was not accepted.'
    );
  });

  test('verifies and confirms action codes through Firebase', async () => {
    const verifyPasswordResetCode = jest
      .fn()
      .mockResolvedValue('person@example.com');
    const confirmPasswordReset = jest.fn().mockResolvedValue(undefined);
    const client = createPasswordRecoveryClient({
      endpoint: '/auth/password-recovery',
      fetchRequest: jest.fn(),
      verifyPasswordResetCode,
      confirmPasswordReset
    });

    await expect(client.verifyCode('valid-code')).resolves.toBe(
      'person@example.com'
    );
    await expect(client.confirm('valid-code', 'new-password')).resolves.toBeUndefined();
    expect(verifyPasswordResetCode).toHaveBeenCalledWith('valid-code');
    expect(confirmPasswordReset).toHaveBeenCalledWith(
      'valid-code',
      'new-password'
    );
  });

  test('uses same-origin on production web and APP_URL elsewhere', () => {
    expect(
      resolvePasswordRecoveryEndpoint(
        'https://moneyhub.example/base',
        'web',
        false
      )
    ).toBe('/auth/password-recovery');
    expect(
      resolvePasswordRecoveryEndpoint(
        'http://localhost:3000',
        'android',
        true
      )
    ).toBe('http://10.0.2.2:3000/auth/password-recovery');
  });
});
