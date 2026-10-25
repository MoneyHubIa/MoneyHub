const urls = [
  'http://127.0.0.1:3000/health',
  'http://127.0.0.1:9099/emulator/v1/projects/demo-moneyhub/config'
];

try {
  const responses = await Promise.all(urls.map((url) => fetch(url, {
    signal: AbortSignal.timeout(3000)
  })));
  process.exitCode = responses.every((response) => response.ok) ? 0 : 1;
} catch {
  process.exitCode = 1;
}
