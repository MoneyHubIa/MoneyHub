function requiredBackendUrl(value: string | undefined): string {
  const backendUrl = value?.replace(/\/+$/, '');

  if (!backendUrl) {
    throw new Error('BACKEND_URL is required to configure Vercel API rewrites.');
  }

  return backendUrl;
}

const backendUrl = requiredBackendUrl(process.env.BACKEND_URL);

export const config = {
  buildCommand: 'npm run build:web',
  outputDirectory: 'dist',
  cleanUrls: true,
  framework: null,
  rewrites: [
    { source: '/graphql', destination: `${backendUrl}/graphql` },
    {
      source: '/auth/password-recovery',
      destination: `${backendUrl}/auth/password-recovery`
    },
    {
      source: '/auth/password-recovery/:path*',
      destination: `${backendUrl}/auth/password-recovery/:path*`
    },
    { source: '/:path*', destination: '/' }
  ]
};
