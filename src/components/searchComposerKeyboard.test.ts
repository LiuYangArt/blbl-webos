import { describe, expect, it } from 'vitest';
import { computeComposerKeyboardPlan } from './searchComposerKeyboard';

describe('computeComposerKeyboardPlan', () => {
  it('输入框已经在安全区域内时不追加滚动', () => {
    const plan = computeComposerKeyboardPlan({
      inputTop: 200,
      inputBottom: 260,
      scrollRootTop: 80,
      scrollRootBottom: 900,
      scrollTop: 120,
      scrollHeight: 1600,
      clientHeight: 820,
      innerHeight: 1080,
      visualViewportHeight: null,
      visualViewportOffsetTop: null,
      keyboardVisible: false,
      assumeKeyboardVisible: false,
      fallbackKeyboardInset: 0,
    });

    expect(plan.keyboardInset).toBe(0);
    expect(plan.scrollDelta).toBe(0);
    expect(plan.extraBottomPadding).toBe(0);
  });

  it('visualViewport 收缩时会把输入框滚到键盘上方', () => {
    const plan = computeComposerKeyboardPlan({
      inputTop: 760,
      inputBottom: 832,
      scrollRootTop: 120,
      scrollRootBottom: 980,
      scrollTop: 240,
      scrollHeight: 1800,
      clientHeight: 860,
      innerHeight: 1080,
      visualViewportHeight: 700,
      visualViewportOffsetTop: 0,
      keyboardVisible: true,
      assumeKeyboardVisible: true,
      fallbackKeyboardInset: 320,
    });

    expect(plan.keyboardInset).toBe(380);
    expect(plan.visibleBottom).toBe(676);
    expect(plan.scrollDelta).toBe(156);
    expect(plan.extraBottomPadding).toBe(0);
  });

  it('底部没有剩余可滚空间时会补出额外底部留白', () => {
    const plan = computeComposerKeyboardPlan({
      inputTop: 760,
      inputBottom: 840,
      scrollRootTop: 120,
      scrollRootBottom: 980,
      scrollTop: 720,
      scrollHeight: 1600,
      clientHeight: 860,
      innerHeight: 1080,
      visualViewportHeight: 760,
      visualViewportOffsetTop: 0,
      keyboardVisible: true,
      assumeKeyboardVisible: true,
      fallbackKeyboardInset: 320,
    });

    expect(plan.scrollDelta).toBe(104);
    expect(plan.extraBottomPadding).toBe(108);
  });

  it('webOS 键盘未触发 viewport 缩小时会回退到保守 inset', () => {
    const plan = computeComposerKeyboardPlan({
      inputTop: 700,
      inputBottom: 780,
      scrollRootTop: 120,
      scrollRootBottom: 980,
      scrollTop: 120,
      scrollHeight: 1800,
      clientHeight: 860,
      innerHeight: 1080,
      visualViewportHeight: 1080,
      visualViewportOffsetTop: 0,
      keyboardVisible: false,
      assumeKeyboardVisible: true,
      fallbackKeyboardInset: 320,
    });

    expect(plan.keyboardInset).toBe(320);
    expect(plan.visibleBottom).toBe(736);
    expect(plan.scrollDelta).toBe(44);
  });
});
