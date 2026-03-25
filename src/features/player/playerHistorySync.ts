import { reportVideoHeartbeat, reportVideoHistoryProgress } from '../../services/api/bilibili';
import {
  RelayApiError,
  reportRelayHeartbeat,
  reportRelayHistoryProgress,
} from '../../services/relay/client';
import { hasRelayConfiguration, readRelaySettings } from '../../services/relay/settings';

export type PlayerHistorySyncResult = {
  path: 'relay' | 'direct';
  relayAttempted: boolean;
  relayFallbackReason: string | null;
};

type RelayFallbackActionResult = {
  path: 'relay' | 'direct';
  relayAttempted: boolean;
  relayFallbackReason: string | null;
};

export async function syncPlayerHistoryHeartbeat(options: {
  aid?: number;
  bvid: string;
  cid: number;
  playedTime: number;
}): Promise<PlayerHistorySyncResult> {
  const fallback = await runWithRelayFallback(
    () => reportRelayHeartbeat(readRelaySettings(), options),
    () => reportVideoHeartbeat(options),
  );

  return {
    path: fallback.path,
    relayAttempted: fallback.relayAttempted,
    relayFallbackReason: fallback.relayFallbackReason,
  };
}

export async function syncPlayerHistoryProgress(options: {
  aid: number;
  cid: number;
  progress: number;
}): Promise<PlayerHistorySyncResult> {
  const fallback = await runWithRelayFallback(
    () => reportRelayHistoryProgress(readRelaySettings(), options),
    () => reportVideoHistoryProgress(options),
  );

  return {
    path: fallback.path,
    relayAttempted: fallback.relayAttempted,
    relayFallbackReason: fallback.relayFallbackReason,
  };
}

async function runWithRelayFallback(
  relayAction: () => Promise<unknown>,
  directAction: () => Promise<unknown>,
): Promise<RelayFallbackActionResult> {
  const settings = readRelaySettings();
  if (!settings.enabled || !hasRelayConfiguration(settings)) {
    await directAction();
    return {
      path: 'direct',
      relayAttempted: false,
      relayFallbackReason: settings.enabled ? 'relay not configured' : 'relay disabled',
    };
  }

  try {
    await relayAction();
    return {
      path: 'relay',
      relayAttempted: false,
      relayFallbackReason: null,
    };
  } catch (relayError) {
    try {
      await directAction();
    } catch (directError) {
      throw new Error(buildDualFailureMessage(relayError, directError));
    }

    return {
      path: 'direct',
      relayAttempted: true,
      relayFallbackReason: mapRelayFallbackReason(relayError),
    };
  }
}

function buildDualFailureMessage(relayError: unknown, directError: unknown) {
  const relayMessage = relayError instanceof Error ? relayError.message : String(relayError);
  const directMessage = directError instanceof Error ? directError.message : String(directError);
  return `relay 历史上报失败后，本地兜底也失败：relay=${relayMessage}；direct=${directMessage}`;
}

function mapRelayFallbackReason(error: unknown) {
  if (!(error instanceof RelayApiError)) {
    return 'relay request failed';
  }

  switch (error.kind) {
    case 'auth_missing':
      return 'relay auth missing';
    case 'auth_expired':
      return 'relay auth expired';
    case 'auth_mismatch':
      return 'relay auth mismatch';
    case 'bad_payload':
      return 'relay bad payload';
    case 'timeout':
      return 'relay timeout';
    default:
      return 'relay request failed';
  }
}
