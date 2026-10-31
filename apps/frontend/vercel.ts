import { routes, type VercelConfig } from '@vercel/config/v1';

function requiredBackendUrl(value: string | undefined): string {
  try {
    if (!value || value !== value.trim() || !/^https?:\/\//i.test(value)) throw new Error();
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
        url.pathname !== '/' || value.includes('?') || value.includes('#')) throw new Error();
    return url.origin;
  } catch {
    throw new Error('BACKEND_URL must be an absolute HTTP(S) origin without credentials, path, query or fragment.');
  }
}

const backendUrl = requiredBackendUrl(process.env.BACKEND_URL);

export const config: VercelConfig = {
  git: {
    deploymentEnabled: false
  },
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
