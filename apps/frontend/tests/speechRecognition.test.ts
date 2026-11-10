import { Platform } from 'react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { loadSpeechRecognition, type SpeechRecognitionHandlers } from '../src/services/speechRecognition';

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    isRecognitionAvailable: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    addListener: jest.fn(),
    start: jest.fn(), stop: jest.fn(), abort: jest.fn()
  }
}));

const recognition = jest.mocked(ExpoSpeechRecognitionModule);

beforeEach(() => {
  jest.resetAllMocks();
  recognition.isRecognitionAvailable.mockReturnValue(true);
  recognition.requestPermissionsAsync.mockResolvedValue({
    granted: true, canAskAgain: true, status: 'granted', expires: 'never'
  } as Awaited<ReturnType<typeof recognition.requestPermissionsAsync>>);
});

afterEach(() => jest.restoreAllMocks());

test('returns null when support or the native module is unavailable', async () => {
  recognition.isRecognitionAvailable.mockReturnValueOnce(false);
  await expect(loadSpeechRecognition()).resolves.toBeNull();
  recognition.isRecognitionAvailable.mockImplementationOnce(() => { throw new Error('Missing native module'); });
  await expect(loadSpeechRecognition()).resolves.toBeNull();
});

test('requests native permissions and starts pt-BR without persisting audio', async () => {
  const engine = (await loadSpeechRecognition())!;
  await engine.requestPermissions();
  expect(recognition.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  engine.start(); engine.stop(); engine.abort();
  expect(recognition.start).toHaveBeenCalledWith({
    lang: 'pt-BR', interimResults: true, maxAlternatives: 1,
    continuous: false, recordingOptions: { persist: false }
  });
  expect(recognition.stop).toHaveBeenCalledTimes(1);
  expect(recognition.abort).toHaveBeenCalledTimes(1);
});

test('web lets the browser request permission on start', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const engine = (await loadSpeechRecognition())!;
  await expect(engine.requestPermissions()).resolves.toEqual({ granted: true, canAskAgain: true });
  expect(recognition.requestPermissionsAsync).not.toHaveBeenCalled();
});

test('forwards results and errors and removes every subscription', async () => {
  const remove = jest.fn();
  const listeners: Record<string, (event: never) => void> = {};
  recognition.addListener.mockImplementation((event, listener) => {
    listeners[event] = listener as (event: never) => void;
    return { remove };
  });
  const handlers: SpeechRecognitionHandlers = {
    start: jest.fn(), result: jest.fn(), error: jest.fn(), end: jest.fn()
  };
  const engine = (await loadSpeechRecognition())!;
  const unsubscribe = engine.subscribe(handlers);
  listeners.start!(null as never);
  listeners.result!({ results: [{ transcript: 'meus gastos' }], isFinal: true } as never);
  listeners.error!({ error: 'network' } as never);
  listeners.nomatch!(null as never);
  listeners.end!(null as never);
  expect(handlers.start).toHaveBeenCalled();
  expect(handlers.result).toHaveBeenCalledWith('meus gastos', true);
  expect(handlers.error).toHaveBeenCalledWith('network');
  expect(handlers.error).toHaveBeenCalledWith('no-speech');
  expect(handlers.end).toHaveBeenCalled();
  unsubscribe();
  expect(remove).toHaveBeenCalledTimes(5);
});


test('web attaches new listeners only to the fresh recognizer, after start', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  let browserSession = 0;
  const listeners: Record<number, Record<string, (event: never) => void>> = {};
  recognition.start.mockImplementation(() => { browserSession += 1; });
  recognition.addListener.mockImplementation((event, listener) => {
    listeners[browserSession] ??= {};
    listeners[browserSession]![event] = listener as (event: never) => void;
    return { remove: jest.fn() };
  });
  const engine = (await loadSpeechRecognition())!;
  const first = { start: jest.fn(), result: jest.fn(), error: jest.fn(), end: jest.fn() };
  const detachFirst = engine.subscribe(first);
  engine.start();
  detachFirst();
  const second = { start: jest.fn(), result: jest.fn(), error: jest.fn(), end: jest.fn() };
  const detachSecond = engine.subscribe(second);
  engine.start();
  listeners[1]!.end!(null as never);
  expect(second.end).not.toHaveBeenCalled();
  listeners[2]!.result!({ results: [{ transcript: 'nova sessão' }], isFinal: true } as never);
  expect(second.result).toHaveBeenCalledWith('nova sessão', true);
  detachSecond();
});
