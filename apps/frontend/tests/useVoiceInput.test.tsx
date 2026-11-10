import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { useVoiceInput } from '../src/hooks/useVoiceInput';
import { loadSpeechRecognition } from '../src/services/speechRecognition';
import { createSpeechRecognitionMock } from './helpers/speechRecognitionMock';

jest.mock('../src/services/speechRecognition', () => ({ loadSpeechRecognition: jest.fn() }));

const mockLoad = jest.mocked(loadSpeechRecognition);
let speech: ReturnType<typeof createSpeechRecognitionMock>;

async function setup(initialValue = '', enabled = true, blocked = false) {
  const hook = await renderHook(({ enabled, blocked }: { enabled: boolean; blocked: boolean }) => {
    const [value, onChange] = useState(initialValue);
    const voice = useVoiceInput({ value, onChange, enabled, blocked });
    return { ...voice, value };
  }, { initialProps: { enabled, blocked } });
  await waitFor(() => expect(hook.result.current.available).not.toBeNull());
  return hook;
}

beforeEach(() => {
  speech = createSpeechRecognitionMock();
  mockLoad.mockResolvedValue(speech.engine);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('checks availability without requesting microphone permission', async () => {
  const { result } = await setup();
  expect(result.current.available).toBe(true);
  expect(speech.engine.requestPermissions).not.toHaveBeenCalled();
});

test('replaces partial results, appends to draft and keeps final text after automatic end', async () => {
  const { result } = await setup('Analise');
  await act(async () => { await result.current.start(); });
  const handlers = speech.sessions[0]!;
  await act(async () => { handlers.result('meus', false); });
  expect(result.current.value).toBe('Analise meus');
  await act(async () => { handlers.result('meus gastos', false); });
  expect(result.current.value).toBe('Analise meus gastos');
  await act(async () => {
    handlers.result('meus gastos?', true);
    handlers.end();
  });
  expect(result.current.value).toBe('Analise meus gastos?');
  expect(result.current.status).toBe('idle');
  expect(speech.unsubscribe).toHaveBeenCalledTimes(1);
});

test('stops manually and waits for the final result before unlocking', async () => {
  const { result } = await setup();
  await act(async () => { await result.current.start(); });
  await act(async () => { result.current.stop(); });
  expect(result.current.status).toBe('stopping');
  expect(speech.engine.stop).toHaveBeenCalledTimes(1);
  await act(async () => {
    speech.sessions[0]!.result('Como economizar?', true);
    speech.sessions[0]!.end();
  });
  expect(result.current.value).toBe('Como economizar?');
  expect(result.current.isBusy).toBe(false);
});

test.each([true, false])('handles denied permission (canAskAgain=%s) and allows retry', async (canAskAgain) => {
  speech.engine.requestPermissions.mockResolvedValueOnce({ granted: false, canAskAgain });
  const { result } = await setup('Rascunho');
  await act(async () => { await result.current.start(); });
  expect(result.current.value).toBe('Rascunho');
  expect(result.current.isBusy).toBe(false);
  expect(result.current.message).toMatch(canAskAgain ? /Permita acesso/ : /configurações/);
  expect(speech.engine.start).not.toHaveBeenCalled();
  await act(async () => { await result.current.start(); });
  expect(result.current.status).toBe('listening');
  expect(result.current.message).toBeNull();
});

test.each(['network', 'no-speech', 'service-not-allowed', 'not-allowed', 'unknown'])('preserves draft after %s and ignores subsequent events', async (code) => {
  const { result } = await setup('Rascunho');
  await act(async () => { await result.current.start(); });
  const handlers = speech.sessions[0]!;
  await act(async () => {
    handlers.result('texto provisório', false);
    handlers.error(code);
    handlers.result('texto atrasado', true);
    handlers.end();
  });
  expect(result.current.value).toBe('Rascunho');
  expect(result.current.status).toBe('idle');
  expect(result.current.message).toBeTruthy();
  expect(speech.engine.abort).toHaveBeenCalledTimes(1);
});

test('keeps confirmed text on cancellation and isolates subsequent sessions', async () => {
  const { result } = await setup();
  await act(async () => { await result.current.start(); });
  const old = speech.sessions[0]!;
  await act(async () => {
    old.result('Texto confirmado', true);
    result.current.cancel();
  });
  await act(async () => { await result.current.start(); });
  await act(async () => {
    old.start();
    old.result('resultado atrasado', true);
    old.error('network');
    old.end();
    speech.sessions[1]!.result('continuação', true);
    speech.sessions[1]!.end();
  });
  expect(result.current.value).toBe('Texto confirmado continuação');
  expect(result.current.message).toBeNull();
});

test('ignores permission granted after the chat closes', async () => {
  let grant!: (value: { granted: boolean; canAskAgain: boolean }) => void;
  speech.engine.requestPermissions.mockReturnValue(new Promise((resolve) => { grant = resolve; }));
  const { result, rerender } = await setup('Rascunho');
  let starting!: Promise<void>;
  await act(async () => { starting = result.current.start(); });
  expect(result.current.status).toBe('preparing');
  await rerender({ enabled: false, blocked: false });
  await act(async () => {
    grant({ granted: true, canAskAgain: true });
    await starting;
  });
  expect(speech.engine.start).not.toHaveBeenCalled();
  expect(result.current.value).toBe('Rascunho');
});

test('cancels and removes listeners on unmount', async () => {
  const { result, unmount } = await setup();
  await act(async () => { await result.current.start(); });
  await unmount();
  expect(speech.engine.abort).toHaveBeenCalledTimes(1);
  expect(speech.unsubscribe).toHaveBeenCalledTimes(1);
});

test('cancels when app goes to background but permits iOS permission dialogs', async () => {
  let onStateChange!: (state: AppStateStatus) => void;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    onStateChange = listener;
    return { remove: jest.fn() };
  });
  let grant!: (value: { granted: boolean; canAskAgain: boolean }) => void;
  speech.engine.requestPermissions.mockReturnValue(new Promise((resolve) => { grant = resolve; }));
  const { result } = await setup('Rascunho');
  let starting!: Promise<void>;
  await act(async () => {
    starting = result.current.start();
    onStateChange('inactive');
  });
  expect(result.current.status).toBe('preparing');
  await act(async () => {
    grant({ granted: true, canAskAgain: true });
    await starting;
    onStateChange('background');
  });
  expect(result.current.status).toBe('idle');
  expect(speech.engine.abort).toHaveBeenCalledTimes(1);
});

