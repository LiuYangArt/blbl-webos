import { activateFocused, moveFocus } from './focus';
import { REMOTE_KEYS } from './webos';

type RemoteHandlers = {
  onBack: () => void;
};

export function attachRemoteControl({ onBack }: RemoteHandlers) {
  const handleKeyDown = (event: KeyboardEvent) => {
    switch (event.keyCode) {
      case REMOTE_KEYS.LEFT:
        event.preventDefault();
        moveFocus('left');
        break;
      case REMOTE_KEYS.RIGHT:
        event.preventDefault();
        moveFocus('right');
        break;
      case REMOTE_KEYS.UP:
        event.preventDefault();
        moveFocus('up');
        break;
      case REMOTE_KEYS.DOWN:
        event.preventDefault();
        moveFocus('down');
        break;
      case REMOTE_KEYS.ENTER:
        event.preventDefault();
        activateFocused();
        break;
      case REMOTE_KEYS.BACK:
        event.preventDefault();
        onBack();
        break;
      default:
        break;
    }
  };

  window.addEventListener('keydown', handleKeyDown);

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
}
