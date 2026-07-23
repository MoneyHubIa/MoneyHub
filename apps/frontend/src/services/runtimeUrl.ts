export function resolveRuntimeUrl(url: string, platform: string) {
  if (platform !== 'android') return url;

  const parsed = new URL(url);
  if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    return url;
  }

  parsed.hostname = '10.0.2.2';
  return parsed.toString();
}
