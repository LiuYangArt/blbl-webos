import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { getKeyboardVisible, isWebOSAvailable } from '../platform/webos';
import { computeComposerKeyboardPlan } from './searchComposerKeyboard';

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

type KeyboardInsetSnapshot = {
  root: HTMLElement;
  paddingBottom: string;
  scrollPaddingBottom: string;
  basePaddingBottom: number;
};

const EMPTY_CHANGE_HANDLER = () => {};

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
  const activeInputRef = useRef<HTMLInputElement | null>(null);
  const pendingScrollTimersRef = useRef<number[]>([]);
  const keyboardInsetStateRef = useRef<KeyboardInsetSnapshot | null>(null);

  const resolvedFields = fields && fields.length
    ? fields
    : [{
      key: 'primary',
      value,
      label,
      placeholder,
      autoFocus,
      defaultFocus: autoFocus,
      readOnly,
      onChange: onChange ?? EMPTY_CHANGE_HANDLER,
    }];

  const hasActions = Boolean((submitLabel && onSubmit) || onClose);

  useEffect(() => {
    const timerBucket = pendingScrollTimersRef.current;
    const handleViewportChange = () => {
      if (activeInputRef.current) {
        scrollComposerInputIntoView(activeInputRef.current, keyboardInsetStateRef);
      }
    };

    window.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('scroll', handleViewportChange);

    return () => {
      clearPendingScrollTimers(timerBucket);
      restoreComposerKeyboardInset(keyboardInsetStateRef);
      window.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

  return (
    <div className="search-composer">
      <div className="search-composer__fields">
        {resolvedFields.map((field) => (
          <label key={field.key} className="search-composer__field">
            <span>{field.label ?? label}</span>
            <input
              autoFocus={field.autoFocus}
              value={field.value}
              placeholder={field.placeholder}
              readOnly={field.readOnly}
              inputMode={field.inputMode}
              data-focusable={field.sectionId ? 'true' : undefined}
              data-focus-id={field.focusId}
              data-focus-section={field.sectionId}
              data-focus-default={field.defaultFocus ? 'true' : undefined}
              data-focus-left={field.focusLeft}
              data-focus-right={field.focusRight}
              data-focus-up={field.focusUp}
              data-focus-down={field.focusDown}
              data-composer-input="true"
              onFocus={(event) => {
                activeInputRef.current = event.currentTarget;
                scheduleComposerInputScroll(
                  event.currentTarget,
                  pendingScrollTimersRef.current,
                  keyboardInsetStateRef,
                );
              }}
              onBlur={() => {
                activeInputRef.current = null;
                clearPendingScrollTimers(pendingScrollTimersRef.current);
                window.setTimeout(() => {
                  if (!isComposerManagedInput(document.activeElement)) {
                    restoreComposerKeyboardInset(keyboardInsetStateRef);
                  }
                }, 0);
              }}
              onInput={(event) => field.onChange((event.target as HTMLInputElement).value)}
              onChange={(event) => field.onChange(event.target.value)}
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
    </div>
  );
}

function scheduleComposerInputScroll(
  input: HTMLInputElement,
  timerBucket: number[],
  keyboardInsetStateRef: MutableRefObject<KeyboardInsetSnapshot | null>,
): void {
  clearPendingScrollTimers(timerBucket);
  [0, 140, 320].forEach((delay) => {
    const timerId = window.setTimeout(() => {
      if (document.activeElement === input) {
        scrollComposerInputIntoView(input, keyboardInsetStateRef);
      }
    }, delay);
    timerBucket.push(timerId);
  });
}

function clearPendingScrollTimers(timerBucket: number[]): void {
  timerBucket.splice(0).forEach((timerId) => {
    window.clearTimeout(timerId);
  });
}

function isComposerManagedInput(element: Element | null): element is HTMLInputElement {
  return element instanceof HTMLInputElement && element.dataset.composerInput === 'true';
}

function rememberComposerKeyboardInset(
  scrollRoot: HTMLElement,
  keyboardInsetStateRef: MutableRefObject<KeyboardInsetSnapshot | null>,
): void {
  if (keyboardInsetStateRef.current?.root === scrollRoot) {
    return;
  }

  restoreComposerKeyboardInset(keyboardInsetStateRef);
  keyboardInsetStateRef.current = {
    root: scrollRoot,
    paddingBottom: scrollRoot.style.paddingBottom,
    scrollPaddingBottom: scrollRoot.style.scrollPaddingBottom,
    basePaddingBottom: Number.parseFloat(window.getComputedStyle(scrollRoot).paddingBottom) || 0,
  };
}

function restoreComposerKeyboardInset(
  keyboardInsetStateRef: MutableRefObject<KeyboardInsetSnapshot | null>,
): void {
  const snapshot = keyboardInsetStateRef.current;
  if (!snapshot) {
    return;
  }

  snapshot.root.style.paddingBottom = snapshot.paddingBottom;
  snapshot.root.style.scrollPaddingBottom = snapshot.scrollPaddingBottom;
  keyboardInsetStateRef.current = null;
}

function scrollComposerInputIntoView(
  input: HTMLInputElement,
  keyboardInsetStateRef: MutableRefObject<KeyboardInsetSnapshot | null>,
): void {
  const scrollRoot = input.closest<HTMLElement>('[data-focus-scroll-root="true"]');
  if (!scrollRoot) {
    input.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'auto',
    });
    return;
  }

  const inputRect = input.getBoundingClientRect();
  const scrollRootRect = scrollRoot.getBoundingClientRect();
  const plan = computeComposerKeyboardPlan({
    inputTop: inputRect.top,
    inputBottom: inputRect.bottom,
    scrollRootTop: scrollRootRect.top,
    scrollRootBottom: scrollRootRect.bottom,
    scrollTop: scrollRoot.scrollTop,
    scrollHeight: scrollRoot.scrollHeight,
    clientHeight: scrollRoot.clientHeight,
    innerHeight: window.innerHeight,
    visualViewportHeight: window.visualViewport?.height ?? null,
    visualViewportOffsetTop: window.visualViewport?.offsetTop ?? null,
    keyboardVisible: getKeyboardVisible(),
    assumeKeyboardVisible: isWebOSAvailable(),
    fallbackKeyboardInset: isWebOSAvailable()
      ? Math.round(window.innerHeight * 0.35)
      : 0,
  });

  if (plan.extraBottomPadding > 0) {
    rememberComposerKeyboardInset(scrollRoot, keyboardInsetStateRef);
    const snapshot = keyboardInsetStateRef.current;
    const basePaddingBottom = snapshot?.basePaddingBottom ?? 0;
    scrollRoot.style.paddingBottom = `${basePaddingBottom + plan.extraBottomPadding}px`;
    scrollRoot.style.scrollPaddingBottom = `${basePaddingBottom + plan.extraBottomPadding + 24}px`;
  } else {
    restoreComposerKeyboardInset(keyboardInsetStateRef);
  }

  if (plan.scrollDelta <= 0) {
    return;
  }

  scrollRoot.scrollTo({
    top: scrollRoot.scrollTop + plan.scrollDelta,
    left: scrollRoot.scrollLeft,
    behavior: 'auto',
  });
}
