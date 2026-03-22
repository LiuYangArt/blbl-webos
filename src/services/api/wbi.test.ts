import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFetchJson, mockGetBiliApiUrl } = vi.hoisted(() => ({
  mockFetchJson: vi.fn(),
  mockGetBiliApiUrl: vi.fn((path: string) => `mocked:${path}`),
}));

vi.mock('./http', () => ({
  fetchJson: mockFetchJson,
  getBiliApiUrl: mockGetBiliApiUrl,
}));

async function loadWbiModule() {
  vi.resetModules();
  return import('./wbi');
}

describe('wbi', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T08:00:00.000Z'));
    mockFetchJson.mockReset();
    mockGetBiliApiUrl.mockClear();
    mockFetchJson.mockResolvedValue({
      code: 0,
      message: '0',
      data: {
        wbi_img: {
          img_url: 'https://i0.hdslb.com/bfs/wbi/abcdefghijklmnopqrstuvwxyz123456.png',
          sub_url: 'https://i0.hdslb.com/bfs/wbi/7890abcdefghijklmnopqrstuvwxyz123456.jpg',
        },
      },
    });
  });

  it('signWbi 会清洗参数、追加 wts 与 w_rid，并按字典序输出', async () => {
    const { signWbi } = await loadWbiModule();

    const result = await signWbi({
      keyword: "TV!(*)",
      pn: 2,
      login: true,
      unused: undefined,
      empty: null,
    });

    expect(result.get('keyword')).toBe('TV');
    expect(result.get('pn')).toBe('2');
    expect(result.get('login')).toBe('true');
    expect(result.get('wts')).toBe(String(Math.floor(new Date('2026-03-22T08:00:00.000Z').getTime() / 1000)));
    expect(result.get('w_rid')).toMatch(/^[a-f0-9]{32}$/u);
    expect(Array.from(result.keys())).toEqual(['keyword', 'login', 'pn', 'wts', 'w_rid']);
  });

  it('同一天重复签名时复用缓存的 mixin key，不重复请求 nav', async () => {
    const { signWbi } = await loadWbiModule();

    await signWbi({ keyword: '第一次' });
    await signWbi({ keyword: '第二次' });

    expect(mockGetBiliApiUrl).toHaveBeenCalledWith('/x/web-interface/nav');
    expect(mockFetchJson).toHaveBeenCalledTimes(1);
  });

  it('跨天后重新拉取 mixin key', async () => {
    const { signWbi } = await loadWbiModule();

    await signWbi({ keyword: '今天' });
    vi.setSystemTime(new Date('2026-03-23T01:00:00.000Z'));
    await signWbi({ keyword: '明天' });

    expect(mockFetchJson).toHaveBeenCalledTimes(2);
  });
});
