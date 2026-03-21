import type {
  Direction,
  FocusCaptureOptions,
  FocusFirstOptions,
  FocusGroup,
  FocusSectionConfig,
  FocusTarget,
} from './types';

type FocusableElement = HTMLElement & {
  dataset: DOMStringMap & {
    focusable?: string;
    focusId?: string;
    focusSection?: string;
    focusDefault?: string;
    focusGroup?: string;
    focusLeft?: string;
    focusRight?: string;
    focusUp?: string;
    focusDown?: string;
  };
};

type RegisteredSection = {
  config: FocusSectionConfig;
  order: number;
  mounted: boolean;
  lastFocusedId: string | null;
  lastFocusedElement: FocusableElement | null;
};

type FocusCapture = {
  sectionId: string;
  restoreTarget: FocusTarget;
};

type FocusRect = {
  element: FocusableElement;
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

const FOCUSABLE_SELECTOR = '[data-focusable="true"]';
const FOCUS_VISIBILITY_PADDING = {
  top: 24,
  right: 24,
  bottom: 32,
  left: 24,
} as const;
const sections = new Map<string, RegisteredSection>();
const captures: FocusCapture[] = [];

let orderSeed = 0;
let initialized = false;

function scheduleFocusWork(callback: () => void): void {
  window.setTimeout(callback, 0);
}

function ensureInitialized() {
  if (initialized || typeof document === 'undefined') {
    return;
  }

  document.addEventListener('focusin', handleFocusIn, true);
  initialized = true;
}

function handleFocusIn(event: FocusEvent) {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !isFocusableElement(target)) {
    return;
  }

  const sectionId = readSectionId(target);
  if (!sectionId) {
    return;
  }

  const section = sections.get(sectionId);
  if (!section) {
    return;
  }

  section.lastFocusedElement = target;
  section.lastFocusedId = target.dataset.focusId ?? null;
}

function readSectionId(element: FocusableElement): string | null {
  return element.dataset.focusSection ?? null;
}

function getSectionSelector(config: FocusSectionConfig): string {
  return config.selector ?? `[data-focusable="true"][data-focus-section="${escapeAttributeValue(config.id)}"]`;
}

function getSectionRecord(sectionId: string): RegisteredSection | null {
  return sections.get(sectionId) ?? null;
}

function getSectionElements(sectionId: string): FocusableElement[] {
  const section = getSectionRecord(sectionId);
  if (!section || !section.mounted || section.config.disabled) {
    return [];
  }

  return Array.from(document.querySelectorAll<FocusableElement>(getSectionSelector(section.config)))
    .filter((element) => isElementNavigable(element));
}

function getMountedSections(): RegisteredSection[] {
  return Array.from(sections.values())
    .filter((section) => section.mounted && !section.config.disabled && getSectionElements(section.config.id).length > 0)
    .sort((left, right) => left.order - right.order);
}

