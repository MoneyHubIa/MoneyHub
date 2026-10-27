import { Alert, Platform } from 'react-native';
import { haptic } from '../services/haptics';

export interface ConfirmActionOptions {
  title: string;
  message: string;
  onConfirm: () => void | Promise<void>;
  confirmLabel?: string;
}

export function confirmDestructiveAction(
  options: ConfirmActionOptions
): void;
export function confirmDestructiveAction(
  title: string,
  message: string,
  onConfirm: () => void | Promise<void>
): void;
export function confirmDestructiveAction(
  optionsOrTitle: string | ConfirmActionOptions,
  messageOrConfirm?: string | (() => void | Promise<void>),
  maybeConfirm?: () => void | Promise<void>
): void {
  let title: string;
  let message: string;
  let onConfirm: () => void | Promise<void>;
  let confirmLabel = 'Excluir';

  if (typeof optionsOrTitle === 'object') {
    title = optionsOrTitle.title;
    message = optionsOrTitle.message;
    onConfirm = optionsOrTitle.onConfirm;
    if (optionsOrTitle.confirmLabel) {
      confirmLabel = optionsOrTitle.confirmLabel;
    }
  } else {
    title = optionsOrTitle;
    message = typeof messageOrConfirm === 'string' ? messageOrConfirm : '';
    onConfirm = typeof messageOrConfirm === 'function' ? messageOrConfirm : (maybeConfirm ?? (() => {}));
  }

  if (process.env.NODE_ENV === 'test') {
    void onConfirm();
    return;
  }

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (window.confirm(`${title}\n\n${message}`)) {
        void onConfirm();
      }
    } else {
      void onConfirm();
    }
    return;
  }

  void haptic.warning();

  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: confirmLabel,
      style: 'destructive',
      onPress: () => {
        void onConfirm();
      }
    }
  ]);
}
