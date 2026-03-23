import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchJsonMock, getBiliApiUrlMock, getBiliPassportUrlMock, getBiliSearchUrlMock, unwrapDataMock, signWbiMock } = vi.hoisted(() => ({
  fetchJsonMock: vi.fn(),
  getBiliApiUrlMock: vi.fn((path: string) => `api:${path}`),
  getBiliPassportUrlMock: vi.fn((path: string) => `passport:${path}`),
  getBiliSearchUrlMock: vi.fn((path: string) => `search:${path}`),
  unwrapDataMock: vi.fn((payload: { data: unknown }) => payload.data),
  signWbiMock: vi.fn(),
}));

vi.mock('./http', () => ({
  fetchJson: fetchJsonMock,
  getBiliApiUrl: getBiliApiUrlMock,
  getBiliPassportUrl: getBiliPassportUrlMock,
  getBiliSearchUrl: getBiliSearchUrlMock,
  unwrapData: unwrapDataMock,
}));

vi.mock('./wbi', () => ({
  signWbi: signWbiMock,
}));

async function loadBilibiliModule() {
  vi.resetModules();
  return import('./bilibili');
}

describe('bilibili api mapping', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
    getBiliApiUrlMock.mockClear();
    getBiliPassportUrlMock.mockClear();
    getBiliSearchUrlMock.mockClear();
    unwrapDataMock.mockClear();
    signWbiMock.mockReset();
    signWbiMock.mockResolvedValue(new URLSearchParams('signed=1'));
  });

  it('fetchRecommendedVideos 会过滤非视频项并清洗标题、封面和作者信息', async () => {
    fetchJsonMock.mockResolvedValue({
      data: {
        item: [
          {
            goto: 'av',
            aid: 1,
            bvid: 'BV1xx411c7mD',
            cid: 2,
            title: '<em class="keyword">测试</em>视频',
            pic: '//i0.hdslb.com/test.jpg',
            duration: '01:02',
            owner: {
              name: 'UP 主',
              face: 'http://i0.hdslb.com/face.jpg',
            },
            play: 100,
            danmaku: 10,
            like: 5,
            desc: '简介',
          },
          {
            goto: 'bangumi',
            bvid: 'BV-ignored',
          },
        ],
      },
    });

    const { fetchRecommendedVideos } = await loadBilibiliModule();
    const result = await fetchRecommendedVideos(12, 3);

    expect(signWbiMock).toHaveBeenCalled();
    expect(result).toEqual([{
      aid: 1,
      bvid: 'BV1xx411c7mD',
      cid: 2,
      title: '测试视频',
      cover: 'https://i0.hdslb.com/test.jpg',
      duration: 62,
      ownerName: 'UP 主',
      ownerFace: 'https://i0.hdslb.com/face.jpg',
      playCount: 100,
      danmakuCount: 10,
      likeCount: 5,
      description: '简介',
      reason: '',
      publishAt: 0,
      badge: '',
      typeName: '',
    }]);
  });

  it('fetchVideoDetail 会映射 owner、stats、分页和封面地址', async () => {
    fetchJsonMock.mockResolvedValue({
      data: {
        aid: 1,
        bvid: 'BV1xx411c7mD',
        cid: 2,
        title: '详情页',
        pic: 'http://i0.hdslb.com/detail.jpg',
        desc: '视频简介',
        duration: 321,
        owner: {
          mid: 99,
          name: '作者',
          face: '//i0.hdslb.com/face.jpg',
        },
        stat: {
          view: 1000,
          danmaku: 20,
          favorite: 30,
          like: 40,
          reply: 50,
          coin: 60,
          share: 70,
        },
        pages: [
          {
            cid: 2,
            page: 1,
            part: 'P1',
            duration: 321,
          },
        ],
        pubdate: 1234567890,
        tname: '动画',
      },
    });

    const { fetchVideoDetail } = await loadBilibiliModule();
    const result = await fetchVideoDetail('BV1xx411c7mD');

    expect(result).toEqual({
      aid: 1,
      bvid: 'BV1xx411c7mD',
      cid: 2,
      title: '详情页',
      cover: 'https://i0.hdslb.com/detail.jpg',
      description: '视频简介',
      duration: 321,
      owner: {
        mid: 99,
        name: '作者',
        face: 'https://i0.hdslb.com/face.jpg',
      },
      stats: {
        playCount: 1000,
        danmakuCount: 20,
        favoriteCount: 30,
        likeCount: 40,
        replyCount: 50,
        coinCount: 60,
        shareCount: 70,
      },
      parts: [{
        cid: 2,
        page: 1,
        part: 'P1',
        duration: 321,
      }],
      publishAt: 1234567890,
      typeName: '动画',
    });
  });

  it('fetchFollowingChannelData 会过滤无效动态并映射关注账户', async () => {
    fetchJsonMock.mockImplementation(async (url: string) => {
      if (url.includes('/portal?')) {
        return {
          data: {
            up_list: {
              items: [
                { mid: 1, uname: 'A', face: '//i0.hdslb.com/a.jpg', has_update: true },
                { mid: 0, uname: 'ignored' },
              ],
            },
          },
        };
      }

      return {
        data: {
          items: [
            {
              id_str: 'dyn-1',
              modules: {
                module_author: {
                  name: '作者 A',
                  pub_ts: 100,
                },
                module_dynamic: {
                  major: {
                    archive: {
                      bvid: 'BV1xx411c7mD',
                      cover: 'http://i0.hdslb.com/archive.jpg',
                      title: '动态视频',
                      desc: '动态简介',
                      duration_text: '02:03',
                    },
                  },
                },
              },
            },
            {
              id_str: 'dyn-2',
              modules: {
                module_dynamic: {
                  major: {
                    archive: {
                      title: '无效项',
                    },
                  },
                },
              },
            },
          ],
        },
      };
    });

    const { fetchFollowingChannelData } = await loadBilibiliModule();
    const result = await fetchFollowingChannelData();

    expect(result).toEqual({
      accounts: [{
        mid: 1,
        name: 'A',
        face: 'https://i0.hdslb.com/a.jpg',
        hasUpdate: true,
      }],
      items: [{
        id: 'dyn-1',
        bvid: 'BV1xx411c7mD',
        title: '动态视频',
        cover: 'https://i0.hdslb.com/archive.jpg',
        ownerName: '作者 A',
        duration: 123,
        description: '动态简介',
        publishedAt: 100,
        reason: '关注更新',
      }],
    });
  });

  it('fetchFollowingFeedPage 会跳过当前 offset 下没有可展示视频的空页', async () => {
    fetchJsonMock
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id_str: 'dyn-empty',
              modules: {
                module_dynamic: {
                  major: {
                    archive: {
                      title: '无 bvid 的无效项',
                    },
                  },
                },
              },
            },
          ],
          has_more: false,
          offset: 'offset-2',
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id_str: 'dyn-2',
              modules: {
                module_author: {
                  name: '作者 B',
                  pub_ts: 200,
                },
                module_dynamic: {
                  major: {
                    archive: {
                      bvid: 'BV1follow2',
                      cover: '//i0.hdslb.com/follow-2.jpg',
                      title: '第二页视频',
                      desc: '第二页简介',
                      duration_text: '01:30',
                    },
                  },
                },
              },
            },
          ],
          has_more: true,
          offset: 'offset-3',
        },
      });

    const { fetchFollowingFeedPage } = await loadBilibiliModule();
    const result = await fetchFollowingFeedPage({
      offset: 'offset-1',
      limit: 24,
    });

    expect(fetchJsonMock).toHaveBeenCalledTimes(2);
    expect(fetchJsonMock.mock.calls[0]?.[0]).toContain('offset=offset-1');
    expect(fetchJsonMock.mock.calls[1]?.[0]).toContain('offset=offset-2');
    expect(result).toEqual({
      items: [{
        id: 'dyn-2',
        bvid: 'BV1follow2',
        title: '第二页视频',
        cover: 'https://i0.hdslb.com/follow-2.jpg',
        ownerName: '作者 B',
        duration: 90,
        description: '第二页简介',
        publishedAt: 200,
        reason: '关注更新',
      }],
      hasMore: true,
      cursor: 'offset-3',
    });
  });

  it('fetchPlaySource 在 DASH 不可用时回退 durl 兼容流', async () => {
    fetchJsonMock.mockImplementation(async (url: string) => {
      if (url.includes('fnval=4048') || url.includes('fnval=16')) {
        return {
          data: {
            quality: 64,
            accept_quality: [80, 64],
            accept_description: ['1080P', '720P'],
            timelength: 1000,
          },
        };
      }

      if (url.includes('fnval=0')) {
        return {
          data: {
            quality: 64,
            format: 'mp4',
            timelength: 1000,
            accept_quality: [80, 64],
            accept_description: ['1080P', '720P'],
            durl: [{
              url: 'http://cn-gotcha01.bilivideo.com/video.mp4',
              backup_url: ['https://mcdn.example.com/video.mp4'],
            }],
          },
        };
      }

      throw new Error(`unexpected url: ${url}`);
    });

    const { fetchPlaySource } = await loadBilibiliModule();
    const result = await fetchPlaySource('BV1xx411c7mD', 12345, 80);

    expect(result).toEqual({
      mode: 'durl',
      qualityLabel: '720P',
      currentQuality: 64,
      requestedQuality: 80,
      requestedQualityLabel: '1080P',
      qualityLimitReason: 0,
      durationMs: 1000,
      qualities: [
        {
          qn: 80,
          label: '1080P',
          limitReason: 0,
          codecs: [],
          tier: '1080p',
        },
        {
          qn: 64,
          label: '720P',
          limitReason: 0,
          codecs: [],
          tier: '720p',
        },
      ],
      videoStreams: [],
      audioStreams: [],
      compatibleSources: [{
        quality: 64,
        qualityLabel: '720P',
        format: 'mp4',
        url: 'https://cn-gotcha01.bilivideo.com/video.mp4',
        candidateUrls: [
          'https://cn-gotcha01.bilivideo.com/video.mp4',
          'https://mcdn.example.com/video.mp4',
        ],
      }],
      candidateUrls: [
        'https://cn-gotcha01.bilivideo.com/video.mp4',
        'https://mcdn.example.com/video.mp4',
      ],
    });
  });

  it('fetchPlaySource 在 DASH 可用时解析视频音频轨并附带兼容回退', async () => {
    fetchJsonMock.mockImplementation(async (url: string) => {
      if (url.includes('fnval=4048')) {
        return {
          data: {
            quality: 80,
            format: 'dash',
            timelength: 120000,
            support_formats: [
              {
                quality: 80,
                new_description: '1080P',
                codecs: ['avc1.640028', 'hev1.1.6.L120.B0'],
              },
              {
                quality: 64,
                new_description: '720P',
                codecs: ['avc1.640028'],
              },
            ],
            dash: {
              video: [{
                id: 80,
                base_url: 'http://upos-sz.bilivideo.com/video-avc.m4s',
                backup_url: ['https://mcdn.example.com/video-avc.m4s'],
                mime_type: 'video/mp4',
                codecs: 'avc1.640028',
                segment_base: {
                  initialization: '0-100',
                  index_range: '101-200',
                },
                width: 1920,
                height: 1080,
                bandwidth: 2000000,
                frame_rate: '60',
              }],
              audio: [{
                id: 30216,
                base_url: 'http://upos-sz.bilivideo.com/audio.m4s',
                mime_type: 'audio/mp4',
                codecs: 'mp4a.40.2',
                segment_base: {
                  initialization: '0-50',
                  index_range: '51-99',
                },
                bandwidth: 128000,
              }],
            },
          },
        };
      }

      if (url.includes('fnval=0') && url.includes('platform=html5') && url.includes('qn=80')) {
        return {
          data: {
            quality: 80,
            format: 'mp4',
            durl: [{
              url: 'https://cn-gotcha01.bilivideo.com/video-compatible.mp4',
              backup_url: ['https://mcdn.example.com/video-compatible.mp4'],
            }],
          },
        };
      }

      throw new Error('compatible fallback skip');
    });

    const { fetchPlaySource } = await loadBilibiliModule();
    const result = await fetchPlaySource('BV1xx411c7mD', 12345, 80);

    expect(result.mode).toBe('dash');
    expect(result.currentQuality).toBe(80);
    expect(result.videoStreams).toEqual([{
      id: 80,
      quality: 80,
      qualityLabel: '1080P',
      codec: 'avc',
      codecs: 'avc1.640028',
      url: 'https://upos-sz.bilivideo.com/video-avc.m4s',
      backupUrls: ['https://mcdn.example.com/video-avc.m4s'],
      mimeType: 'video/mp4',
      segmentBase: {
        initialization: '0-100',
        indexRange: '101-200',
      },
      width: 1920,
      height: 1080,
      bandwidth: 2000000,
      frameRate: 60,
    }]);
    expect(result.audioStreams).toEqual([{
      id: 30216,
      url: 'https://upos-sz.bilivideo.com/audio.m4s',
      backupUrls: [],
      mimeType: 'audio/mp4',
      segmentBase: {
        initialization: '0-50',
        indexRange: '51-99',
      },
      bandwidth: 128000,
      codecs: 'mp4a.40.2',
      kind: 'aac',
      label: 'AAC',
    }]);
    expect(result.compatibleSources).toEqual([{
      quality: 80,
      qualityLabel: '1080P',
      format: 'mp4',
      url: 'https://cn-gotcha01.bilivideo.com/video-compatible.mp4',
      candidateUrls: [
        'https://cn-gotcha01.bilivideo.com/video-compatible.mp4',
        'https://mcdn.example.com/video-compatible.mp4',
      ],
    }]);
  });

  it('fetchCurrentUserProfile 会整合 nav 与 nav/stat 响应', async () => {
    fetchJsonMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/nav')) {
        return {
          data: {
            mid: 100,
            uname: '用户',
            face: '//i0.hdslb.com/face.jpg',
            sign: '签名',
            money: 12,
            level_info: {
              current_level: 6,
            },
            vip_label: {
              text: '大会员',
            },
          },
        };
      }

      return {
        data: {
          following: 88,
          follower: 99,
        },
      };
    });

    const { fetchCurrentUserProfile } = await loadBilibiliModule();
    const result = await fetchCurrentUserProfile();

    expect(result).toEqual({
      mid: 100,
      name: '用户',
      face: 'https://i0.hdslb.com/face.jpg',
      sign: '签名',
      coin: 12,
      level: 6,
      vipLabel: '大会员',
      following: 88,
      follower: 99,
    });
  });

  it('fetchHistoryPage 会按 cursor 参数继续请求并映射下一页游标', async () => {
    fetchJsonMock.mockResolvedValue({
      data: {
        list: [
          {
            kid: 'history-1',
            title: '历史视频',
            history: {
              oid: 123,
              bvid: 'BV1history1',
              cid: 456,
              part: 'P1',
            },
            cover: '//i0.hdslb.com/history.jpg',
            author_name: '历史作者',
            duration: 180,
            progress: 60,
            view_at: 789,
          },
        ],
      },
    });

    const { fetchHistoryPage } = await loadBilibiliModule();
    const result = await fetchHistoryPage({
      cursor: JSON.stringify({
        max: 999,
        viewAt: 888,
      }),
      pageSize: 24,
    });

    expect(fetchJsonMock).toHaveBeenCalledTimes(1);
    expect(fetchJsonMock.mock.calls[0]?.[0]).toContain('/x/web-interface/history/cursor?');
    expect(fetchJsonMock.mock.calls[0]?.[0]).toContain('type=all');
    expect(fetchJsonMock.mock.calls[0]?.[0]).toContain('ps=24');
    expect(fetchJsonMock.mock.calls[0]?.[0]).toContain('max=999');
    expect(fetchJsonMock.mock.calls[0]?.[0]).toContain('view_at=888');
    expect(result).toEqual({
      items: [{
        kid: 'history-1',
        title: '历史视频',
        bvid: 'BV1history1',
        cid: 456,
        cover: 'https://i0.hdslb.com/history.jpg',
        author: '历史作者',
        duration: 180,
        progress: 60,
        viewAt: 789,
        part: 'P1',
      }],
      hasMore: true,
      cursor: JSON.stringify({
        max: 123,
        viewAt: 789,
      }),
    });
  });
});
