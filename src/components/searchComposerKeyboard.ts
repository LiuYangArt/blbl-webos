type ComposerKeyboardPlanInput = {
  inputTop: number;
  inputBottom: number;
  scrollRootTop: number;
  scrollRootBottom: number;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  innerHeight: number;
  visualViewportHeight: number | null;
  visualViewportOffsetTop: number | null;
  keyboardVisible: boolean;
  assumeKeyboardVisible: boolean;
  fallbackKeyboardInset: number;
};

type ComposerKeyboardPlan = {
  keyboardInset: number;
  visibleBottom: number;
  scrollDelta: number;
  extraBottomPadding: number;
};

const EDGE_MARGIN = 24;

export function computeComposerKeyboardPlan(input: ComposerKeyboardPlanInput): ComposerKeyboardPlan {
  const keyboardInset = resolveKeyboardInset(input);
  const visibleBottom = Math.max(
    input.scrollRootTop + EDGE_MARGIN,
    Math.min(
      input.scrollRootBottom - EDGE_MARGIN,
      input.innerHeight - keyboardInset - EDGE_MARGIN,
    ),
  );

  const hiddenBelow = Math.max(0, input.inputBottom - visibleBottom);
  const scrollDelta = Math.ceil(hiddenBelow);
  const maxScrollableDistance = Math.max(0, input.scrollHeight - input.clientHeight - input.scrollTop);
  const extraBottomPadding = scrollDelta > maxScrollableDistance
    ? Math.ceil(scrollDelta - maxScrollableDistance + EDGE_MARGIN)
    : 0;

  return {
    keyboardInset,
    visibleBottom,
    scrollDelta,
    extraBottomPadding,
  };
}

function resolveKeyboardInset(input: ComposerKeyboardPlanInput): number {
  const visualViewportInset = input.visualViewportHeight == null
    ? 0
    : Math.max(
      0,
      input.innerHeight - input.visualViewportHeight - (input.visualViewportOffsetTop ?? 0),
    );

  if (visualViewportInset > 0) {
    return visualViewportInset;
  }

  if (input.keyboardVisible || input.assumeKeyboardVisible) {
    return Math.max(0, input.fallbackKeyboardInset);
  }

  return 0;
}
