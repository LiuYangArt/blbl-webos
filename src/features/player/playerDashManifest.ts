import type { PlayAudioStream, PlayVideoStream } from '../../services/api/types';

type CreateDashManifestSourceOptions = {
  durationMs: number;
  videoStream: PlayVideoStream;
  audioStream: PlayAudioStream | null;
  videoUrl: string;
  audioUrl?: string;
};

export type PlayerDashManifestSource = {
  manifestUrl: string;
  revoke: () => void;
};

export function createDashManifestSource(options: CreateDashManifestSourceOptions): PlayerDashManifestSource {
  const videoSegmentBase = options.videoStream.segmentBase;
  const audioSegmentBase = options.audioStream?.segmentBase ?? null;

  if (!videoSegmentBase) {
    throw new Error('当前视频轨缺少 SegmentBase，无法生成 DASH 清单。');
  }

  if (options.audioStream && !audioSegmentBase) {
    throw new Error('当前音频轨缺少 SegmentBase，无法生成 DASH 清单。');
  }

  const manifest = buildDashManifest(options, videoSegmentBase, audioSegmentBase);
  const manifestUrl = URL.createObjectURL(new Blob([manifest], {
    type: 'application/dash+xml',
  }));

  return {
    manifestUrl,
    revoke: () => URL.revokeObjectURL(manifestUrl),
  };
}

function buildDashManifest(
  options: CreateDashManifestSourceOptions,
  videoSegmentBase: NonNullable<PlayVideoStream['segmentBase']>,
  audioSegmentBase: NonNullable<PlayAudioStream['segmentBase']> | null,
): string {
  const durationSeconds = Math.max(1, options.durationMs / 1000);
  const audioUrl = options.audioStream ? (options.audioUrl ?? options.audioStream.url) : '';
  const frameRateAttribute = options.videoStream.frameRate > 0 ? ` frameRate="${options.videoStream.frameRate}"` : '';

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<MPD xmlns="urn:mpeg:dash:schema:mpd:2011"',
    '  profiles="urn:mpeg:dash:profile:isoff-on-demand:2011"',
    '  type="static"',
    `  mediaPresentationDuration="${formatDashDuration(durationSeconds)}"`,
    '  minBufferTime="PT1.5S">',
    '  <Period start="PT0S">',
    `    <AdaptationSet mimeType="${escapeXml(options.videoStream.mimeType || 'video/mp4')}" segmentAlignment="true" subsegmentAlignment="true" startWithSAP="1">`,
    `      <Representation id="${escapeXml(`video-${options.videoStream.id}`)}" bandwidth="${options.videoStream.bandwidth || 1}" width="${Math.max(1, options.videoStream.width)}" height="${Math.max(1, options.videoStream.height)}" codecs="${escapeXml(options.videoStream.codecs)}"${frameRateAttribute}>`,
    `        <BaseURL>${escapeXml(options.videoUrl)}</BaseURL>`,
    `        <SegmentBase indexRange="${escapeXml(videoSegmentBase.indexRange)}">`,
    `          <Initialization range="${escapeXml(videoSegmentBase.initialization)}" />`,
    '        </SegmentBase>',
    '      </Representation>',
    '    </AdaptationSet>',
    ...(options.audioStream && audioSegmentBase
      ? [
          `    <AdaptationSet mimeType="${escapeXml(options.audioStream.mimeType || 'audio/mp4')}" lang="und" segmentAlignment="true" subsegmentAlignment="true" startWithSAP="1">`,
          `      <Representation id="${escapeXml(`audio-${options.audioStream.id}`)}" bandwidth="${options.audioStream.bandwidth || 1}" codecs="${escapeXml(options.audioStream.codecs)}">`,
          `        <BaseURL>${escapeXml(audioUrl)}</BaseURL>`,
          `        <SegmentBase indexRange="${escapeXml(audioSegmentBase.indexRange)}">`,
          `          <Initialization range="${escapeXml(audioSegmentBase.initialization)}" />`,
          '        </SegmentBase>',
          '      </Representation>',
          '    </AdaptationSet>',
        ]
      : []),
    '  </Period>',
    '</MPD>',
  ].join('\n');
}

function formatDashDuration(durationSeconds: number): string {
  const seconds = durationSeconds.toFixed(3).replace(/\.?0+$/u, '');
  return `PT${seconds}S`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
