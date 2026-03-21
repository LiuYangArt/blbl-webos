type Direction = 'left' | 'right' | 'up' | 'down';

type FocusableElement = HTMLElement & {
  dataset: DOMStringMap & {
    focusRow?: string;
    focusCol?: string;
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
  const [first] = getFocusableElements();
  first?.focus();
}

export function activateFocused() {
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    active.click();
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
  const candidates = elements.filter((element) => element !== current);

  const next = candidates
    .filter((element) => {
      const position = readPosition(element);
      switch (direction) {
        case 'left':
          return position.row === currentPosition.row && position.col < currentPosition.col;
        case 'right':
          return position.row === currentPosition.row && position.col > currentPosition.col;
        case 'up':
          return position.col === currentPosition.col && position.row < currentPosition.row;
        case 'down':
          return position.col === currentPosition.col && position.row > currentPosition.row;
      }
    })
    .sort((left, right) => {
      const leftPosition = readPosition(left);
      const rightPosition = readPosition(right);

      if (direction === 'left' || direction === 'right') {
        return Math.abs(leftPosition.col - currentPosition.col) - Math.abs(rightPosition.col - currentPosition.col);
      }

      return Math.abs(leftPosition.row - currentPosition.row) - Math.abs(rightPosition.row - currentPosition.row);
    })[0];

  next?.focus();
}
