import { readDebugTelemetryUrl } from '../../app/launchParams';

export type PlayerDebugEvent = {
  type: 'environment' | 'loadedmetadata' | 'play' | 'progress' | 'error' | 'audio-only-detected' | 'attempt-switch';
  bvid: string;
  cid: number;
  sourceUrl: string;
  quality: string;
  codec: string;
  mimeType?: string;
  sourceTypeLabel?: string;
  message?: string;
  code?: number | null;
  currentTime?: number;
  videoWidth?: number;
  videoHeight?: number;
  decodedVideoFrames?: number | null;
  attemptId?: string;
  attemptIndex?: number;
  candidateUrlIndex?: number;
  details?: Record<string, unknown>;
};

let cachedTelemetryUrl: string | null | undefined;

function getTelemetryUrl() {
  if (cachedTelemetryUrl !== undefined) {
    return cachedTelemetryUrl;
  }

  cachedTelemetryUrl = readDebugTelemetryUrl();
  return cachedTelemetryUrl;
}

export function reportPlayerDebugEvent(event: PlayerDebugEvent) {
  const url = getTelemetryUrl();
  if (!url) {
    return;
  }

  void fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      ...event,
      timestamp: new Date().toISOString(),
    }),
  }).catch(() => {
    // 调试 telemetry 失败不应影响真实播放链路。
  });
}
