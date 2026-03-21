export const REMOTE_KEYS = {
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  ENTER: 13,
  BACK: 461,
} as const;

export function isWebOSAvailable() {
  return typeof window !== 'undefined' && typeof window.webOS !== 'undefined';
}

export function platformBack() {
  if (window.webOS?.platformBack) {
    window.webOS.platformBack();
    return;
  }

  if (window.PalmSystem?.platformBack) {
    window.PalmSystem.platformBack();
    return;
  }

  if (window.history.length > 1) {
    window.history.back();
  }
}

export function getKeyboardVisible() {
  return window.webOS?.keyboard?.isShowing?.() ?? false;
}

export function readDeviceInfo() {
  return new Promise<Record<string, unknown> | null>((resolve) => {
    if (!window.webOS?.deviceInfo) {
      resolve(null);
      return;
    }

    window.webOS.deviceInfo((device) => {
      resolve(device);
    });
  });
}
