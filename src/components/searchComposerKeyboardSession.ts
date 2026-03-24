export type SearchComposerNextFocusKind = 'composer-input' | 'focusable-control' | 'other';

const KEYBOARD_OPEN_THRESHOLD = 120;
const KEYBOARD_OPEN_GRACE_MS = 900;

type SearchComposerKeyboardSessionState = {
  keyboardVisible: boolean;
  keyboardInset: number;
  keyboardIntentAt: number | null;
  now?: number;
};

type SearchComposerBlurDecisionInput = SearchComposerKeyboardSessionState & {
  keyboardSafeMode: boolean;
  nextFocusKind: SearchComposerNextFocusKind;
};

type SearchComposerLockedSessionInput = {
  sessionLocked: boolean;
  dismissRequested: boolean;
  nextFocusKind: SearchComposerNextFocusKind;
};

export function isSearchComposerKeyboardSessionOpen({
  keyboardVisible,
  keyboardInset,
  keyboardIntentAt,
  now = Date.now(),
}: SearchComposerKeyboardSessionState): boolean {
  if (keyboardVisible) {
    return true;
  }

  if (keyboardInset >= KEYBOARD_OPEN_THRESHOLD) {
    return true;
  }

  if (keyboardIntentAt && now - keyboardIntentAt < KEYBOARD_OPEN_GRACE_MS) {
    return true;
  }

  return false;
}

export function resolveSearchComposerBlurDecision({
  keyboardSafeMode,
  nextFocusKind,
  keyboardVisible,
  keyboardInset,
  keyboardIntentAt,
  now,
}: SearchComposerBlurDecisionInput): 'handoff' | 'keep-session' | 'close-session' {
  if (nextFocusKind === 'composer-input') {
    return 'handoff';
  }

  if (nextFocusKind === 'focusable-control') {
    return 'close-session';
  }

  if (
    keyboardSafeMode
    && isSearchComposerKeyboardSessionOpen({
      keyboardVisible,
      keyboardInset,
      keyboardIntentAt,
      now,
    })
  ) {
    return 'keep-session';
  }

  return 'close-session';
}

export function shouldKeepSearchComposerKeyboardSessionLocked({
  sessionLocked,
  dismissRequested,
  nextFocusKind,
}: SearchComposerLockedSessionInput): boolean {
  return sessionLocked && !dismissRequested && nextFocusKind === 'other';
}
