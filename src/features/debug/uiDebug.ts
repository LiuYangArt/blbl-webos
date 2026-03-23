export const UI_DEBUG_SHORTCUT_LABEL = 'Ctrl + Alt + Shift + U';
export const UI_DEBUG_DIRECT_ROUTE = '?route=ui-debug';
export const UI_DEBUG_DIRECT_FLAG = '?uiDebug=1';

export function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target.isContentEditable;
}

export function matchesUiDebugShortcut(event: KeyboardEvent): boolean {
  return event.code === 'KeyU'
    && event.ctrlKey
    && event.altKey
    && event.shiftKey
    && !event.metaKey;
}
