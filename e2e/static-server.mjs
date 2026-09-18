import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, request as createRequest } from 'node:http';
import { fileURLToPath } from 'node:url';
import { extname, join, normalize, resolve } from 'node:path';

const [rootArgument, portArgument] = process.argv.slice(2);
const root = resolve(rootArgument ?? 'apps/frontend/dist');
const port = Number(portArgument ?? 3100);
const backendOrigin = 'http://127.0.0.1:3000';
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

export function createE2eWebServer(options = {}) {
  const configuredRoot = options.root ?? new URL('../apps/frontend/dist', import.meta.url);
  const staticRoot = resolve(
    configuredRoot instanceof URL ? fileURLToPath(configuredRoot) : configuredRoot
  );
  const graphqlOrigin = options.backendOrigin ?? backendOrigin;

  return createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  if (pathname === '/graphql') {
    const upstream = createRequest(new URL(request.url ?? '/graphql', graphqlOrigin), {
      method: request.method,
      headers: request.headers
    }, (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    });
    upstream.once('error', () => response.writeHead(502).end('Backend unavailable'));
    request.pipe(upstream);
    return;
  }

  const relativePath = normalize(pathname).replace(/^([/\\])+/, '');
  let target = join(staticRoot, relativePath);
  if (!target.startsWith(staticRoot)) {
    response.writeHead(400).end('Invalid path');
    return;
  }
  if (existsSync(target) && statSync(target).isDirectory()) target = join(target, 'index.html');
  if (!existsSync(target) || !statSync(target).isFile()) target = join(staticRoot, 'index.html');

  response.setHeader('Content-Type', contentTypes[extname(target)] ?? 'application/octet-stream');
  createReadStream(target).pipe(response);
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createE2eWebServer({ root }).listen(port, '127.0.0.1', () => {
    console.log(`E2E web server listening on http://127.0.0.1:${port}`);
  });
}
