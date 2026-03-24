import { describe, expect, it } from 'vitest';
import { getPlayerAutoNextNotice, resolvePlayerAutoNextTarget } from './playerAutoNext';
import type { VideoPart } from '../../services/api/types';

const episodeEntries: VideoPart[] = [
  {
    cid: 101,
    page: 1,
    part: 'P1 开场',
    duration: 120,
  },
  {
    cid: 102,
    page: 2,
    part: 'P2 正片',
    duration: 180,
  },
];

describe('playerAutoNext', () => {
  it('当前视频还有下一P时，优先返回下一P', () => {
    const result = resolvePlayerAutoNextTarget({
      bvid: 'BV1episode',
      cid: 101,
      title: '测试视频',
      episodeEntries,
      related: [
        {
          bvid: 'BV1related',
          cid: 201,
          title: '推荐视频',
        },
      ],
    });

    expect(result).toEqual({
      kind: 'episode',
      bvid: 'BV1episode',
      cid: 102,
      title: '测试视频',
      part: 'P2 正片',
    });
  });

  it('已经播到最后一P时，会退化到第一条相关推荐', () => {
    const result = resolvePlayerAutoNextTarget({
      bvid: 'BV1episode',
      cid: 102,
      title: '测试视频',
      episodeEntries,
      related: [
        {
          bvid: 'BV1related',
          cid: 201,
          title: '推荐视频',
        },
      ],
    });

    expect(result).toEqual({
      kind: 'related',
      bvid: 'BV1related',
      cid: 201,
      title: '推荐视频',
    });
  });

  it('没有相关推荐时，返回 null', () => {
    const result = resolvePlayerAutoNextTarget({
      bvid: 'BV1episode',
      cid: 102,
      title: '测试视频',
      episodeEntries,
      related: [],
    });

    expect(result).toBeNull();
  });

  it('第一条相关推荐缺少必要字段时，返回 null', () => {
    const result = resolvePlayerAutoNextTarget({
      bvid: 'BV1episode',
      cid: 102,
      title: '测试视频',
      episodeEntries,
      related: [
        {
          bvid: 'BV1related',
          title: '推荐视频',
        },
      ],
    });

    expect(result).toBeNull();
  });

  it('会为下一P和相关推荐返回正确的提示文案', () => {
    expect(getPlayerAutoNextNotice({
      kind: 'episode',
      bvid: 'BV1episode',
      cid: 102,
      title: '测试视频',
      part: 'P2 正片',
    })).toBe('正在继续播放下一 P：P2 正片');

    expect(getPlayerAutoNextNotice({
      kind: 'related',
      bvid: 'BV1related',
      cid: 201,
      title: '推荐视频',
    })).toBe('当前视频已播完，正在为你播放下一条推荐视频');
  });
});
