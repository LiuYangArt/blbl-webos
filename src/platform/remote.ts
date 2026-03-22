import { activateFocused, moveFocus } from './focus';
import { REMOTE_KEYS } from './webos';

export const REMOTE_INTENT_EVENT = 'tv-remote-intent';

export type RemoteIntentAction = 'left' | 'right' | 'up' | 'down' | 'enter' | 'back';

export type RemoteIntentDetail = {
  action: RemoteIntentAction;
  keyCode: number;
};

type RemoteHandlers = {
  onBack: () => void;
};

const handledKeys = new Set<number>([
  REMOTE_KEYS.LEFT,
  REMOTE_KEYS.RIGHT,
  REMOTE_KEYS.UP,
  REMOTE_KEYS.DOWN,
  REMOTE_KEYS.ENTER,
  REMOTE_KEYS.BACK,
]);
const KEY_GUARD_MS = 140;

function mapKeyCodeToAction(keyCode: number): RemoteIntentAction | null {
  switch (keyCode) {
    case REMOTE_KEYS.LEFT:
      return 'left';
    case REMOTE_KEYS.RIGHT:
      return 'right';
    case REMOTE_KEYS.UP:
      return 'up';
    case REMOTE_KEYS.DOWN:
      return 'down';
    case REMOTE_KEYS.ENTER:
      return 'enter';
    case REMOTE_KEYS.BACK:
      return 'back';
    default:
      return null;
  }
}

export function attachRemoteControl({ onBack }: RemoteHandlers) {
  const pressedKeys = new Set<number>();
  const lastHandledAt = new Map<number, number>();

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!handledKeys.has(event.keyCode)) {
      return;
    }

    const activeElement = document.activeElement;
    if (
      event.keyCode !== REMOTE_KEYS.BACK
      && activeElement instanceof HTMLElement
      && (
        activeElement instanceof HTMLInputElement
        || activeElement instanceof HTMLTextAreaElement
        || activeElement instanceof HTMLSelectElement
        || activeElement.isContentEditable
      )
    ) {
      return;
    }

    event.preventDefault();

    if (event.repeat || pressedKeys.has(event.keyCode)) {
      return;
    }

    const now = performance.now();
    const lastHandled = lastHandledAt.get(event.keyCode) ?? -Infinity;
    if (now - lastHandled < KEY_GUARD_MS) {
      return;
    }

    pressedKeys.add(event.keyCode);
    lastHandledAt.set(event.keyCode, now);

    const action = mapKeyCodeToAction(event.keyCode);
    if (action) {
      const remoteEvent = new CustomEvent<RemoteIntentDetail>(REMOTE_INTENT_EVENT, {
        bubbles: false,
        cancelable: true,
        detail: {
          action,
          keyCode: event.keyCode,
        },
      });

      const shouldContinue = window.dispatchEvent(remoteEvent);
      if (!shouldContinue) {
        return;
      }
    }

    switch (event.keyCode) {
      case REMOTE_KEYS.LEFT:
        moveFocus('left');
        break;
      case REMOTE_KEYS.RIGHT:
        moveFocus('right');
        break;
      case REMOTE_KEYS.UP:
        moveFocus('up');
        break;
      case REMOTE_KEYS.DOWN:
        moveFocus('down');
        break;
      case REMOTE_KEYS.ENTER:
        activateFocused();
        break;
      case REMOTE_KEYS.BACK:
        onBack();
        break;
      default:
        break;
    }
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    pressedKeys.delete(event.keyCode);
  };

  const resetPressedKeys = () => {
    pressedKeys.clear();
  };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('blur', resetPressedKeys);

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    window.removeEventListener('blur', resetPressedKeys);
  };
}
