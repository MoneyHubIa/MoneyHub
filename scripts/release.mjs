import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const require = createRequire(import.meta.url);
const releaseIt = resolve(dirname(require.resolve('release-it/package.json')), 'bin/release-it.js');
const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function runRelease(args, { environment = process.env, run = spawnSync, cwd = process.cwd() } = {}) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      'dry-run': { type: 'boolean' },
      ci: { type: 'boolean' },
      help: { type: 'boolean' }
    }
  });
  if (positionals.length > 1 || (positionals[0]
    && !['patch', 'minor', 'major'].includes(positionals[0]) && !stableVersion.test(positionals[0]))) {
    throw new Error('Informe patch, minor, major ou uma versão estável, como 1.2.3.');
  }

  const configFile = resolve(cwd, '.release-it.json');
  if (!values.help && !existsSync(configFile)) {
    throw new Error('Execute o comando na raiz do MoneyHub, onde está .release-it.json.');
  }
  const releaseArgs = [...positionals, '--config', configFile];
  const releaseEnvironment = { ...environment };
  if (values.ci) releaseArgs.push('--ci');

  if (values.help) {
    releaseArgs.push('--help');
  } else if (values['dry-run']) {
    releaseArgs.push('--dry-run', '--no-github');
    delete releaseEnvironment.GITHUB_TOKEN;
    delete releaseEnvironment.GH_TOKEN;
  } else {
    let token = environment.GITHUB_TOKEN?.trim() || environment.GH_TOKEN?.trim();
    if (!token) {
      const authentication = run('gh', ['auth', 'token', '--hostname', 'github.com'], {
        cwd, encoding: 'utf8', windowsHide: true, env: environment
      });
      if (!authentication.error && authentication.status === 0) token = authentication.stdout?.trim();
    }
    if (!token) {
      throw new Error('Autentique o GitHub CLI com gh auth login ou defina GITHUB_TOKEN antes de publicar.');
    }
    releaseEnvironment.GITHUB_TOKEN = token;
  }

  const result = run(process.execPath, [releaseIt, ...releaseArgs], {
    cwd, env: releaseEnvironment, stdio: 'inherit', windowsHide: true
  });
  if (result.error) throw new Error('Não foi possível executar release-it. Execute npm ci e tente novamente.');
  return result.status ?? 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = runRelease(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
