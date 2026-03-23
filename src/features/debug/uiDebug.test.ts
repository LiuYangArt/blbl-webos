import { describe, expect, it } from 'vitest';
import { isEditableElement, matchesUiDebugShortcut } from './uiDebug';

describe('uiDebug helpers', () => {
  it('只在 Ctrl + Alt + Shift + U 时命中 UI Debug 快捷键', () => {
    const matchedEvent = new KeyboardEvent('keydown', {
      code: 'KeyU',
      ctrlKey: true,
      altKey: true,
      shiftKey: true,
    });
    const unmatchedEvent = new KeyboardEvent('keydown', {
      code: 'KeyU',
      ctrlKey: true,
      shiftKey: true,
    });

    expect(matchesUiDebugShortcut(matchedEvent)).toBe(true);
    expect(matchesUiDebugShortcut(unmatchedEvent)).toBe(false);
  });

  it('包含 Meta 时不命中，避免和常见浏览器快捷键混淆', () => {
    const event = new KeyboardEvent('keydown', {
      code: 'KeyU',
      ctrlKey: true,
      altKey: true,
      shiftKey: true,
      metaKey: true,
    });

    expect(matchesUiDebugShortcut(event)).toBe(false);
  });

  it('能识别输入框与可编辑区域，避免输入时误触调试页', () => {
    const input = document.createElement('input');
    const editable = document.createElement('div');
    Object.defineProperty(editable, 'isContentEditable', {
      configurable: true,
      value: true,
    });
    const plain = document.createElement('button');

    expect(isEditableElement(input)).toBe(true);
    expect(isEditableElement(editable)).toBe(true);
    expect(isEditableElement(plain)).toBe(false);
  });
});
