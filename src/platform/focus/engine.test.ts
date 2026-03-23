import { beforeEach, describe, expect, it, vi } from 'vitest';

function setElementRect(
  element: HTMLElement,
  rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  },
) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => rect,
    }),
  });
}

function createSectionRoot(config: {
  id: string;
  top: number;
  left?: number;
  width?: number;
  height?: number;
  headerTop?: number;
  headerHeight?: number;
}) {
  const section = document.createElement('section');
  section.dataset.focusSectionRoot = config.id;
  setElementRect(section, {
    left: config.left ?? 0,
    top: config.top,
    width: config.width ?? 1200,
    height: config.height ?? 360,
  });

  const header = document.createElement('div');
  header.className = 'section-header';
  setElementRect(header, {
    left: config.left ?? 0,
    top: config.headerTop ?? config.top + 28,
    width: config.width ?? 1200,
    height: config.headerHeight ?? 80,
  });
  section.appendChild(header);
  document.body.appendChild(section);
  return { section, header };
}

function createScrollRoot(config?: {
  top?: number;
  left?: number;
  width?: number;
  height?: number;
  scrollHeight?: number;
}) {
  const root = document.createElement('div');
  root.dataset.focusScrollRoot = 'true';
  root.scrollTo = vi.fn();
  Object.defineProperty(root, 'clientHeight', {
    configurable: true,
    value: config?.height ?? 720,
  });
  Object.defineProperty(root, 'clientWidth', {
    configurable: true,
    value: config?.width ?? 1440,
  });
  Object.defineProperty(root, 'scrollHeight', {
    configurable: true,
    value: config?.scrollHeight ?? 2400,
  });
  Object.defineProperty(root, 'scrollLeft', {
    configurable: true,
    writable: true,
    value: 0,
  });
  Object.defineProperty(root, 'scrollTop', {
    configurable: true,
    writable: true,
    value: 0,
  });
  setElementRect(root, {
    left: config?.left ?? 120,
    top: config?.top ?? 140,
    width: config?.width ?? 1440,
    height: config?.height ?? 720,
  });
  document.body.appendChild(root);
  return root;
}

function createFocusableButton(config: {
  id: string;
  section: string;
  left: number;
  top: number;
  width?: number;
  height?: number;
  group?: string;
  default?: boolean;
  right?: string;
  text?: string;
  container?: HTMLElement;
}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = config.text ?? config.id;
  button.tabIndex = -1;
  button.dataset.focusable = 'true';
  button.dataset.focusId = config.id;
  button.dataset.focusSection = config.section;
  if (config.group) {
    button.dataset.focusGroup = config.group;
  }
  if (config.default) {
    button.dataset.focusDefault = 'true';
  }
  if (config.right) {
    button.dataset.focusRight = config.right;
  }
  button.scrollIntoView = vi.fn();
  setElementRect(button, {
    left: config.left,
    top: config.top,
    width: config.width ?? 120,
    height: config.height ?? 60,
  });
  (config.container ?? document.body).appendChild(button);
  return button;
}

async function loadEngineModule() {
  vi.resetModules();
  return import('./engine');
}

