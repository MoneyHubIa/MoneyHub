import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';

export function spawnPortable(command, args, options) {
  if (process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(command)) {
    return spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', command, ...args], {
      ...options,
      shell: false
    });
  }

  return spawn(command, args, { ...options, shell: false });
}

export async function waitForPort(port, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const connected = await new Promise((resolve) => {
      const socket = createConnection({ host: '127.0.0.1', port });
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('error', () => {
        socket.destroy();
        resolve(false);
      });
    });
    if (connected) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for port ${port}`);
}
