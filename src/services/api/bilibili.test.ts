import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  fetchJsonMock,
  getBiliApiUrlMock,
  getBiliPassportUrlMock,
  getBiliSearchUrlMock,
  postFormMock,
  readCookieValueMock,
  unwrapDataMock,
  signWbiMock,
  readRelayAuthMaterialMock,
  readRelaySettingsMock,
} = vi.hoisted(() => ({
  fetchJsonMock: vi.fn(),
  getBiliApiUrlMock: vi.fn((path: string) => `api:${path}`),
  getBiliPassportUrlMock: vi.fn((path: string) => `passport:${path}`),
  getBiliSearchUrlMock: vi.fn((path: string) => `search:${path}`),
  postFormMock: vi.fn(),
  readCookieValueMock: vi.fn(),
  unwrapDataMock: vi.fn((payload: { data: unknown }) => payload.data),
  signWbiMock: vi.fn(),
  readRelayAuthMaterialMock: vi.fn(),
  readRelaySettingsMock: vi.fn(),
}));

vi.mock('./http', () => ({
  fetchJson: fetchJsonMock,
  getBiliApiUrl: getBiliApiUrlMock,
  getBiliPassportUrl: getBiliPassportUrlMock,
  getBiliSearchUrl: getBiliSearchUrlMock,
  postForm: postFormMock,
  readCookieValue: readCookieValueMock,
  unwrapData: unwrapDataMock,
}));

vi.mock('./wbi', () => ({
  signWbi: signWbiMock,
}));

