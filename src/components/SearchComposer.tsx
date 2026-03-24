import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { getKeyboardVisible, isWebOSAvailable, observeKeyboardVisibility } from '../platform/webos';
import {
  isSearchComposerKeyboardSessionOpen,
  resolveSearchComposerBlurDecision,
  shouldKeepSearchComposerKeyboardSessionLocked,
} from './searchComposerKeyboardSession';
import {
  applySearchComposerValueFilter,
  resolveSearchComposerInputMode,
  resolveSearchComposerMaxLength,
  type SearchComposerValueFilter,
} from './searchComposerValueFilter';

type SearchComposerField = {
  key: string;
  value: string;
  label?: string;
  placeholder?: string;
  autoFocus?: boolean;
  defaultFocus?: boolean;
  readOnly?: boolean;
  inputMode?: 'text' | 'search' | 'numeric' | 'decimal' | 'tel' | 'url' | 'email';
  focusId?: string;
  sectionId?: string;
  focusLeft?: string;
  focusRight?: string;
  focusUp?: string;
  focusDown?: string;
  maxLength?: number;
  valueFilter?: SearchComposerValueFilter;
  onChange: (value: string) => void;
};

type SearchComposerProps = {
  value?: string;
  label?: string;
  placeholder?: string;
  fields?: SearchComposerField[];
  submitLabel?: string;
  closeLabel?: string;
  autoFocus?: boolean;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
  onClose?: () => void;
};

const EMPTY_CHANGE_HANDLER = () => {};
const VIEWPORT_SAFE_MARGIN = 28;
const KEYBOARD_SAFE_CLEARANCE = 72;
const KEYBOARD_MONITOR_INTERVAL_MS = 120;
const KEYBOARD_FALLBACK_INSET_RATIO = 1 / 3;

