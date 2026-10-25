import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
const manifest = readJson('package.json');
const lock = readJson('package-lock.json');

// npm version can leave workspace versions stale in package-lock.json.
for (const workspace of ['', ...manifest.workspaces]) {
  const workspaceManifest = workspace ? readJson(join(workspace, 'package.json')) : manifest;
  if (workspaceManifest.version !== manifest.version || !lock.packages[workspace]) {
    throw new Error(`A versão de ${workspace || 'raiz'} deve corresponder à versão ${manifest.version}.`);
  }
  lock.packages[workspace].version = manifest.version;
}
lock.version = manifest.version;
writeFileSync('package-lock.json', `${JSON.stringify(lock, null, 2)}\n`);
