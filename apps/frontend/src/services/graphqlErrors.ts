import { CombinedGraphQLErrors } from '@apollo/client/errors';

export function hasGraphQLErrorCode(error: unknown, code: string): boolean {
  return CombinedGraphQLErrors.is(error) &&
    error.errors.some((item) => item.extensions?.code === code);
}
