import { resolveRuntimeUrl } from '../src/services/runtimeUrl';

describe('runtime service URLs', () => {
  test('maps localhost to the Android emulator host gateway', () => {
    expect(
      resolveRuntimeUrl('http://127.0.0.1:9099', 'android')
    ).toBe('http://10.0.2.2:9099/');
    expect(
      resolveRuntimeUrl('http://localhost:3000/graphql', 'android')
    ).toBe('http://10.0.2.2:3000/graphql');
  });

  test('preserves localhost on Web and explicit LAN hosts on native', () => {
    expect(resolveRuntimeUrl('http://localhost:3000/graphql', 'web'))
      .toBe('http://localhost:3000/graphql');
    expect(resolveRuntimeUrl('http://192.168.1.20:3000/graphql', 'android'))
      .toBe('http://192.168.1.20:3000/graphql');
  });
});
