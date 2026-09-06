import { authErrorMessage } from '../src/services/authErrorMessage';

describe('authErrorMessage', () => {
  test.each([
    ['auth/email-already-in-use', 'Este e-mail já está em uso.'],
    ['auth/invalid-email', 'Informe um e-mail válido.'],
    ['auth/missing-password', 'Informe sua senha.'],
    [
      'auth/weak-password',
      'A senha informada não atende aos requisitos de segurança.'
    ],
    ['auth/invalid-credential', 'E-mail ou senha incorretos.'],
    ['auth/wrong-password', 'E-mail ou senha incorretos.'],
    ['auth/user-not-found', 'E-mail ou senha incorretos.'],
    ['auth/user-disabled', 'Esta conta foi desativada.'],
    [
      'auth/too-many-requests',
      'Muitas tentativas. Aguarde um momento e tente novamente.'
    ],
    [
      'auth/network-request-failed',
      'Não foi possível conectar. Verifique sua internet e tente novamente.'
    ],
    [
      'auth/backend-unavailable',
      'Serviço temporariamente indisponível. Tente novamente em instantes.'
    ],
    [
      'auth/timeout',
      'Não foi possível conectar. Verifique sua internet e tente novamente.'
    ],
    [
      'auth/recovery-unavailable',
      'A recuperação de senha está temporariamente indisponível. Tente novamente.'
    ],
    [
      'auth/operation-not-allowed',
      'Este método de acesso não está disponível no momento.'
    ]
  ])('translates %s into a safe message', (code, expectedMessage) => {
    expect(authErrorMessage({ code })).toBe(expectedMessage);
  });

  test.each([
    null,
    'unexpected failure',
    { code: 500 },
    { code: 'auth/internal-error' },
    { code: 'constructor' },
    { code: 'toString' },
    { code: '__proto__' },
    new Error('sensitive implementation detail')
  ])('uses a safe fallback for an unmapped error', (error) => {
    expect(authErrorMessage(error)).toBe(
      'Não foi possível autenticar. Tente novamente.'
    );
  });

  test('uses the safe fallback when reading the error code throws', () => {
    const error = Object.defineProperty({}, 'code', {
      get() {
        throw new Error('sensitive getter failure');
      }
    });

    expect(authErrorMessage(error)).toBe(
      'Não foi possível autenticar. Tente novamente.'
    );
  });
});