vi.mock('../relay/settings', () => ({
  readRelayAuthMaterial: readRelayAuthMaterialMock,
  readRelaySettings: readRelaySettingsMock,
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
    postFormMock.mockReset();
    readCookieValueMock.mockReset();
    readRelayAuthMaterialMock.mockReset();
    readRelaySettingsMock.mockReset();
    unwrapDataMock.mockClear();
    signWbiMock.mockReset();
    signWbiMock.mockResolvedValue(new URLSearchParams('signed=1'));
    readRelaySettingsMock.mockReturnValue({
      enabled: true,
      host: '',
      port: 19091,
      accessToken: '',
      healthTimeoutMs: 1800,
      requestTimeoutMs: 7000,
    });
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

  it('fetchPlayInfo 会映射字幕轨信息并给 AI 字幕补充标签', async () => {
    fetchJsonMock.mockResolvedValue({
      data: {
        subtitle: {
          subtitles: [
            {
              id: 1,
              lan: 'zh-CN',
              lan_doc: '中文',
              subtitle_url: '//i0.hdslb.com/subtitle-1.json',
              type: 0,
            },
            {
              id: 2,
              lan: 'ai-zh',
              lan_doc: '中文',
              subtitle_url_v2: 'http://i0.hdslb.com/subtitle-2.json',
              type: 1,
            },
          ],
        },
      },
    });

    const { fetchPlayInfo } = await loadBilibiliModule();
    const result = await fetchPlayInfo('BV1xx411c7mD', 123);

    expect(signWbiMock).toHaveBeenCalledWith({
      bvid: 'BV1xx411c7mD',
      cid: 123,
    });
    expect(result).toEqual({
      subtitles: [
        {
          id: 1,
          lang: 'zh-CN',
          langDoc: '中文',
          subtitleUrl: 'https://i0.hdslb.com/subtitle-1.json',
          isAi: false,
        },
        {
          id: 2,
          lang: 'ai-zh',
          langDoc: '中文（AI）',
          subtitleUrl: 'https://i0.hdslb.com/subtitle-2.json',
          isAi: true,
        },
      ],
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

  it('fetchHistoryPage 会映射 aid，并生成下一页 cursor', async () => {
    fetchJsonMock.mockResolvedValue({
      data: {
        list: [
          {
            kid: 'history-1',
            title: '历史视频',
            history: {
              oid: 1001,
              bvid: 'BV1history',
              cid: 2002,
              part: 'P1',
            },
            cover: '//i0.hdslb.com/history.jpg',
            author_name: '作者',
            duration: 300,
            progress: 120,
            view_at: 1711000000,
          },
        ],
      },
    });

    const { fetchHistoryPage } = await loadBilibiliModule();
    const result = await fetchHistoryPage();

    expect(result).toEqual({
      items: [{
        kid: 'history-1',
        aid: 1001,
        title: '历史视频',
        bvid: 'BV1history',
        cid: 2002,
        cover: 'https://i0.hdslb.com/history.jpg',
        author: '作者',
        duration: 300,
        progress: 120,
        viewAt: 1711000000,
        part: 'P1',
      }],
      hasMore: true,
      cursor: JSON.stringify({
        max: 1001,
        viewAt: 1711000000,
      }),
    });
  });

  it('reportVideoHeartbeat 会带 csrf 和 played_time 发送表单请求', async () => {
    readCookieValueMock.mockReturnValue('csrf-token');
    postFormMock.mockResolvedValue({
      data: null,
    });

    const { reportVideoHeartbeat } = await loadBilibiliModule();
    await reportVideoHeartbeat({
      aid: 1001,
      bvid: 'BV1heartbeat',
      cid: 2002,
      playedTime: 15,
    });

    expect(postFormMock).toHaveBeenCalledWith(
      'api:/x/click-interface/web/heartbeat',
      {
        aid: 1001,
        bvid: 'BV1heartbeat',
        cid: 2002,
        played_time: 15,
        csrf: 'csrf-token',
      },
    );
  });

  it('reportVideoHistoryProgress 会带 aid/cid/progress/csrf 发送表单请求', async () => {
    readCookieValueMock.mockReturnValue('csrf-token');
    postFormMock.mockResolvedValue({
      data: null,
    });

    const { reportVideoHistoryProgress } = await loadBilibiliModule();
    await reportVideoHistoryProgress({
      aid: 1001,
      cid: 2002,
      progress: 88,
    });

    expect(postFormMock).toHaveBeenCalledWith(
      'api:/x/v2/history/report',
      {
        aid: 1001,
        cid: 2002,
        progress: 88,
        csrf: 'csrf-token',
      },
    );
  });

  it('直写接口在 cookie 读不到 csrf 时，会回退到已保存的登录材料', async () => {
    readCookieValueMock.mockReturnValue(null);
    readRelayAuthMaterialMock.mockReturnValue({
      loginUrl: 'https://passport.bilibili.com/x/passport-login/web/crossDomain?bili_jct=query-csrf',
      refreshToken: 'refresh-token',
      completedAt: 1710000000000,
      mid: 12345,
      uname: '测试用户',
      vip: false,
      capturedAt: 1710000001000,
      csrfToken: 'query-csrf',
    });
    postFormMock.mockResolvedValue({
      data: null,
    });

    const { reportVideoHeartbeat } = await loadBilibiliModule();
    await reportVideoHeartbeat({
      bvid: 'BV1fallback',
      cid: 2002,
      playedTime: 22,
    });

    expect(postFormMock).toHaveBeenCalledWith(
      'api:/x/click-interface/web/heartbeat',
      expect.objectContaining({
        bvid: 'BV1fallback',
        cid: 2002,
        played_time: 22,
        csrf: 'query-csrf',
      }),
    );
  });

  it('fetchPlaySource 在 DASH 不可用时回退 durl 兼容流', async () => {
    fetchJsonMock.mockImplementation(async (url: string) => {
      if (url.includes('fnval=1488') || url.includes('fnval=4048') || url.includes('fnval=16')) {
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

    expect(result).toEqual(expect.objectContaining({
      mode: 'durl',
      qualityLabel: '720P',
      currentQuality: 64,
      returnedQuality: 64,
      returnedQualityLabel: '720P',
      compatibleQuality: 64,
      compatibleQualityLabel: '720P',
      requestedQuality: 80,
      requestedQualityLabel: '1080P',
      qualityLimitReason: 0,
      qualityReason: '已请求 1080P，但接口本次只返回 720P 兼容流。',
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
    }));
    expect(result.requestTrace.dash.map((item) => item.fnval)).toEqual([1488, 4048, 16]);
    expect(result.requestTrace.compatible).toEqual([{
      qn: 80,
      fnval: 0,
      platform: null,
      highQuality: false,
      source: 'direct',
      resultQuality: 64,
      resultFormat: 'mp4',
      resultHost: 'cn-gotcha01.bilivideo.com',
      resultPlatformHint: null,
      resultFormatHint: null,
      relayQuality: null,
      relayFormat: null,
      relayHost: null,
      relayPlatformHint: null,
      relayFormatHint: null,
    }]);
  });

  it('fetchPlaySource 在 DASH 可用时解析视频音频轨并附带兼容回退', async () => {
    fetchJsonMock.mockImplementation(async (url: string) => {
      if (url.includes('fnval=1488') || url.includes('fnval=4048')) {
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
    expect(result.returnedQuality).toBe(80);
    expect(result.compatibleQuality).toBe(80);
    expect(result.qualityReason).toBe('接口已返回 1080P 播放源。');
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
    expect(result.requestTrace.dash[0]).toEqual({
      qn: 80,
      fnval: 1488,
      platform: null,
      highQuality: false,
      source: 'direct',
      resultQuality: 80,
      resultFormat: 'dash',
      resultHost: 'upos-sz.bilivideo.com',
      resultPlatformHint: null,
      resultFormatHint: null,
      relayQuality: null,
      relayFormat: null,
      relayHost: null,
      relayPlatformHint: null,
      relayFormatHint: null,
    });
    expect(result.requestTrace.compatible[0]).toEqual({
      qn: 80,
      fnval: 0,
      platform: 'html5',
      highQuality: true,
      source: 'direct',
      resultQuality: 80,
      resultFormat: 'mp4',
      resultHost: 'cn-gotcha01.bilivideo.com',
      resultPlatformHint: null,
      resultFormatHint: null,
      relayQuality: null,
      relayFormat: null,
      relayHost: null,
      relayPlatformHint: null,
      relayFormatHint: null,
    });
  });

  it('fetchPlaySource 不会让低档兼容流覆盖 DASH 实际返回的高画质', async () => {
    fetchJsonMock.mockImplementation(async (url: string) => {
      if (url.includes('fnval=1488')) {
        return {
          data: {
            quality: 80,
            format: 'dash',
            timelength: 120000,
            support_formats: [
              {
                quality: 80,
                new_description: '1080P',
                codecs: ['avc1.640028'],
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
            quality: 64,
            format: 'mp4',
            durl: [{
              url: 'https://cn-gotcha01.bilivideo.com/video-compatible-720.mp4',
              backup_url: ['https://mcdn.example.com/video-compatible-720.mp4'],
            }],
          },
        };
      }

      throw new Error(`unexpected url: ${url}`);
    });

    const { fetchPlaySource } = await loadBilibiliModule();
    const result = await fetchPlaySource('BV1xx411c7mD', 12345, 80);

    expect(result.mode).toBe('dash');
    expect(result.currentQuality).toBe(80);
    expect(result.returnedQuality).toBe(80);
    expect(result.returnedQualityLabel).toBe('1080P');
    expect(result.compatibleQuality).toBe(64);
    expect(result.compatibleQualityLabel).toBe('720P');
    expect(result.qualityReason).toBe('接口已返回 1080P DASH 分轨；兼容流最高仅 720P，仅在 DASH 失败时作为回退。');
    expect(result.compatibleSources[0]).toEqual({
      quality: 64,
      qualityLabel: '720P',
      format: 'mp4',
      url: 'https://cn-gotcha01.bilivideo.com/video-compatible-720.mp4',
      candidateUrls: [
        'https://cn-gotcha01.bilivideo.com/video-compatible-720.mp4',
        'https://mcdn.example.com/video-compatible-720.mp4',
      ],
    });
  });

  it('fetchPlaySource 会把 html5 兼容流排在同档位 pc 兼容流前面', async () => {
    fetchJsonMock.mockImplementation(async (url: string) => {
      if (url.includes('fnval=1488')) {
        return {
          data: {
            quality: 80,
            format: 'dash',
            timelength: 120000,
            support_formats: [
              {
                quality: 80,
                new_description: '1080P',
                codecs: ['avc1.640028'],
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
            quality: 64,
            format: 'mp4',
            durl: [{
              url: 'https://upos-sz-estghw.bilivideo.com/video-compatible-720.mp4?platform=html5&high_quality=1&f=h_0_0',
            }],
          },
        };
      }

      if (url.includes('fnval=0') && !url.includes('platform=html5') && url.includes('qn=80')) {
        return {
          data: {
            quality: 80,
            format: 'mp4',
            durl: [{
              url: 'https://upos-sz-estghw.bilivideo.com/video-compatible-1080.mp4?platform=pc&f=u_0_0',
            }],
          },
        };
      }

      if (url.includes('fnval=0') && url.includes('platform=html5') && url.includes('qn=64')) {
        return {
          data: {
            quality: 80,
            format: 'mp4',
            durl: [{
              url: 'https://upos-sz-estghw.bilivideo.com/video-compatible-1080.mp4?platform=html5&high_quality=1&f=h_0_0',
              backup_url: ['https://mcdn.example.com/video-compatible-1080.mp4?platform=html5&high_quality=1&f=h_0_0'],
            }],
          },
        };
      }

      throw new Error(`unexpected url: ${url}`);
    });

    const { fetchPlaySource } = await loadBilibiliModule();
    const result = await fetchPlaySource('BV1xx411c7mD', 12345, 80);

    expect(result.compatibleQuality).toBe(80);
    expect(result.compatibleSources[0]).toEqual({
      quality: 80,
      qualityLabel: '1080P',
      format: 'mp4',
      url: 'https://upos-sz-estghw.bilivideo.com/video-compatible-1080.mp4?platform=html5&high_quality=1&f=h_0_0',
      candidateUrls: [
        'https://upos-sz-estghw.bilivideo.com/video-compatible-1080.mp4?platform=html5&high_quality=1&f=h_0_0',
        'https://upos-sz-estghw.bilivideo.com/video-compatible-1080.mp4?platform=pc&f=u_0_0',
        'https://mcdn.example.com/video-compatible-1080.mp4?platform=html5&high_quality=1&f=h_0_0',
      ],
    });
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

  it('pollWebQrLogin 会保留 relay 建立会话所需的登录完成信息', async () => {
    fetchJsonMock.mockResolvedValue({
      data: {
        code: 0,
        message: '0',
        url: 'https://passport.bilibili.com/login-done',
        refresh_token: 'refresh-token',
        timestamp: 1710000000000,
      },
    });

    const { pollWebQrLogin } = await loadBilibiliModule();
    const result = await pollWebQrLogin('qr-key');

    expect(result).toEqual({
      code: 0,
      message: '0',
      loginUrl: 'https://passport.bilibili.com/login-done',
      refreshToken: 'refresh-token',
      timestamp: 1710000000000,
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
        aid: 123,
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
