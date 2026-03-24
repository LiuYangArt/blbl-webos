import { describe, expect, it } from 'vitest';
import {
  isSearchComposerKeyboardSessionOpen,
  resolveSearchComposerBlurDecision,
  shouldKeepSearchComposerKeyboardSessionLocked,
} from './searchComposerKeyboardSession';

describe('searchComposerKeyboardSession', () => {
  it('在键盘可见时保持打开', () => {
    expect(isSearchComposerKeyboardSessionOpen({
      keyboardVisible: true,
      keyboardInset: 0,
      keyboardIntentAt: null,
      now: 1_000,
    })).toBe(true);
  });

  it('在视觉视口已缩小时保持打开', () => {
    expect(isSearchComposerKeyboardSessionOpen({
      keyboardVisible: false,
      keyboardInset: 180,
      keyboardIntentAt: null,
      now: 1_000,
    })).toBe(true);
  });

  it('在键盘刚接管焦点的宽限期内保持打开', () => {
    expect(isSearchComposerKeyboardSessionOpen({
      keyboardVisible: false,
      keyboardInset: 0,
      keyboardIntentAt: 500,
      now: 1_000,
    })).toBe(true);
  });

  it('宽限期结束后会关闭', () => {
    expect(isSearchComposerKeyboardSessionOpen({
      keyboardVisible: false,
      keyboardInset: 0,
      keyboardIntentAt: 0,
      now: 1_200,
    })).toBe(false);
  });

  it('切到同一输入面板内的下一个输入框时交给新输入框', () => {
    expect(resolveSearchComposerBlurDecision({
      keyboardSafeMode: true,
      nextFocusKind: 'composer-input',
      keyboardVisible: false,
      keyboardInset: 0,
      keyboardIntentAt: 100,
      now: 400,
    })).toBe('handoff');
  });

  it('系统键盘接管焦点时保留当前输入会话', () => {
    expect(resolveSearchComposerBlurDecision({
      keyboardSafeMode: true,
      nextFocusKind: 'other',
      keyboardVisible: false,
      keyboardInset: 0,
      keyboardIntentAt: 100,
      now: 400,
    })).toBe('keep-session');
  });

  it('切到其它遥控器控件时立即关闭输入会话', () => {
    expect(resolveSearchComposerBlurDecision({
      keyboardSafeMode: true,
      nextFocusKind: 'focusable-control',
      keyboardVisible: true,
      keyboardInset: 180,
      keyboardIntentAt: 100,
      now: 400,
    })).toBe('close-session');
  });

  it('系统键盘接管后，在没有明确收起前保持锁定展开', () => {
    expect(shouldKeepSearchComposerKeyboardSessionLocked({
      sessionLocked: true,
      dismissRequested: false,
      nextFocusKind: 'other',
    })).toBe(true);
  });

  it('收到收键盘信号后解除锁定', () => {
    expect(shouldKeepSearchComposerKeyboardSessionLocked({
      sessionLocked: true,
      dismissRequested: true,
      nextFocusKind: 'other',
    })).toBe(false);
  });

  it('焦点切到别的控件时不再保持锁定展开', () => {
    expect(shouldKeepSearchComposerKeyboardSessionLocked({
      sessionLocked: true,
      dismissRequested: false,
      nextFocusKind: 'focusable-control',
    })).toBe(false);
  });
});
