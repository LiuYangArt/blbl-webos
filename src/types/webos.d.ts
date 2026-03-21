export {};

declare global {
  interface Window {
    PalmSystem?: {
      platformBack?: () => void;
    };
    webOS?: {
      platformBack?: () => void;
      keyboard?: {
        isShowing?: () => boolean;
      };
      deviceInfo?: (callback: (device: Record<string, unknown>) => void) => void;
      fetchAppRootPath?: () => string;
    };
  }
}