export function SearchComposer({
  value = '',
  label = '关键词',
  placeholder,
  fields,
  submitLabel,
  closeLabel = '关闭输入面板',
  autoFocus = true,
  readOnly = false,
  onChange,
  onSubmit,
  onClose,
}: SearchComposerProps): React.JSX.Element {
  const [keyboardSafeOpen, setKeyboardSafeOpen] = useState(false);
  const [keyboardSpacerHeight, setKeyboardSpacerHeight] = useState(0);
  const [keyboardVisibilityHint, setKeyboardVisibilityHint] = useState<boolean | null>(null);
  const [focusedFieldKey, setFocusedFieldKey] = useState<string | null>(null);
  const keyboardSafeMode = isWebOSAvailable();
  const composerRef = useRef<HTMLDivElement | null>(null);
  const activeInputRef = useRef<HTMLInputElement | null>(null);
  const monitorTimerRef = useRef<number | null>(null);
  const pendingAlignFrameRef = useRef<number | null>(null);
  const keyboardIntentAtRef = useRef<number | null>(null);
  const keyboardSessionLockedRef = useRef(false);
  const keyboardDismissRequestedRef = useRef(false);

  const fallbackField: SearchComposerField = {
    key: 'primary',
    value,
    label,
    placeholder,
    autoFocus,
    defaultFocus: autoFocus,
    readOnly,
    valueFilter: 'none',
    onChange: onChange ?? EMPTY_CHANGE_HANDLER,
  };

  const resolvedFields: SearchComposerField[] = fields && fields.length
    ? fields
    : [fallbackField];

  const hasActions = Boolean((submitLabel && onSubmit) || onClose);
  const composerClassName = [
    'search-composer',
    keyboardSafeMode ? 'search-composer--keyboard-safe' : '',
    keyboardSafeMode && keyboardSafeOpen ? 'search-composer--keyboard-open' : '',
  ].filter(Boolean).join(' ');

  useEffect(() => {
    if (!keyboardSafeMode) {
      return undefined;
    }

    return observeKeyboardVisibility((visible) => {
      setKeyboardVisibilityHint(visible);
    });
  }, [keyboardSafeMode]);

  useEffect(() => {
    if (!keyboardSafeMode || !focusedFieldKey) {
      stopKeyboardMonitor(monitorTimerRef);
      cancelPendingAlignFrame(pendingAlignFrameRef);
      setKeyboardSafeOpen(false);
      setKeyboardSpacerHeight(0);
      return;
    }

    const syncKeyboardSession = () => {
      const nextKeyboardOpen = isKeyboardSessionOpen(keyboardIntentAtRef.current, keyboardVisibilityHint)
        || shouldKeepSearchComposerKeyboardSessionLocked({
          sessionLocked: keyboardSessionLockedRef.current,
          dismissRequested: keyboardDismissRequestedRef.current,
          nextFocusKind: classifyComposerBlurTarget(document.activeElement),
        });
      const nextKeyboardInset = nextKeyboardOpen ? resolveKeyboardInset(true, keyboardVisibilityHint) : 0;
      syncKeyboardSafeLayout(setKeyboardSafeOpen, setKeyboardSpacerHeight, nextKeyboardOpen, nextKeyboardInset);

      if (nextKeyboardOpen) {
        scheduleAlignActiveInput(pendingAlignFrameRef, activeInputRef, composerRef, true);
      } else {
        keyboardDismissRequestedRef.current = false;
      }
    };

    const handlePotentialKeyboardDismiss = (event: KeyboardEvent) => {
      const isBackLike = event.key === 'Escape'
        || event.key === 'GoBack'
        || event.key === 'BrowserBack'
        || event.keyCode === 461;

      if (!isBackLike) {
        return;
      }

      keyboardDismissRequestedRef.current = true;
      keyboardSessionLockedRef.current = false;
      keyboardIntentAtRef.current = null;
      setKeyboardVisibilityHint(false);
      resetKeyboardSafeLayout(setKeyboardSafeOpen, setKeyboardSpacerHeight);
    };

    syncKeyboardSession();
    monitorTimerRef.current = window.setInterval(syncKeyboardSession, KEYBOARD_MONITOR_INTERVAL_MS);
    window.visualViewport?.addEventListener('resize', syncKeyboardSession);
    window.visualViewport?.addEventListener('scroll', syncKeyboardSession);
    window.addEventListener('resize', syncKeyboardSession);
    window.addEventListener('keydown', handlePotentialKeyboardDismiss, true);

    return () => {
      stopKeyboardMonitor(monitorTimerRef);
      cancelPendingAlignFrame(pendingAlignFrameRef);
      window.visualViewport?.removeEventListener('resize', syncKeyboardSession);
      window.visualViewport?.removeEventListener('scroll', syncKeyboardSession);
      window.removeEventListener('resize', syncKeyboardSession);
      window.removeEventListener('keydown', handlePotentialKeyboardDismiss, true);
    };
  }, [focusedFieldKey, keyboardSafeMode, keyboardVisibilityHint]);

  return (
    <div ref={composerRef} className={composerClassName}>
      <div className="search-composer__fields">
        {resolvedFields.map((field) => (
          <label key={field.key} className="search-composer__field">
            <span>{field.label ?? label}</span>
            <input
              autoFocus={field.autoFocus}
              value={field.value}
              placeholder={field.placeholder}
              readOnly={field.readOnly}
              inputMode={resolveSearchComposerInputMode(field.valueFilter, field.inputMode)}
              data-focusable={field.sectionId ? 'true' : undefined}
              data-focus-id={field.focusId}
              data-focus-section={field.sectionId}
              data-focus-default={field.defaultFocus ? 'true' : undefined}
              data-focus-left={field.focusLeft}
              data-focus-right={field.focusRight}
              data-focus-up={field.focusUp}
              data-focus-down={field.focusDown}
              data-composer-input="true"
              data-composer-field-key={field.key}
              maxLength={resolveSearchComposerMaxLength(field.valueFilter, field.maxLength)}
              onFocus={(event) => {
                activeInputRef.current = event.currentTarget;
                keyboardIntentAtRef.current = Date.now();
                keyboardSessionLockedRef.current = true;
                keyboardDismissRequestedRef.current = false;
                setFocusedFieldKey(field.key);

                if (keyboardSafeMode) {
                  showKeyboardSafeLayout(setKeyboardSafeOpen, setKeyboardSpacerHeight, keyboardVisibilityHint);
                  scheduleAlignActiveInput(pendingAlignFrameRef, activeInputRef, composerRef, true);
                  return;
                }

                event.currentTarget.scrollIntoView({
                  block: 'nearest',
                  inline: 'nearest',
                  behavior: 'auto',
                });
              }}
              onBlur={() => {
                window.setTimeout(() => {
                  const nextActiveElement = document.activeElement;

                  if (isComposerManagedInput(nextActiveElement)) {
                    activeInputRef.current = nextActiveElement;
                    setFocusedFieldKey(nextActiveElement.dataset.composerFieldKey ?? field.key);
                    return;
                  }

                  const blurDecision = resolveSearchComposerBlurDecision({
                    keyboardSafeMode,
                    nextFocusKind: classifyComposerBlurTarget(nextActiveElement),
                    keyboardVisible: readKeyboardVisibilitySignal(keyboardVisibilityHint),
                    keyboardInset: resolveKeyboardInset(false, keyboardVisibilityHint),
                    keyboardIntentAt: keyboardIntentAtRef.current,
                  });

                  if (blurDecision === 'keep-session') {
                    keyboardSessionLockedRef.current = true;
                    showKeyboardSafeLayout(setKeyboardSafeOpen, setKeyboardSpacerHeight, keyboardVisibilityHint);
                    scheduleAlignActiveInput(pendingAlignFrameRef, activeInputRef, composerRef, true);
                    return;
                  }

                  releaseKeyboardSession(
                    activeInputRef,
                    keyboardIntentAtRef,
                    keyboardSessionLockedRef,
                    keyboardDismissRequestedRef,
                    setFocusedFieldKey,
                    setKeyboardSafeOpen,
                    setKeyboardSpacerHeight,
                  );
                }, 0);
              }}
              onInput={(event) => {
                const nextValue = applySearchComposerValueFilter(
                  (event.target as HTMLInputElement).value,
                  field.valueFilter,
                  field.maxLength,
                );
                field.onChange(nextValue);
              }}
              onChange={(event) => {
                const nextValue = applySearchComposerValueFilter(
                  event.target.value,
                  field.valueFilter,
                  field.maxLength,
                );
                field.onChange(nextValue);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  onSubmit?.();
                }
              }}
            />
          </label>
        ))}
      </div>

      {hasActions ? (
        <div className="search-composer__actions">
          {submitLabel && onSubmit ? (
            <button type="button" onClick={onSubmit}>
              {submitLabel}
            </button>
          ) : null}
          {onClose ? (
            <button type="button" onClick={onClose}>
              {closeLabel}
            </button>
          ) : null}
        </div>
      ) : null}
      {keyboardSafeMode ? (
        <div
          className="search-composer__keyboard-spacer"
          style={{ height: `${keyboardSpacerHeight}px` }}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}

function isComposerManagedInput(element: Element | null): element is HTMLInputElement {
  return element instanceof HTMLInputElement && element.dataset.composerInput === 'true';
}

function stopKeyboardMonitor(timerRef: MutableRefObject<number | null>): void {
  if (timerRef.current == null) {
    return;
  }

  window.clearInterval(timerRef.current);
  timerRef.current = null;
}

function cancelPendingAlignFrame(frameRef: MutableRefObject<number | null>): void {
  if (frameRef.current == null) {
    return;
  }

  window.cancelAnimationFrame(frameRef.current);
  frameRef.current = null;
}

function releaseKeyboardSession(
  activeInputRef: MutableRefObject<HTMLInputElement | null>,
  keyboardIntentAtRef: MutableRefObject<number | null>,
  keyboardSessionLockedRef: MutableRefObject<boolean>,
  keyboardDismissRequestedRef: MutableRefObject<boolean>,
  setFocusedFieldKey: (value: string | null) => void,
  setKeyboardSafeOpen: (value: boolean) => void,
  setKeyboardSpacerHeight: (value: number) => void,
): void {
  activeInputRef.current = null;
  keyboardIntentAtRef.current = null;
  keyboardSessionLockedRef.current = false;
  keyboardDismissRequestedRef.current = false;
  setFocusedFieldKey(null);
  resetKeyboardSafeLayout(setKeyboardSafeOpen, setKeyboardSpacerHeight);
}

function syncKeyboardSafeLayout(
  setKeyboardSafeOpen: (value: boolean) => void,
  setKeyboardSpacerHeight: (value: number) => void,
  keyboardSafeOpen: boolean,
  keyboardSpacerHeight: number,
): void {
  setKeyboardSafeOpen(keyboardSafeOpen);
  setKeyboardSpacerHeight(keyboardSpacerHeight);
}

function showKeyboardSafeLayout(
  setKeyboardSafeOpen: (value: boolean) => void,
  setKeyboardSpacerHeight: (value: number) => void,
  keyboardVisibilityHint: boolean | null,
): void {
  syncKeyboardSafeLayout(
    setKeyboardSafeOpen,
    setKeyboardSpacerHeight,
    true,
    resolveKeyboardInset(true, keyboardVisibilityHint),
  );
}

function resetKeyboardSafeLayout(
  setKeyboardSafeOpen: (value: boolean) => void,
  setKeyboardSpacerHeight: (value: number) => void,
): void {
  syncKeyboardSafeLayout(setKeyboardSafeOpen, setKeyboardSpacerHeight, false, 0);
}

function scheduleAlignActiveInput(
  frameRef: MutableRefObject<number | null>,
  activeInputRef: MutableRefObject<HTMLInputElement | null>,
  composerRef: MutableRefObject<HTMLDivElement | null>,
  allowFallbackInset: boolean,
): void {
  cancelPendingAlignFrame(frameRef);
  frameRef.current = window.requestAnimationFrame(() => {
    frameRef.current = null;
    alignActiveInputIntoKeyboardSafeZone(activeInputRef.current, composerRef.current, allowFallbackInset);
  });
}

function classifyComposerBlurTarget(element: Element | null): 'composer-input' | 'focusable-control' | 'other' {
  if (isComposerManagedInput(element)) {
    return 'composer-input';
  }

  if (isFocusableAppElement(element)) {
    return 'focusable-control';
  }

  return 'other';
}

function isFocusableAppElement(element: Element | null): element is HTMLElement {
  return element instanceof HTMLElement && (
    element.dataset.focusable === 'true'
    || element.matches('button, [href], [tabindex]:not([tabindex="-1"])')
  );
}

function alignActiveInputIntoKeyboardSafeZone(
  input: HTMLInputElement | null,
  composer: HTMLDivElement | null,
  allowFallbackInset: boolean,
): void {
  if (!input || !composer) {
    return;
  }

  const scrollRoot = composer.closest<HTMLElement>('[data-focus-scroll-root="true"]');
  const keyboardInset = resolveKeyboardInset(allowFallbackInset);
  if (keyboardInset <= 0) {
    return;
  }

  const inputRect = input.getBoundingClientRect();
  const viewportBottom = scrollRoot?.getBoundingClientRect().bottom ?? window.innerHeight;
  const safeBottom = Math.min(
    viewportBottom - VIEWPORT_SAFE_MARGIN,
    window.innerHeight - keyboardInset - KEYBOARD_SAFE_CLEARANCE,
  );
  const overflow = inputRect.bottom - safeBottom;

  if (overflow <= 0) {
    return;
  }

  if (scrollRoot) {
    scrollRoot.scrollTo({
      top: scrollRoot.scrollTop + overflow,
      left: scrollRoot.scrollLeft,
      behavior: 'auto',
    });
    return;
  }

  window.scrollTo({
    top: window.scrollY + overflow,
    left: window.scrollX,
    behavior: 'auto',
  });
}

function isKeyboardSessionOpen(
  keyboardIntentAt: number | null,
  keyboardVisibilityHint: boolean | null,
): boolean {
  return isSearchComposerKeyboardSessionOpen({
    keyboardVisible: readKeyboardVisibilitySignal(keyboardVisibilityHint),
    keyboardInset: resolveKeyboardInset(false, keyboardVisibilityHint),
    keyboardIntentAt,
  });
}

function resolveKeyboardInset(
  allowFallbackInset: boolean,
  keyboardVisibilityHint: boolean | null = null,
): number {
  const visualViewport = window.visualViewport;
  if (visualViewport) {
    const visualViewportInset = Math.max(
      0,
      window.innerHeight - visualViewport.height - (visualViewport.offsetTop ?? 0),
    );

    if (visualViewportInset > 0) {
      return visualViewportInset;
    }
  }

  if (isWebOSAvailable() && (readKeyboardVisibilitySignal(keyboardVisibilityHint) || allowFallbackInset)) {
    return Math.round(window.innerHeight * KEYBOARD_FALLBACK_INSET_RATIO);
  }

  return 0;
}

function readKeyboardVisibilitySignal(keyboardVisibilityHint: boolean | null): boolean {
  return keyboardVisibilityHint ?? getKeyboardVisible();
}
