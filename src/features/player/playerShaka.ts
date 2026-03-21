import shaka from 'shaka-player/dist/shaka-player.dash.js';

export type PlayerShakaError = {
  code: number | null;
  message: string;
};

type PlayerShakaSession = {
  load: (manifestUrl: string) => Promise<void>;
  destroy: () => Promise<void>;
};

let installed = false;

export async function createShakaPlayer(
  video: HTMLVideoElement,
  onError: (error: PlayerShakaError) => void,
): Promise<PlayerShakaSession> {
  ensureShakaReady();

  if (!shaka.Player.isBrowserSupported()) {
    throw new Error('当前设备不支持 Shaka 所需的 DASH/MSE 播放能力。');
  }

  const player = new shaka.Player(video);
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ detail?: unknown }>).detail ?? null;
    onError(formatShakaError(detail));
  };

  player.addEventListener('error', listener);
  player.configure({
    abr: {
      enabled: false,
    },
    streaming: {
      bufferingGoal: 30,
      rebufferingGoal: 2,
      retryParameters: {
        maxAttempts: 1,
      },
    },
  });

  return {
    load: async (manifestUrl: string) => {
      await player.load(manifestUrl);
    },
    destroy: async () => {
      player.removeEventListener('error', listener);
      await player.destroy();
    },
  };
}

export function formatShakaError(error: unknown): PlayerShakaError {
  const shakaError = error as {
    code?: number;
    data?: unknown[];
    message?: string;
    severity?: number;
  } | null;
  const dataMessage = Array.isArray(shakaError?.data) && shakaError.data.length > 0
    ? ` (${shakaError.data.map((item) => String(item)).join(', ')})`
    : '';
  return {
    code: typeof shakaError?.code === 'number' ? shakaError.code : null,
    message: shakaError?.message
      ? `${shakaError.message}${dataMessage}`
      : `Shaka 播放失败${dataMessage}`,
  };
}

function ensureShakaReady(): void {
  if (installed) {
    return;
  }

  shaka.polyfill.installAll();
  installed = true;
}
