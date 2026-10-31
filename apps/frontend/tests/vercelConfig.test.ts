describe('Vercel API rewrites', () => {
  const originalBackendUrl = process.env.BACKEND_URL;

  afterEach(() => {
    if (originalBackendUrl === undefined) delete process.env.BACKEND_URL;
    else process.env.BACKEND_URL = originalBackendUrl;
    jest.resetModules();
  });

  test.each([
    undefined,
    '',
    'money-hub-backend.vercel.app',
    '/backend',
    '//api.example.com',
    'ftp://api.example.com',
    'https://',
    'https://api.example.com/graphql',
    'https://api.example.com?token=value',
    'https://api.example.com#fragment',
    'https://user:password@api.example.com'
  ])('rejects invalid backend origin %s before building', backendUrl => {
    if (backendUrl === undefined) delete process.env.BACKEND_URL;
    else process.env.BACKEND_URL = backendUrl;

    expect(() => jest.requireActual('../vercel')).toThrow(/BACKEND_URL/);
  });

  test.each(['https://api.example.com/', 'http://localhost:3000'])(
    'routes API requests to absolute backend origin %s before the SPA fallback',
    backendUrl => {
      process.env.BACKEND_URL = backendUrl;
      const { config } = jest.requireActual<typeof import('../vercel')>('../vercel');
      const origin = new URL(backendUrl).origin;

      expect(config.rewrites).toEqual([
        { source: '/graphql', destination: `${origin}/graphql` },
        {
          source: '/auth/password-recovery',
          destination: `${origin}/auth/password-recovery`
        },
        {
          source: '/auth/password-recovery/:path*',
          destination: `${origin}/auth/password-recovery/:path*`
        },
        { source: '/:path*', destination: '/' }
      ]);
    }
  );
});