describe('focus engine', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
    window.scrollTo = vi.fn();
    Object.defineProperty(document.documentElement, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 0,
    });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: 3000,
    });
  });

  it('focusFirst 优先聚焦目标分组里的默认元素', async () => {
    const engine = await loadEngineModule();

    createFocusableButton({ id: 'nav-home', section: 'nav', left: 0, top: 0, group: 'nav', default: true });
    createFocusableButton({ id: 'content-hero', section: 'content', left: 400, top: 0, default: true });

    engine.registerSection({ id: 'nav', group: 'nav' });
    engine.registerSection({ id: 'content', group: 'content' });

    const focused = engine.focusFirst({ preferredGroup: 'content' });

    expect(focused?.dataset.focusId).toBe('content-hero');
    expect(document.activeElement).toBe(focused);
  });

  it('moveFocus 按几何关系在同 section 内选择最近目标', async () => {
    const engine = await loadEngineModule();

    const current = createFocusableButton({ id: 'card-1', section: 'content', left: 400, top: 100, default: true });
    createFocusableButton({ id: 'card-2', section: 'content', left: 560, top: 110 });
    createFocusableButton({ id: 'card-3', section: 'content', left: 560, top: 260 });

    engine.registerSection({ id: 'content', group: 'content' });
    current.focus();

    engine.moveFocus('right');

    expect((document.activeElement as HTMLElement | null)?.dataset.focusId).toBe('card-2');
  });

  it('显式方向目标优先于自动几何寻路', async () => {
    const engine = await loadEngineModule();

    const current = createFocusableButton({ id: 'card-1', section: 'content', left: 400, top: 100, default: true, right: 'card-3' });
    createFocusableButton({ id: 'card-2', section: 'content', left: 560, top: 100 });
    createFocusableButton({ id: 'card-3', section: 'content', left: 900, top: 300 });

    engine.registerSection({ id: 'content', group: 'content' });
    current.focus();

    engine.moveFocus('right');

    expect((document.activeElement as HTMLElement | null)?.dataset.focusId).toBe('card-3');
  });

  it('侧边导航按右键时会进入内容区首个可聚焦元素', async () => {
    const engine = await loadEngineModule();

    const nav = createFocusableButton({
      id: 'nav-home',
      section: 'side-nav',
      left: 0,
      top: 0,
      group: 'nav',
      default: true,
    });
    createFocusableButton({
      id: 'content-hero',
      section: 'content',
      left: 400,
      top: 0,
      group: 'content',
      default: true,
    });

    engine.registerSection({ id: 'side-nav', group: 'nav', enterTo: 'last-focused' });
    engine.registerSection({ id: 'content', group: 'content' });
    nav.focus();

    engine.moveFocus('right');

    expect((document.activeElement as HTMLElement | null)?.dataset.focusId).toBe('content-hero');
  });

  it('captureFocus 和 releaseFocus 会把焦点锁到 overlay，并在释放后恢复', async () => {
    const engine = await loadEngineModule();

    const content = createFocusableButton({ id: 'content-hero', section: 'content', left: 400, top: 0, default: true });
    createFocusableButton({ id: 'overlay-close', section: 'overlay', left: 700, top: 200, default: true });

    engine.registerSection({ id: 'content', group: 'content' });
    engine.registerSection({ id: 'overlay', group: 'overlay' });

    content.focus();
    engine.captureFocus({ sectionId: 'overlay' });
    vi.runAllTimers();

    expect((document.activeElement as HTMLElement | null)?.dataset.focusId).toBe('overlay-close');

    engine.releaseFocus('overlay');
    vi.runAllTimers();

    expect((document.activeElement as HTMLElement | null)?.dataset.focusId).toBe('content-hero');
  });

  it('activateFocused 会触发点击并短暂写入 focusPressed 标记', async () => {
    const engine = await loadEngineModule();

    const button = createFocusableButton({ id: 'play', section: 'content', left: 400, top: 0, default: true });
    const onClick = vi.fn();
    button.addEventListener('click', onClick);
    engine.registerSection({ id: 'content', group: 'content' });

    button.focus();
    engine.activateFocused();

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(button.dataset.focusPressed).toBe('true');

    vi.advanceTimersByTime(120);

    expect(button.dataset.focusPressed).toBeUndefined();
  });

  it('焦点落到舒适区外时会触发统一纵向滚动', async () => {
    const engine = await loadEngineModule();

    const button = createFocusableButton({
      id: 'deep-card',
      section: 'content',
      left: 400,
      top: 720,
      height: 72,
      default: true,
    });

    engine.registerSection({ id: 'content', group: 'content' });
    button.focus();

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 147,
      left: 0,
      behavior: 'auto',
    });
  });

  it('首行焦点启用保头部后会优先按 section 锚点回滚', async () => {
    const engine = await loadEngineModule();
    const { section } = createSectionRoot({
      id: 'content',
      top: 320,
      headerTop: 348,
      height: 420,
    });

    const button = createFocusableButton({
      id: 'section-first-row',
      section: 'content',
      left: 420,
      top: 420,
      default: true,
      container: section,
    });

    engine.registerSection({
      id: 'content',
      group: 'content',
      scroll: {
        preserveHeaderWhenFirstRowFocused: true,
        anchor: 'section-start',
        topOffset: 96,
      },
    });

    button.focus();

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 224,
      left: 0,
      behavior: 'auto',
    });
  });

  it('存在内容滚动容器时会优先滚动容器而不是 window', async () => {
    const engine = await loadEngineModule();
    const scrollRoot = createScrollRoot();

    const button = createFocusableButton({
      id: 'scroll-root-card',
      section: 'content',
      left: 360,
      top: 760,
      height: 72,
      default: true,
      container: scrollRoot,
    });

    engine.registerSection({ id: 'content', group: 'content' });
    button.focus();

    expect(scrollRoot.scrollTo).toHaveBeenCalledWith({
      top: 92,
      left: 0,
      behavior: 'auto',
    });
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('moveFocus 进入滚动容器中的下一项时也会主动推动容器滚动', async () => {
    const engine = await loadEngineModule();
    const scrollRoot = createScrollRoot();

    const first = createFocusableButton({
      id: 'grid-card-1',
      section: 'content',
      left: 360,
      top: 220,
      height: 72,
      default: true,
      container: scrollRoot,
    });
    createFocusableButton({
      id: 'grid-card-2',
      section: 'content',
      left: 360,
      top: 860,
      height: 72,
      container: scrollRoot,
    });

    engine.registerSection({ id: 'content', group: 'content' });
    first.focus();
    vi.clearAllMocks();

    engine.moveFocus('down');

    expect((document.activeElement as HTMLElement | null)?.dataset.focusId).toBe('grid-card-2');
    expect(scrollRoot.scrollTo).toHaveBeenCalledWith({
      top: 192,
      left: 0,
      behavior: 'auto',
    });
  });
});
