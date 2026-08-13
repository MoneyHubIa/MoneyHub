const FALLBACK_AUTH_ERROR_MESSAGE =
  'Não foi possível autenticar. Tente novamente.';

const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  'auth/email-already-in-use': 'Este e-mail já está em uso.',
  'auth/invalid-email': 'Informe um e-mail válido.',
  'auth/missing-password': 'Informe sua senha.',
  'auth/weak-password':
    'A senha informada não atende aos requisitos de segurança.',
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/user-disabled': 'Esta conta foi desativada.',
  'auth/too-many-requests':
    'Muitas tentativas. Aguarde um momento e tente novamente.',
  'auth/network-request-failed':
    'Não foi possível conectar. Verifique sua internet e tente novamente.',
  'auth/timeout':
    'Não foi possível conectar. Verifique sua internet e tente novamente.',
  'auth/recovery-unavailable':
    'A recuperação de senha está temporariamente indisponível. Tente novamente.',
  'auth/operation-not-allowed':
    'Este método de acesso não está disponível no momento.'
};

function getErrorCode(error: unknown) {
  try {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const code = error.code;
      return typeof code === 'string' ? code : null;
    }
  } catch {
    return null;
  }

  return null;
}

export function authErrorMessage(error: unknown) {
  const code = getErrorCode(error);
  if (
    !code ||
    !Object.prototype.hasOwnProperty.call(AUTH_ERROR_MESSAGES, code)
  ) {
    return FALLBACK_AUTH_ERROR_MESSAGE;
  }

  return AUTH_ERROR_MESSAGES[code] ?? FALLBACK_AUTH_ERROR_MESSAGE;
}
