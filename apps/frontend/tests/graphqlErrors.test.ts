import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { hasGraphQLErrorCode } from '../src/services/graphqlErrors';

test('recognizes a requested extension code', () => {
  const error = new CombinedGraphQLErrors({
    errors: [{ message: 'Verify email', extensions: { code: 'EMAIL_NOT_VERIFIED' } }]
  });
  expect(hasGraphQLErrorCode(error, 'EMAIL_NOT_VERIFIED')).toBe(true);
});

test.each([
  new Error('network failed'),
  new CombinedGraphQLErrors({
    errors: [{ message: 'Invalid', extensions: { code: 'BAD_USER_INPUT' } }]
  }),
  null
])('rejects unrelated error %#', (error) => {
  expect(hasGraphQLErrorCode(error, 'EMAIL_NOT_VERIFIED')).toBe(false);
});
