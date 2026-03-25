import type { RemoteIntentAction } from '../../platform/remote';

export type PlayerChromeRemoteDecision =
  | 'seek-backward'
  | 'seek-forward'
  | 'toggle-play'
  | 'play'
  | 'pause'
  | 'focus-controls'
  | 'blur-controls'
  | 'delegate'
  | 'keep-alive';

function mapMediaRemoteAction(action: RemoteIntentAction): 'play' | 'pause' | null {
  if (action === 'play' || action === 'pause') {
    return action;
  }

  return null;
}

export function decidePlayerChromeRemoteAction(
  action: RemoteIntentAction,
  controlsFocused: boolean,
): PlayerChromeRemoteDecision {
  if (controlsFocused) {
    if (action === 'up' || action === 'down') {
      return 'blur-controls';
    }

    const mediaAction = mapMediaRemoteAction(action);
    if (mediaAction) {
      return mediaAction;
    }

    return 'delegate';
  }

  switch (action) {
    case 'left':
      return 'seek-backward';
    case 'right':
      return 'seek-forward';
    case 'enter':
      return 'toggle-play';
    case 'up':
    case 'down':
      return 'focus-controls';
    default:
      return mapMediaRemoteAction(action) ?? 'keep-alive';
  }
}
