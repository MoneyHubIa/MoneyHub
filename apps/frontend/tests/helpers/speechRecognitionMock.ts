import type { SpeechRecognitionEngine, SpeechRecognitionHandlers } from '../../src/services/speechRecognition';

export function createSpeechRecognitionMock() {
  const sessions: SpeechRecognitionHandlers[] = [];
  const unsubscribe = jest.fn();
  const engine = {
    requestPermissions: jest.fn(async () => ({ granted: true, canAskAgain: true })),
    subscribe: jest.fn((handlers: SpeechRecognitionHandlers) => {
      sessions.push(handlers);
      return unsubscribe;
    }),
    start: jest.fn(() => sessions.at(-1)?.start()),
    stop: jest.fn(),
    abort: jest.fn()
  } satisfies SpeechRecognitionEngine;
  return { engine, sessions, unsubscribe };
}
