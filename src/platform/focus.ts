type Direction = 'left' | 'right' | 'up' | 'down';

type FocusableElement = HTMLElement & {
  dataset: DOMStringMap & {
    focusRow?: string;
    focusCol?: string;
    focusDefault?: string;
  };
};

const selector = '[data-focus-row][data-focus-col]';

function getFocusableElements() {
  return Array.from(document.querySelectorAll<FocusableElement>(selector)).filter(
    (element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true',
  );
}

function readPosition(element: FocusableElement) {
  return {
    row: Number(element.dataset.focusRow ?? '0'),
    col: Number(element.dataset.focusCol ?? '0'),
  };
}

export function focusFirst() {
  const elements = getFocusableElements();
  const preferred = elements.find((element) => element.dataset.focusDefault === 'true');
  preferred?.focus();
  if (!preferred) {
    elements[0]?.focus();
  }
}

export function activateFocused() {
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    active.click();
  }
}

function scoreCandidate(direction: Direction, current: { row: number; col: number }, next: { row: number; col: number }) {
  const rowDiff = next.row - current.row;
  const colDiff = next.col - current.col;

  switch (direction) {
    case 'left':
      if (colDiff >= 0) {
        return Number.POSITIVE_INFINITY;
      }
      return Math.abs(colDiff) + Math.abs(rowDiff) * 6;
    case 'right':
      if (colDiff <= 0) {
        return Number.POSITIVE_INFINITY;
      }
      return Math.abs(colDiff) + Math.abs(rowDiff) * 6;
    case 'up':
      if (rowDiff >= 0) {
        return Number.POSITIVE_INFINITY;
      }
      return Math.abs(rowDiff) + Math.abs(colDiff) * 6;
    case 'down':
      if (rowDiff <= 0) {
        return Number.POSITIVE_INFINITY;
      }
      return Math.abs(rowDiff) + Math.abs(colDiff) * 6;
  }
}

export function moveFocus(direction: Direction) {
  const elements = getFocusableElements();
  if (elements.length === 0) {
    return;
  }

  const current = document.activeElement instanceof HTMLElement
    ? (document.activeElement as FocusableElement)
    : null;

  if (!current || !current.matches(selector)) {
    focusFirst();
    return;
  }

  const currentPosition = readPosition(current);
  const next = elements
    .filter((element) => element !== current)
    .map((element) => ({
      element,
      score: scoreCandidate(direction, currentPosition, readPosition(element)),
    }))
    .filter((item) => Number.isFinite(item.score))
    .sort((left, right) => left.score - right.score)[0]?.element;

  next?.focus();
}