function isElementNavigable(element: FocusableElement): boolean {
  if (element.hasAttribute('disabled') || element.getAttribute('aria-hidden') === 'true') {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getActiveCapture(): FocusCapture | null {
  return captures[captures.length - 1] ?? null;
}

function looksLikeSelector(target: string): boolean {
  return /^[.#[]/.test(target)
    || /[\s>+~:=]/.test(target)
    || target.includes('"')
    || target.includes("'");
}

function escapeAttributeValue(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }

  return value.replace(/["\\]/g, '\\$&');
}

function getElementRect(element: FocusableElement): FocusRect {
  const rect = element.getBoundingClientRect();
  return {
    element,
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
    centerX: rect.left + rect.width / 2,
    centerY: rect.top + rect.height / 2,
  };
}

function getDirectionalTarget(element: FocusableElement, direction: Direction): string | null {
  switch (direction) {
    case 'left':
      return element.dataset.focusLeft ?? null;
    case 'right':
      return element.dataset.focusRight ?? null;
    case 'up':
      return element.dataset.focusUp ?? null;
    case 'down':
      return element.dataset.focusDown ?? null;
  }
}

function normalizeTarget(target: string): string {
  return target.trim();
}

function resolveFocusableFromElement(element: Element | null): FocusableElement | null {
  if (!element) {
    return null;
  }

  if (element instanceof HTMLElement && isFocusableElement(element)) {
    return element;
  }

  if (element instanceof HTMLElement) {
    return element.querySelector<FocusableElement>(FOCUSABLE_SELECTOR);
  }

  return null;
}

function resolveLastFocused(section: RegisteredSection): FocusableElement | null {
  if (section.lastFocusedElement && section.lastFocusedElement.isConnected && isElementNavigable(section.lastFocusedElement)) {
    return section.lastFocusedElement;
  }

  if (section.lastFocusedId) {
    return document.querySelector<FocusableElement>(
      `${FOCUSABLE_SELECTOR}[data-focus-id="${escapeAttributeValue(section.lastFocusedId)}"]`,
    );
  }

  return null;
}

function resolveSectionEntryElement(sectionId: string): FocusableElement | null {
  const section = getSectionRecord(sectionId);
  if (!section) {
    return null;
  }

  const elements = getSectionElements(sectionId);
  if (elements.length === 0) {
    return null;
  }

  const configuredDefault = section.config.defaultElement
    ? resolveTargetElement(section.config.defaultElement)
    : null;
  const markedDefault = elements.find((element) => element.dataset.focusDefault === 'true') ?? null;
  const defaultElement = configuredDefault ?? markedDefault ?? elements[0] ?? null;

  if (section.config.enterTo === 'last-focused') {
    return resolveLastFocused(section) ?? defaultElement;
  }

  return defaultElement;
}

function resolveTargetElement(target: FocusTarget): FocusableElement | null {
  if (!target) {
    return null;
  }

  if (target instanceof HTMLElement) {
    return resolveFocusableFromElement(target);
  }

  const normalized = normalizeTarget(target);
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith('@')) {
    return resolveSectionEntryElement(normalized.slice(1));
  }

  if (looksLikeSelector(normalized)) {
    const selected = document.querySelector(normalized);
    const focusable = resolveFocusableFromElement(selected);
    if (focusable) {
      return focusable;
    }
  }

  const focusId = normalized.startsWith('#') ? normalized.slice(1) : normalized;
  return document.querySelector<FocusableElement>(
    `${FOCUSABLE_SELECTOR}[data-focus-id="${escapeAttributeValue(focusId)}"]`,
  );
}

function focusElement(element: FocusableElement | null): FocusableElement | null {
  if (!element || !isElementNavigable(element)) {
    return null;
  }

  element.focus({ preventScroll: true });
  ensureElementVisible(element);
  return element;
}

function ensureElementVisible(element: FocusableElement) {
  const rect = element.getBoundingClientRect();
  const isOutsideViewport = rect.top < FOCUS_VISIBILITY_PADDING.top
    || rect.bottom > window.innerHeight - FOCUS_VISIBILITY_PADDING.bottom
    || rect.left < FOCUS_VISIBILITY_PADDING.left
    || rect.right > window.innerWidth - FOCUS_VISIBILITY_PADDING.right;

  if (!isOutsideViewport) {
    return;
  }

  element.scrollIntoView({
    block: 'nearest',
    inline: 'nearest',
    behavior: 'smooth',
  });
}

function focusTarget(target: FocusTarget): FocusableElement | null {
  return focusElement(resolveTargetElement(target));
}

function getCandidateScore(current: FocusRect, next: FocusRect, direction: Direction): number | null {
  let mainAxisDistance = 0;
  let crossAxisDistance = 0;
  let overlap = 0;

  if (direction === 'left') {
    if (next.centerX >= current.centerX) {
      return null;
    }
    mainAxisDistance = current.left - next.right;
    crossAxisDistance = Math.abs(next.centerY - current.centerY);
    overlap = Math.max(0, Math.min(current.bottom, next.bottom) - Math.max(current.top, next.top));
  }

  if (direction === 'right') {
    if (next.centerX <= current.centerX) {
      return null;
    }
    mainAxisDistance = next.left - current.right;
    crossAxisDistance = Math.abs(next.centerY - current.centerY);
    overlap = Math.max(0, Math.min(current.bottom, next.bottom) - Math.max(current.top, next.top));
  }

  if (direction === 'up') {
    if (next.centerY >= current.centerY) {
      return null;
    }
    mainAxisDistance = current.top - next.bottom;
    crossAxisDistance = Math.abs(next.centerX - current.centerX);
    overlap = Math.max(0, Math.min(current.right, next.right) - Math.max(current.left, next.left));
  }

  if (direction === 'down') {
    if (next.centerY <= current.centerY) {
      return null;
    }
    mainAxisDistance = next.top - current.bottom;
    crossAxisDistance = Math.abs(next.centerX - current.centerX);
    overlap = Math.max(0, Math.min(current.right, next.right) - Math.max(current.left, next.left));
  }

  const straightAxisSize = direction === 'left' || direction === 'right'
    ? Math.min(current.height, next.height)
    : Math.min(current.width, next.width);
  const overlapRatio = straightAxisSize > 0 ? overlap / straightAxisSize : 0;
  const overlapPenalty = overlapRatio > 0 ? 0 : 800;

  return (Math.max(0, mainAxisDistance) * 1000) + (crossAxisDistance * 10) + overlapPenalty - Math.round(overlapRatio * 100);
}

function findNextInSection(current: FocusableElement, direction: Direction, sectionId: string): FocusableElement | null {
  const candidates = getSectionElements(sectionId).filter((element) => element !== current);
  if (candidates.length === 0) {
    return null;
  }

  const currentRect = getElementRect(current);
  return candidates
    .map((element) => {
      const score = getCandidateScore(currentRect, getElementRect(element), direction);
      return { element, score };
    })
    .filter((item): item is { element: FocusableElement; score: number } => item.score !== null)
    .sort((left, right) => left.score - right.score)[0]?.element ?? null;
}

function getFocusableSnapshot(): FocusTarget {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !isFocusableElement(active)) {
    return null;
  }

  return active.dataset.focusId ?? active;
}

export function registerSection(config: FocusSectionConfig) {
  ensureInitialized();
  const existing = sections.get(config.id);
  if (existing) {
    existing.config = config;
    existing.mounted = true;
    return;
  }

  sections.set(config.id, {
    config,
    order: orderSeed++,
    mounted: true,
    lastFocusedId: null,
    lastFocusedElement: null,
  });
}

export function unregisterSection(sectionId: string) {
  const section = sections.get(sectionId);
  if (!section) {
    return;
  }

  section.mounted = false;
}

export function isFocusableElement(element: HTMLElement): element is FocusableElement {
  return element.matches(FOCUSABLE_SELECTOR);
}

export function readFocusGroup(element: HTMLElement): FocusGroup {
  if (isFocusableElement(element) && element.dataset.focusGroup) {
    return element.dataset.focusGroup;
  }

  if (isFocusableElement(element)) {
    const sectionId = readSectionId(element);
    if (sectionId) {
      return sections.get(sectionId)?.config.group ?? 'content';
    }
  }

  return 'content';
}

export function focusSection(sectionId: string): FocusableElement | null {
  ensureInitialized();
  return focusElement(resolveSectionEntryElement(sectionId));
}

export function focusFirst({
  preferredGroup = 'content',
  allowFallbackGroup = true,
  sectionId,
}: FocusFirstOptions = {}): FocusableElement | null {
  ensureInitialized();

  const activeCapture = getActiveCapture();
  if (activeCapture) {
    return focusSection(activeCapture.sectionId);
  }

  if (sectionId) {
    const focused = focusSection(sectionId);
    if (focused || !allowFallbackGroup) {
      return focused;
    }
  }

  const sectionsByPreference = getMountedSections();
  const preferredSection = sectionsByPreference.find((section) => section.config.group === preferredGroup);
  if (preferredSection) {
    return focusSection(preferredSection.config.id);
  }

  if (!allowFallbackGroup) {
    return null;
  }

  return focusSection(sectionsByPreference[0]?.config.id ?? '');
}

export function moveFocus(direction: Direction) {
  ensureInitialized();

  const activeCapture = getActiveCapture();
  const activeElement = document.activeElement instanceof HTMLElement && isFocusableElement(document.activeElement)
    ? document.activeElement
    : null;

  if (!activeElement) {
    focusFirst({
      preferredGroup: direction === 'left' ? 'nav' : 'content',
      allowFallbackGroup: direction === 'left',
    });
    return;
  }

  const currentSectionId = readSectionId(activeElement);
  if (activeCapture && currentSectionId !== activeCapture.sectionId) {
    focusSection(activeCapture.sectionId);
    return;
  }

  const explicitTarget = getDirectionalTarget(activeElement, direction);
  if (focusTarget(explicitTarget)) {
    return;
  }

  if (!currentSectionId) {
    focusFirst({
      preferredGroup: direction === 'left' ? 'nav' : 'content',
      allowFallbackGroup: direction === 'left',
    });
    return;
  }

  const nextInSection = findNextInSection(activeElement, direction, currentSectionId);
  if (focusElement(nextInSection)) {
    return;
  }

  const section = getSectionRecord(currentSectionId);
  if (!section) {
    return;
  }

  if (activeCapture) {
    return;
  }

  focusTarget(section.config.leaveFor?.[direction]);
}

export function activateFocused() {
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    active.click();
  }
}

export function captureFocus(options: FocusCaptureOptions) {
  ensureInitialized();

  const existing = captures.find((capture) => capture.sectionId === options.sectionId);
  if (existing) {
    existing.restoreTarget = options.restoreTarget ?? existing.restoreTarget;
  } else {
    captures.push({
      sectionId: options.sectionId,
      restoreTarget: options.restoreTarget ?? getFocusableSnapshot(),
    });
  }

  scheduleFocusWork(() => {
    focusSection(options.sectionId);
  });
}

export function releaseFocus(sectionId: string) {
  ensureInitialized();

  let captureIndex = -1;
  for (let index = captures.length - 1; index >= 0; index -= 1) {
    if (captures[index]?.sectionId === sectionId) {
      captureIndex = index;
      break;
    }
  }

  if (captureIndex < 0) {
    return;
  }

  const wasTopMost = captureIndex === captures.length - 1;
  const [released] = captures.splice(captureIndex, 1);
  if (!wasTopMost) {
    return;
  }

  const nextCapture = getActiveCapture();
  if (nextCapture) {
    scheduleFocusWork(() => {
      focusSection(nextCapture.sectionId);
    });
    return;
  }

  scheduleFocusWork(() => {
    if (!focusTarget(released.restoreTarget)) {
      focusFirst({ preferredGroup: 'content', allowFallbackGroup: true });
    }
  });
}