test('limits voice text to 2000 characters and stops capture with feedback', async () => {
  const { result } = await setup('a'.repeat(1995));
  await act(async () => { await result.current.start(); });
  await act(async () => { speech.sessions[0]!.result('123456789', false); });
  expect(result.current.value).toBe('a'.repeat(1995) + ' 1234');
  expect(result.current.status).toBe('idle');
  expect(result.current.message).toMatch(/2000 caracteres/);
  expect(speech.engine.abort).toHaveBeenCalledTimes(1);
});

test('prevents starting at the character limit or while blocked', async () => {
  const full = await setup('a'.repeat(2000));
  await act(async () => { await full.result.current.start(); });
  expect(full.result.current.message).toMatch(/2000 caracteres/);
  expect(speech.engine.requestPermissions).not.toHaveBeenCalled();
  await full.unmount();
  const blocked = await setup('', true, true);
  await act(async () => { await blocked.result.current.start(); });
  expect(speech.engine.requestPermissions).not.toHaveBeenCalled();
});

test('reports no speech on automatic end without final text', async () => {
  const { result } = await setup('Rascunho');
  await act(async () => { await result.current.start(); });
  await act(async () => { speech.sessions[0]!.end(); });
  expect(result.current.value).toBe('Rascunho');
  expect(result.current.message).toMatch(/Nenhuma fala/);
});

test('unlocks and aborts if the service never finishes after stop', async () => {
  const { result } = await setup('Rascunho');
  jest.useFakeTimers();
  await act(async () => { await result.current.start(); });
  await act(async () => {
    speech.sessions[0]!.result('parcial', false);
    result.current.stop();
    jest.advanceTimersByTime(5000);
  });
  expect(result.current.value).toBe('Rascunho');
  expect(result.current.isBusy).toBe(false);
  expect(speech.engine.abort).toHaveBeenCalledTimes(1);
});

test('handles synchronous start failure without locking the composer', async () => {
  speech.engine.start.mockImplementation(() => { throw new Error('unavailable'); });
  const { result } = await setup('Rascunho');
  await act(async () => { await result.current.start(); });
  expect(result.current.value).toBe('Rascunho');
  expect(result.current.isBusy).toBe(false);
  expect(result.current.message).toMatch(/Não foi possível/);
});

test('unavailable recognition never requests permissions', async () => {
  mockLoad.mockResolvedValue(null);
  const { result } = await setup();
  await act(async () => { await result.current.start(); });
  expect(result.current.available).toBe(false);
  expect(speech.engine.requestPermissions).not.toHaveBeenCalled();
});


test('cancels when the web page becomes hidden and removes visibility listener', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  let onVisibility!: () => void;
  const documentMock = {
    hidden: false,
    addEventListener: jest.fn((_event: string, listener: () => void) => { onVisibility = listener; }),
    removeEventListener: jest.fn()
  };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: documentMock });
  try {
    const { result, unmount } = await setup('Rascunho');
    await act(async () => { await result.current.start(); });
    await act(async () => {
      speech.sessions[0]!.result('parcial', false);
      documentMock.hidden = true;
      onVisibility();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.value).toBe('Rascunho');
    expect(speech.engine.abort).toHaveBeenCalledTimes(1);
    await unmount();
    expect(documentMock.removeEventListener).toHaveBeenCalledWith('visibilitychange', onVisibility);
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('ignores repeated start while permission request is pending', async () => {
  let grant!: (value: { granted: boolean; canAskAgain: boolean }) => void;
  speech.engine.requestPermissions.mockReturnValue(new Promise((resolve) => { grant = resolve; }));
  const { result } = await setup();
  let starting!: Promise<void>;
  await act(async () => {
    starting = result.current.start();
    await result.current.start();
  });
  expect(speech.engine.requestPermissions).toHaveBeenCalledTimes(1);
  await act(async () => {
    grant({ granted: true, canAskAgain: true });
    await starting;
  });
  expect(speech.engine.start).toHaveBeenCalledTimes(1);
});
