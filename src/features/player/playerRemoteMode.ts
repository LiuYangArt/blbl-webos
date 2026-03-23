import type { RemoteIntentAction } from '../../platform/remote';

export type PlayerChromeRemoteDecision =
  | 'seek-backward'
  | 'seek-forward'
  | 'toggle-play'
  | 'focus-controls'
  | 'blur-controls'
  | 'delegate'
  | 'keep-alive';

export function decidePlayerChromeRemoteAction(
  action: RemoteIntentAction,
  controlsFocused: boolean,
): PlayerChromeRemoteDecision {
  if (controlsFocused) {
    if (action === 'up' || action === 'down') {
      return 'blur-controls';
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
      return 'keep-alive';
  }
}
