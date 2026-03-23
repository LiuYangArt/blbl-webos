import { describe, expect, it } from 'vitest';
import type { PlaySubtitleTrack } from '../../services/api/types';
import {
  convertSubtitleBodyToVtt,
  extractSubtitleBody,
  formatSubtitleTimecode,
  pickDefaultSubtitleTrack,
} from './playerSubtitle';

describe('playerSubtitle', () => {
  it('会把 B 站字幕时间转换成标准 VTT timecode', () => {
    expect(formatSubtitleTimecode(0)).toBe('00:00:00.000');
    expect(formatSubtitleTimecode(65.432)).toBe('00:01:05.432');
    expect(formatSubtitleTimecode(3661.2)).toBe('01:01:01.200');
  });

  it('会把字幕 body 转换成 WEBVTT 文本', () => {
    const vtt = convertSubtitleBodyToVtt([
      {
        sid: 1,
        from: 0.5,
        to: 2.25,
        content: '第一句字幕',
      },
      {
        sid: 2,
        from: 2.5,
        to: 4.75,
        content: '第二句字幕',
      },
    ]);

    expect(vtt).toBe([
      'WEBVTT',
      '',
      '1',
      '00:00:00.500 --> 00:00:02.250',
      '第一句字幕',
      '',
      '2',
      '00:00:02.500 --> 00:00:04.750',
      '第二句字幕',
    ].join('\n'));
  });

  it('会从接口响应里提取 body 列表', () => {
    expect(extractSubtitleBody({ body: [{ content: '字幕' }] })).toEqual([{ content: '字幕' }]);
    expect(extractSubtitleBody({})).toEqual([]);
    expect(extractSubtitleBody(null)).toEqual([]);
  });

  it('默认优先中文人工字幕，其次人工字幕，最后才回落到第一条', () => {
    const tracks: PlaySubtitleTrack[] = [
      {
        id: 1,
        lang: 'ai-zh',
        langDoc: '中文（AI）',
        subtitleUrl: 'https://example.com/ai-zh.json',
        isAi: true,
      },
      {
        id: 2,
        lang: 'en',
        langDoc: 'English',
        subtitleUrl: 'https://example.com/en.json',
        isAi: false,
      },
      {
        id: 3,
        lang: 'zh-CN',
        langDoc: '中文',
        subtitleUrl: 'https://example.com/zh.json',
        isAi: false,
      },
    ];

    expect(pickDefaultSubtitleTrack(tracks)?.id).toBe(3);
    expect(pickDefaultSubtitleTrack(tracks.slice(0, 2))?.id).toBe(2);
    expect(pickDefaultSubtitleTrack(tracks.slice(0, 1))?.id).toBe(1);
    expect(pickDefaultSubtitleTrack([])).toBeNull();
  });
});
