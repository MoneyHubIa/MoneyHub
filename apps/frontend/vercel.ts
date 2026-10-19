import { routes, type VercelConfig } from '@vercel/config/v1';

function requiredBackendUrl(value: string | undefined): string {
  const backendUrl = value?.replace(/\/+$/, '');

  if (!backendUrl) {
    throw new Error('BACKEND_URL is required to configure Vercel API rewrites.');
  }

  return backendUrl;
}

const backendUrl = requiredBackendUrl(process.env.BACKEND_URL);

export const config: VercelConfig = {
  buildCommand: 'npm run build:web',
  outputDirectory: 'dist',
  cleanUrls: true,
  framework: null,
  rewrites: [
    routes.rewrite('/graphql', `${backendUrl}/graphql`),
    routes.rewrite(
      '/auth/password-recovery',
      `${backendUrl}/auth/password-recovery`
    ),
    routes.rewrite(
      '/auth/password-recovery/:path*',
      `${backendUrl}/auth/password-recovery/:path*`
    ),
    routes.rewrite('/:path*', '/')
  ]
};
