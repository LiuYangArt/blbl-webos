import type {
  Direction,
  FocusCaptureOptions,
  FocusFirstOptions,
  FocusGroup,
  FocusScrollAnchor,
  FocusSectionScrollConfig,
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
    focusActive?: string;
    focusPressed?: string;
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
  cachedElements: FocusableElement[] | null;
  cacheDirty: boolean;
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

type FocusViewportComfortZone = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type FocusViewportFrame = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
};

const FOCUSABLE_SELECTOR = '[data-focusable="true"]';
const FOCUS_SCROLL_ROOT_SELECTOR = '[data-focus-scroll-root="true"]';
const FOCUS_PRESS_VISUAL_MS = 120;
const DEFAULT_SECTION_TOP_OFFSET = 88;
const SCROLL_EPSILON = 1;
const sections = new Map<string, RegisteredSection>();
const captures: FocusCapture[] = [];
const pressedStateTimers = new WeakMap<FocusableElement, number>();

let orderSeed = 0;
let initialized = false;
let activeFocusedElement: FocusableElement | null = null;
let sectionMutationObserver: MutationObserver | null = null;

function scheduleFocusWork(callback: () => void): void {
  window.setTimeout(callback, 0);
}

function ensureInitialized() {
  if (initialized || typeof document === 'undefined') {
    return;
  }

  document.addEventListener('focusin', handleFocusIn, true);
  window.addEventListener('blur', clearActiveFocusMarker);
  if (!sectionMutationObserver && document.body) {
    sectionMutationObserver = new MutationObserver(handleSectionMutations);
    sectionMutationObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-focusable', 'data-focus-section'],
    });
  }
  initialized = true;
}

function clearActiveFocusMarker() {
  if (!activeFocusedElement) {
    return;
  }

  delete activeFocusedElement.dataset.focusActive;
  activeFocusedElement = null;
}

function markActiveFocusedElement(element: FocusableElement) {
  if (activeFocusedElement && activeFocusedElement !== element) {
    delete activeFocusedElement.dataset.focusActive;
  }

  element.dataset.focusActive = 'true';
  activeFocusedElement = element;
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

  markActiveFocusedElement(target);
  section.lastFocusedElement = target;
  section.lastFocusedId = target.dataset.focusId ?? null;
  ensureFocusedElementComfort(target);
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

  if (!section.cacheDirty && section.cachedElements) {
    return section.cachedElements;
  }

  const nextElements = Array.from(document.querySelectorAll<FocusableElement>(getSectionSelector(section.config)));
  section.cachedElements = nextElements;
  section.cacheDirty = false;
  return nextElements;
}

function getMountedSections(): RegisteredSection[] {
  return Array.from(sections.values())
    .filter((section) => section.mounted && !section.config.disabled && getNavigableSectionElements(section.config.id).length > 0)
    .sort((left, right) => left.order - right.order);
}

function invalidateSectionCache(sectionId: string): void {
  const section = sections.get(sectionId);
  if (!section) {
    return;
  }

  section.cacheDirty = true;
}

function collectAffectedSectionIds(node: Node, sectionIds: Set<string>): void {
  if (node.nodeType !== 1) {
    return;
  }
  const elementNode = node as HTMLElement;

  const collectFromElement = (element: HTMLElement) => {
    const focusSection = element.dataset.focusSection;
    if (focusSection) {
      sectionIds.add(focusSection);
    }

    const rootSection = element.dataset.focusSectionRoot;
    if (rootSection) {
      sectionIds.add(rootSection);
    }
  };

  collectFromElement(elementNode);
  elementNode.querySelectorAll<HTMLElement>('[data-focus-section], [data-focus-section-root]').forEach(collectFromElement);
}

function handleSectionMutations(records: MutationRecord[]): void {
  const affectedSectionIds = new Set<string>();

  records.forEach((record) => {
    if (record.type === 'attributes' && record.target.nodeType === 1) {
      collectAffectedSectionIds(record.target, affectedSectionIds);
      return;
    }

    record.addedNodes.forEach((node) => collectAffectedSectionIds(node, affectedSectionIds));
    record.removedNodes.forEach((node) => collectAffectedSectionIds(node, affectedSectionIds));
    if (record.target.nodeType === 1) {
      collectAffectedSectionIds(record.target, affectedSectionIds);
    }
  });

  affectedSectionIds.forEach(invalidateSectionCache);
}

