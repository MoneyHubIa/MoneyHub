import { Platform } from 'react-native';

export type StatementFile = { name: string; base64: string };
const MAX_BYTES = 2 * 1024 * 1024;

/** Read bytes, not decoded text, so the server can honor legacy bank encodings. */
export async function pickStatementFile(): Promise<StatementFile | null> {
  const picker = await import('expo-document-picker');
  const result = await picker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset || !/\.(ofx|csv)$/i.test(asset.name)) throw new Error('Selecione um arquivo OFX ou CSV.');
  if (asset.size != null && asset.size > MAX_BYTES) throw new Error('Arquivo maior que 2 MiB.');
  if (Platform.OS === 'web') {
    if (!asset.file) throw new Error('Não foi possível ler o arquivo selecionado.');
    const file = asset.file;
    if (file.size > MAX_BYTES) throw new Error('Arquivo maior que 2 MiB.');
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
      reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
      reader.readAsDataURL(file);
    });
    return { name: asset.name, base64 };
  }
  const { File } = await import('expo-file-system');
  const cached = new File(asset.uri);
  try {
    if (cached.size > MAX_BYTES) throw new Error('Arquivo maior que 2 MiB.');
    return { name: asset.name, base64: await cached.base64() };
  } finally {
    // The picker copied this file to the app cache; the original stays untouched.
    try { await cached.delete(); } catch { /* The operating system may already have evicted the cache copy. */ }
  }
}
