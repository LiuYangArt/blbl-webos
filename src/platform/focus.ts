type Direction = 'left' | 'right' | 'up' | 'down';
type FocusGroup = 'content' | 'nav' | string;
type FocusFirstOptions = {
  preferredGroup?: FocusGroup;
  allowFallbackGroup?: boolean;
};

type FocusableElement = HTMLElement & {
  dataset: DOMStringMap & {
    focusRow?: string;
    focusCol?: string;
    focusDefault?: string;
    focusGroup?: string;
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

function readGroup(element: FocusableElement): FocusGroup {
  return element.dataset.focusGroup ?? 'content';
}

function findFirstInGroup(elements: FocusableElement[], preferredGroup: FocusGroup) {
  const groupElements = elements.filter((element) => readGroup(element) === preferredGroup);
  const preferred = groupElements.find((element) => element.dataset.focusDefault === 'true');
  return preferred ?? groupElements[0] ?? null;
}

function scoreAndSortCandidates(
  elements: FocusableElement[],
  current: { row: number; col: number },
  direction: Direction,
) {
  return elements
    .map((element) => ({
      element,
      next: readPosition(element),
      score: scoreCandidate(direction, current, readPosition(element)),
    }))
    .filter((item) => Number.isFinite(item.score))
    .sort((left, right) => {
      const leftRowDiff = Math.abs(left.next.row - current.row);
      const rightRowDiff = Math.abs(right.next.row - current.row);
      const leftColDiff = Math.abs(left.next.col - current.col);
      const rightColDiff = Math.abs(right.next.col - current.col);

      if (direction === 'left' || direction === 'right') {
        if (leftRowDiff !== rightRowDiff) {
          return leftRowDiff - rightRowDiff;
        }
        if (leftColDiff !== rightColDiff) {
          return leftColDiff - rightColDiff;
        }
      } else {
        if (leftColDiff !== rightColDiff) {
          return leftColDiff - rightColDiff;
        }
        if (leftRowDiff !== rightRowDiff) {
          return leftRowDiff - rightRowDiff;
        }
      }

      return left.score - right.score;
    });
}

export function focusFirst({ preferredGroup = 'content', allowFallbackGroup = true }: FocusFirstOptions = {}) {
  const elements = getFocusableElements();
  const preferred = findFirstInGroup(elements, preferredGroup);
  if (preferred) {
    preferred.focus();
    return preferred;
  }

  if (!allowFallbackGroup) {
    return null;
  }

  const fallback = elements.find((element) => element.dataset.focusDefault === 'true') ?? elements[0] ?? null;
  fallback?.focus();
  return fallback;
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
    focusFirst({
      preferredGroup: direction === 'left' ? 'nav' : 'content',
      allowFallbackGroup: direction === 'left',
    });
    return;
  }

  const currentPosition = readPosition(current);
  const currentGroup = readGroup(current);
  const siblings = elements.filter((element) => element !== current && readGroup(element) === currentGroup);
  const nextInGroup = scoreAndSortCandidates(siblings, currentPosition, direction)[0]?.element;
  if (nextInGroup) {
    nextInGroup.focus();
    return;
  }

  const fallbackGroup = currentGroup === 'nav'
    ? (direction === 'right' ? 'content' : null)
    : (direction === 'left' ? 'nav' : null);

  if (!fallbackGroup) {
    return;
  }

  const nextCrossGroup = scoreAndSortCandidates(
    elements.filter((element) => element !== current && readGroup(element) === fallbackGroup),
    currentPosition,
    direction,
  )[0]?.element;

  nextCrossGroup?.focus();
}
