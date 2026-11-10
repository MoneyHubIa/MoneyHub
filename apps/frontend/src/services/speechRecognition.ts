import { Platform } from 'react-native';

export type SpeechRecognitionHandlers = {
  start: () => void;
  result: (transcript: string, isFinal: boolean) => void;
  error: (code: string) => void;
  end: () => void;
};

export type SpeechRecognitionEngine = {
  requestPermissions: () => Promise<{ granted: boolean; canAskAgain: boolean }>;
  subscribe: (handlers: SpeechRecognitionHandlers) => () => void;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export async function loadSpeechRecognition(): Promise<SpeechRecognitionEngine | null> {
  try {
    // Older native builds can still open the chat without this optional module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ExpoSpeechRecognitionModule: recognition } = require('expo-speech-recognition') as typeof import('expo-speech-recognition');
    if (!recognition.isRecognitionAvailable()) return null;

    let attachWebListeners: (() => void) | undefined;

    return {
      requestPermissions: () => Platform.OS === 'web'
        ? Promise.resolve({ granted: true, canAskAgain: true })
        : recognition.requestPermissionsAsync(),
      subscribe: (handlers) => {
        let subscriptions: { remove: () => void }[] = [];
        const attach = () => {
          subscriptions = [
            recognition.addListener('start', handlers.start),
            recognition.addListener('result', (event) => {
              handlers.result(event.results[0]?.transcript ?? '', event.isFinal);
            }),
            recognition.addListener('error', (event) => handlers.error(event.error)),
            recognition.addListener('nomatch', () => handlers.error('no-speech')),
            recognition.addListener('end', handlers.end)
          ];
        };
        // The web module creates a fresh browser recognizer in start(). Attach
        // afterward so a new session never subscribes to the previous instance.
        if (Platform.OS === 'web') attachWebListeners = attach;
        else attach();
        return () => {
          if (attachWebListeners === attach) attachWebListeners = undefined;
          subscriptions.forEach((subscription) => subscription.remove());
        };
      },
      start: () => {
        recognition.start({
          lang: 'pt-BR',
          interimResults: true,
          maxAlternatives: 1,
          continuous: false,
          recordingOptions: { persist: false }
        });
        attachWebListeners?.();
      },
      stop: () => recognition.stop(),
      abort: () => recognition.abort()
    };
  } catch {
    return null;
  }
}
