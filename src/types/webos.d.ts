export {};

declare global {
  interface Window {
    launchParams?: string;
    PalmSystem?: {
      platformBack?: () => void;
    };
    webOS?: {
      platformBack?: () => void;
      keyboard?: {
        isShowing?: () => boolean;
      };
      deviceInfo?: (callback: (device: {
        modelName?: string;
        model_name?: string;
        sdkVersion?: string;
        sdk_version?: string;
        platformVersion?: string;
        platform_version?: string;
        [key: string]: unknown;
      }) => void) => void;
      fetchAppRootPath?: () => string;
    };
  }
}
