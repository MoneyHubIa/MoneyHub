import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { loadSpeechRecognition, type SpeechRecognitionEngine } from '../services/speechRecognition';

export const ASSISTANT_MESSAGE_MAX_LENGTH = 2000;
export const VOICE_UNAVAILABLE_MESSAGE = 'Entrada por voz indisponível neste dispositivo ou navegador. Você pode digitar sua mensagem.';
const NO_SPEECH_MESSAGE = 'Nenhuma fala reconhecida. Tente novamente ou digite sua mensagem.';
const LIMIT_MESSAGE = 'Limite de 2000 caracteres atingido. Revise a mensagem antes de enviar.';

type VoiceStatus = 'idle' | 'preparing' | 'listening' | 'stopping';
type Session = {
  base: string;
  confirmed: string;
  hasFinal: boolean;
  started: boolean;
  unsubscribe?: () => void;
  timer?: ReturnType<typeof setTimeout>;
};

function errorMessage(code: string): string {
  switch (code) {
    case 'not-allowed':
      return 'Permissão de microfone ou reconhecimento de fala negada. Verifique as permissões nas configurações do dispositivo ou navegador.';
    case 'no-speech':
    case 'speech-timeout':
      return NO_SPEECH_MESSAGE;
    case 'network':
      return 'Falha de conexão no reconhecimento de fala. Verifique sua internet e tente novamente.';
    case 'service-not-allowed':
    case 'language-not-supported':
      return 'Reconhecimento de fala indisponível para português brasileiro. Tente novamente ou digite sua mensagem.';
    default:
      return 'Não foi possível reconhecer sua fala. Tente novamente ou digite sua mensagem.';
  }
}

export function useVoiceInput({
  value,
  onChange,
  enabled,
  blocked
}: {
  value: string;
  onChange: (value: string) => void;
  enabled: boolean;
  blocked: boolean;
}) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const engine = useRef<SpeechRecognitionEngine | null>(null);
  const session = useRef<Session | null>(null);
  const mounted = useRef(false);
  const latest = useRef({ value, onChange, enabled, blocked });
  latest.current = { value, onChange, enabled, blocked };

  const finish = useCallback((current: Session, feedback?: string) => {
    if (session.current !== current) return;
    session.current = null;
    clearTimeout(current.timer);
    current.unsubscribe?.();
    if (mounted.current) {
      latest.current.onChange(current.confirmed);
      setStatus('idle');
      if (feedback) setMessage(feedback);
    }
  }, []);

  const cancel = useCallback(() => {
    const current = session.current;
    if (!current) return;
    finish(current);
    if (current.started) {
      try { engine.current?.abort(); } catch { /* Capture may already have ended. */ }
    }
  }, [finish]);

  useEffect(() => {
    mounted.current = true;
    let disposed = false;
    void loadSpeechRecognition().then((recognition) => {
      if (disposed) return;
      engine.current = recognition;
      setAvailable(recognition !== null);
    });
    return () => {
      disposed = true;
      mounted.current = false;
      cancel();
      engine.current = null;
    };
  }, [cancel]);

  useEffect(() => {
    if (!enabled || blocked) cancel();
  }, [enabled, blocked, cancel]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      // iOS permission dialogs temporarily make the app inactive.
      if (state === 'background' || (state === 'inactive' && session.current?.started)) cancel();
    });
    const handleVisibility = () => {
      if (document.hidden) cancel();
    };
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }
    return () => {
      subscription.remove();
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [cancel]);

  const stop = useCallback(() => {
    const current = session.current;
    if (!current?.started) return;
    setStatus('stopping');
    clearTimeout(current.timer);
    // A broken service must not leave the composer locked indefinitely.
    current.timer = setTimeout(() => {
      finish(current, current.hasFinal ? undefined : NO_SPEECH_MESSAGE);
      try { engine.current?.abort(); } catch { /* Capture may already have ended. */ }
    }, 5000);
    try {
      engine.current?.stop();
    } catch {
      cancel();
      setMessage(errorMessage('unknown'));
    }
  }, [cancel, finish]);

  const start = useCallback(async () => {
    const recognition = engine.current;
    const options = latest.current;
    if (!mounted.current || !options.enabled || options.blocked || session.current || !recognition) return;
    if (options.value.length >= ASSISTANT_MESSAGE_MAX_LENGTH) {
      setMessage(LIMIT_MESSAGE);
      return;
    }

    const current: Session = {
      base: options.value,
      confirmed: options.value,
      hasFinal: false,
      started: false
    };
    session.current = current;
    setMessage(null);
    setStatus('preparing');

    try {
      const permission = await recognition.requestPermissions();
      if (session.current !== current || !mounted.current) return;
      if (!permission.granted) {
        finish(current, permission.canAskAgain
          ? 'Permita acesso ao microfone e ao reconhecimento de fala para usar entrada por voz.'
          : errorMessage('not-allowed'));
        return;
      }

      current.unsubscribe = recognition.subscribe({
        start: () => {
          if (session.current !== current) return;
          clearTimeout(current.timer);
          setStatus('listening');
        },
        result: (transcript, isFinal) => {
          if (session.current !== current || !transcript.trim()) return;
          const separator = current.base && !/\s$/.test(current.base) ? ' ' : '';
          const combined = `${current.base}${separator}${transcript.trim()}`;
          const limited = combined.slice(0, ASSISTANT_MESSAGE_MAX_LENGTH);
          latest.current.onChange(limited);
          if (isFinal) {
            current.confirmed = limited;
            current.hasFinal = true;
          }
          if (combined.length >= ASSISTANT_MESSAGE_MAX_LENGTH) {
            current.confirmed = limited;
            finish(current, LIMIT_MESSAGE);
            try { recognition.abort(); } catch { /* Capture may already have ended. */ }
          }
        },
        error: (code) => {
          if (session.current !== current) return;
          finish(current, code === 'aborted' ? undefined : errorMessage(code));
          try { recognition.abort(); } catch { /* The service may already be inactive. */ }
        },
        end: () => finish(current, current.hasFinal ? undefined : NO_SPEECH_MESSAGE)
      });
      current.started = true;
      current.timer = setTimeout(() => {
        if (session.current !== current) return;
        cancel();
        setMessage(errorMessage('unknown'));
      }, 10000);
      recognition.start();
    } catch {
      if (session.current !== current) return;
      cancel();
      setMessage(errorMessage('unknown'));
    }
  }, [cancel, finish]);

  return { available, status, message, isBusy: status !== 'idle', start, stop, cancel };
}
