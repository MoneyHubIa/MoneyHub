import 'dotenv/config';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { createApp } from './app.js';
import { loadRootEnvironment, loadRuntimeConfig } from './runtime-config.js';

loadRootEnvironment();
const { appUrl } = loadRuntimeConfig();
const port = Number(process.env.PORT || 3000);
const app = await createApp({
  appUrl,
  frontendDistDir: resolve(process.cwd(), '../frontend/dist')
});
const server = createServer(app);

server.listen(port, () => {
  console.log(`MoneyHub backend listening on port ${port}`);
});

async function shutdown(): Promise<void> {
  server.close(async () => {
    await app.locals.stop?.();
    process.exit(0);
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
