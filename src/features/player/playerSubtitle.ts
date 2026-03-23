import type { PlaySubtitleTrack } from '../../services/api/types';

type RawSubtitleCue = {
  from?: number;
  to?: number;
  content?: string;
  sid?: number;
};

export function formatSubtitleTimecode(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const wholeSeconds = safeSeconds % 60;
  const secondsText = wholeSeconds.toFixed(3).padStart(6, '0');
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${secondsText}`;
}

export function convertSubtitleBodyToVtt(body: RawSubtitleCue[]): string {
  const cues = body
    .map((item, index) => {
      const from = Number(item.from ?? 0);
      const to = Number(item.to ?? from);
      const content = String(item.content ?? '').trim();
      if (!content) {
        return null;
      }

      return [
        String(item.sid ?? index + 1),
        `${formatSubtitleTimecode(from)} --> ${formatSubtitleTimecode(to)}`,
        content,
      ].join('\n');
    })
    .filter((item): item is string => Boolean(item));

  return `WEBVTT\n\n${cues.join('\n\n')}`;
}

export function extractSubtitleBody(payload: unknown): RawSubtitleCue[] {
  const body = (payload as { body?: unknown } | null)?.body;
  return Array.isArray(body) ? body as RawSubtitleCue[] : [];
}

export function pickDefaultSubtitleTrack(tracks: PlaySubtitleTrack[]): PlaySubtitleTrack | null {
  if (!tracks.length) {
    return null;
  }

  const normalizedTracks = tracks.filter((track) => Boolean(track.subtitleUrl));
  if (!normalizedTracks.length) {
    return null;
  }

  const preferredChinese = normalizedTracks.find((track) => isChineseSubtitleTrack(track) && !track.isAi);
  if (preferredChinese) {
    return preferredChinese;
  }

  const preferredHuman = normalizedTracks.find((track) => !track.isAi);
  if (preferredHuman) {
    return preferredHuman;
  }

  return normalizedTracks[0] ?? null;
}

function isChineseSubtitleTrack(track: PlaySubtitleTrack): boolean {
  const content = `${track.lang} ${track.langDoc}`.toLowerCase();
  return content.includes('zh') || content.includes('cn') || content.includes('中文');
}