function isElementNavigable(
  element: FocusableElement,
  rectCache?: WeakMap<FocusableElement, FocusRect>,
): boolean {
  if (!element.isConnected || element.hasAttribute('disabled') || element.getAttribute('aria-hidden') === 'true') {
    return false;
  }

  const rect = getElementRect(element, rectCache);
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

function getElementRect(
  element: FocusableElement,
  rectCache?: WeakMap<FocusableElement, FocusRect>,
): FocusRect {
  const cachedRect = rectCache?.get(element);
  if (cachedRect) {
    return cachedRect;
  }

  const rect = element.getBoundingClientRect();
  const nextRect = {
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
  rectCache?.set(element, nextRect);
  return nextRect;
}

function getNavigableSectionElements(
  sectionId: string,
  rectCache?: WeakMap<FocusableElement, FocusRect>,
): FocusableElement[] {
  return getSectionElements(sectionId).filter((element) => isElementNavigable(element, rectCache));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getViewportComfortZone(viewportFrame: FocusViewportFrame): FocusViewportComfortZone {
  return {
    top: Math.round(clamp(viewportFrame.height * 0.18, 120, 220)),
    right: Math.round(clamp(viewportFrame.width * 0.03, 24, 64)),
    bottom: Math.round(clamp(viewportFrame.height * 0.16, 120, 200)),
    left: Math.round(clamp(viewportFrame.width * 0.03, 24, 64)),
  };
}

function getDefaultSectionScrollConfig(section: RegisteredSection): Required<FocusSectionScrollConfig> {
  return {
    mode: section.config.group === 'content' ? 'comfort-zone' : 'none',
    anchor: 'focused-element',
    preserveHeaderWhenFirstRowFocused: false,
    topOffset: DEFAULT_SECTION_TOP_OFFSET,
  };
}

function getSectionScrollConfig(section: RegisteredSection): Required<FocusSectionScrollConfig> {
  const defaults = getDefaultSectionScrollConfig(section);
  return {
    mode: section.config.scroll?.mode ?? defaults.mode,
    anchor: section.config.scroll?.anchor ?? defaults.anchor,
    preserveHeaderWhenFirstRowFocused: section.config.scroll?.preserveHeaderWhenFirstRowFocused
      ?? defaults.preserveHeaderWhenFirstRowFocused,
    topOffset: section.config.scroll?.topOffset ?? defaults.topOffset,
  };
}

function getSectionRootElement(sectionId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-focus-section-root="${escapeAttributeValue(sectionId)}"]`);
}

function getDocumentScrollElement(): HTMLElement | null {
  return document.scrollingElement instanceof HTMLElement
    ? document.scrollingElement
    : document.documentElement instanceof HTMLElement
      ? document.documentElement
      : null;
}

function getScrollRoot(element: HTMLElement): HTMLElement | null {
  return element.closest<HTMLElement>(FOCUS_SCROLL_ROOT_SELECTOR);
}

function readViewportScrollTop(scrollRoot: HTMLElement | null): number {
  if (scrollRoot) {
    return scrollRoot.scrollTop;
  }

  const scrollElement = getDocumentScrollElement();
  return scrollElement?.scrollTop ?? window.scrollY ?? 0;
}

function getViewportMaxScrollTop(scrollRoot: HTMLElement | null): number {
  if (scrollRoot) {
    return Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight);
  }

  const scrollElement = getDocumentScrollElement();
  if (!scrollElement) {
    return 0;
  }

  return Math.max(0, scrollElement.scrollHeight - window.innerHeight);
}

function scrollViewportTo(scrollRoot: HTMLElement | null, top: number): boolean {
  const clampedTop = clamp(top, 0, getViewportMaxScrollTop(scrollRoot));
  const currentTop = readViewportScrollTop(scrollRoot);
  if (Math.abs(clampedTop - currentTop) < SCROLL_EPSILON) {
    return false;
  }

  if (scrollRoot) {
    if (typeof scrollRoot.scrollTo === 'function') {
      scrollRoot.scrollTo({
        top: clampedTop,
        left: scrollRoot.scrollLeft ?? 0,
        behavior: 'auto',
      });
    } else {
      scrollRoot.scrollTop = clampedTop;
    }
    return true;
  }

  window.scrollTo({
    top: clampedTop,
    left: window.scrollX,
    behavior: 'auto',
  });
  return true;
}

function scrollViewportBy(scrollRoot: HTMLElement | null, deltaY: number): boolean {
  if (Math.abs(deltaY) < SCROLL_EPSILON) {
    return false;
  }

  return scrollViewportTo(scrollRoot, readViewportScrollTop(scrollRoot) + deltaY);
}

function getViewportFrame(scrollRoot: HTMLElement | null): FocusViewportFrame {
  if (scrollRoot) {
    const rect = scrollRoot.getBoundingClientRect();
    return {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
  }

  return {
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
    left: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function getSectionAnchorElement(sectionId: string, anchor: FocusScrollAnchor, focusedElement: FocusableElement): HTMLElement | null {
  if (anchor === 'focused-element') {
    return focusedElement;
  }

  const sectionRoot = getSectionRootElement(sectionId);
  if (!sectionRoot) {
    return focusedElement;
  }

  if (anchor === 'section-header') {
    return sectionRoot.querySelector<HTMLElement>('.section-header') ?? sectionRoot;
  }

  return sectionRoot;
}

function isFirstRowFocused(element: FocusableElement, sectionId: string): boolean {
  const rectCache = new WeakMap<FocusableElement, FocusRect>();
  const elements = getNavigableSectionElements(sectionId, rectCache);
  if (elements.length <= 1) {
    return true;
  }

  const elementRect = getElementRect(element, rectCache);
  let firstRowTop = Number.POSITIVE_INFINITY;
  elements.forEach((candidate) => {
    const candidateTop = getElementRect(candidate, rectCache).top;
    if (candidateTop < firstRowTop) {
      firstRowTop = candidateTop;
    }
  });
  const rowTolerance = Math.max(28, Math.min(72, Math.round(elementRect.height * 0.2)));

  return elementRect.top <= firstRowTop + rowTolerance;
}

function alignSectionAnchorIntoView(
  sectionId: string,
  config: Required<FocusSectionScrollConfig>,
  focusedElement: FocusableElement,
): boolean {
  const anchorElement = getSectionAnchorElement(sectionId, config.anchor, focusedElement);
  if (!(anchorElement instanceof HTMLElement)) {
    return false;
  }

  const scrollRoot = getScrollRoot(focusedElement);
  const viewportFrame = getViewportFrame(scrollRoot);
  const anchorRect = anchorElement.getBoundingClientRect();
  return scrollViewportBy(scrollRoot, anchorRect.top - (viewportFrame.top + config.topOffset));
}

function ensureFocusedElementComfort(element: FocusableElement): void {
  const sectionId = readSectionId(element);
  const section = sectionId ? getSectionRecord(sectionId) : null;
  if (!section) {
    return;
  }

  const scrollConfig = getSectionScrollConfig(section);
  if (scrollConfig.mode === 'none') {
    return;
  }

  if (
    sectionId
    && scrollConfig.preserveHeaderWhenFirstRowFocused
    && isFirstRowFocused(element, sectionId)
    && alignSectionAnchorIntoView(sectionId, scrollConfig, element)
  ) {
    return;
  }

  const scrollRoot = getScrollRoot(element);
  const viewportFrame = getViewportFrame(scrollRoot);
  const rect = getElementRect(element);
  const comfortZone = getViewportComfortZone(viewportFrame);
  const comfortTop = viewportFrame.top + comfortZone.top;
  const comfortLeft = viewportFrame.left + comfortZone.left;
  const maxComfortRight = viewportFrame.right - comfortZone.right;
  const maxComfortBottom = viewportFrame.bottom - comfortZone.bottom;
  const horizontalOverflow = rect.left < comfortLeft || rect.right > maxComfortRight;

  if (rect.top < comfortTop) {
    scrollViewportBy(scrollRoot, rect.top - comfortTop);
  } else if (rect.bottom > maxComfortBottom) {
    scrollViewportBy(scrollRoot, rect.bottom - maxComfortBottom);
  } else if (horizontalOverflow) {
    element.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'auto',
    });
  }
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

  if (document.activeElement === element) {
    ensureFocusedElementComfort(element);
    return element;
  }

  element.focus({ preventScroll: true });
  ensureFocusedElementComfort(element);
  return element;
}

function focusTarget(target: FocusTarget): FocusableElement | null {
  return focusElement(resolveTargetElement(target));
}

function flashPressedState(element: FocusableElement) {
  const existingTimer = pressedStateTimers.get(element);
  if (typeof existingTimer === 'number') {
    window.clearTimeout(existingTimer);
  }

  element.dataset.focusPressed = 'true';

  const nextTimer = window.setTimeout(() => {
    delete element.dataset.focusPressed;
    pressedStateTimers.delete(element);
  }, FOCUS_PRESS_VISUAL_MS);

  pressedStateTimers.set(element, nextTimer);
}

export function focusById(focusId: string): FocusableElement | null {
  return focusTarget(focusId);
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
  const rectCache = new WeakMap<FocusableElement, FocusRect>();
  const candidates = getNavigableSectionElements(sectionId, rectCache).filter((element) => element !== current);
  if (candidates.length === 0) {
    return null;
  }

  const currentRect = getElementRect(current, rectCache);
  let bestElement: FocusableElement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  candidates.forEach((element) => {
    const score = getCandidateScore(currentRect, getElementRect(element, rectCache), direction);
    if (score === null || score >= bestScore) {
      return;
    }

    bestScore = score;
    bestElement = element;
  });

  return bestElement;
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
    existing.cacheDirty = true;
    return;
  }

  sections.set(config.id, {
    config,
    order: orderSeed++,
    mounted: true,
    lastFocusedId: null,
    lastFocusedElement: null,
    cachedElements: null,
    cacheDirty: true,
  });
}

export function unregisterSection(sectionId: string) {
  const section = sections.get(sectionId);
  if (!section) {
    return;
  }

  section.mounted = false;
  section.cachedElements = null;
  section.cacheDirty = true;
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

  if (focusTarget(section.config.leaveFor?.[direction])) {
    return;
  }

  if (direction === 'right' && readFocusGroup(activeElement) === 'nav') {
    focusFirst({ preferredGroup: 'content', allowFallbackGroup: false });
  }
}

export function activateFocused() {
  const active = document.activeElement;
  if (active instanceof HTMLElement && isFocusableElement(active)) {
    flashPressedState(active);
    active.click();
    return;
  }

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
