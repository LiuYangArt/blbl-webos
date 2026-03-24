import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDashManifestSource } from './playerDashManifest';
import type { PlayAudioStream, PlayVideoStream } from '../../services/api/types';

const videoStream: PlayVideoStream = {
  id: 101,
  quality: 80,
  qualityLabel: '1080P',
  codec: 'avc',
  codecs: 'avc1.640028',
  url: 'https://example.com/video.m4s',
  backupUrls: [],
  mimeType: 'video/mp4',
  segmentBase: {
    initialization: '0-1023',
    indexRange: '1024-2047',
  },
  width: 1920,
  height: 1080,
  bandwidth: 2_000_000,
  frameRate: 60,
};

const audioStream: PlayAudioStream = {
  id: 201,
  url: 'https://example.com/audio.m4s',
  backupUrls: [],
  mimeType: 'audio/mp4',
  segmentBase: {
    initialization: '0-511',
    indexRange: '512-1023',
  },
  bandwidth: 128_000,
  codecs: 'mp4a.40.2',
  kind: 'aac',
  label: 'AAC',
};

describe('playerDashManifest', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  let capturedBlob: Blob | null = null;

  beforeEach(() => {
    capturedBlob = null;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn((blob: Blob) => {
        capturedBlob = blob;
        return 'blob:test-manifest';
      }),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: originalRevokeObjectURL,
    });
  });

  it('生成包含音视频轨的 DASH manifest，并正确转义 XML', async () => {
    const source = createDashManifestSource({
      durationMs: 245_500,
      videoStream: {
        ...videoStream,
        mimeType: 'video/mp4"',
      },
      audioStream,
      videoUrl: 'https://example.com/video.m4s?foo=1&bar=<2>',
      audioUrl: 'https://example.com/audio.m4s?foo=1&bar=<2>',
    });

    expect(source.manifestUrl).toBe('blob:test-manifest');
    expect(capturedBlob).not.toBeNull();

    const manifest = await capturedBlob!.text();

    expect(manifest).toContain('mediaPresentationDuration="PT245.5S"');
    expect(manifest).toContain('mimeType="video/mp4&quot;"');
    expect(manifest).toContain('<BaseURL>https://example.com/video.m4s?foo=1&amp;bar=&lt;2&gt;</BaseURL>');
    expect(manifest).toContain('<BaseURL>https://example.com/audio.m4s?foo=1&amp;bar=&lt;2&gt;</BaseURL>');
    expect(manifest).toContain('<Period duration="PT245.5S">');
    expect(manifest).toContain('<AdaptationSet id="2" contentType="audio" mimeType="audio/mp4"');
    expect(manifest).toContain('<Representation id="a1" bandwidth="128000" mimeType="audio/mp4" codecs="mp4a.40.2">');

    source.revoke();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-manifest');
  });

  it('视频轨缺少 SegmentBase 时直接报错', () => {
    expect(() => createDashManifestSource({
      durationMs: 120_000,
      videoStream: {
        ...videoStream,
        segmentBase: null,
      },
      audioStream,
      videoUrl: videoStream.url,
      audioUrl: audioStream.url,
    })).toThrow('当前视频轨缺少 SegmentBase');
  });
});
