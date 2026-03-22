import { describe, expect, it, vi } from 'vitest';
import {
  BiliApiError,
  fetchJson,
  formatDisplayError,
  unwrapData,
} from './http';

describe('http', () => {
  it('fetchJson 默认带上 include credentials 和 accept 头，并允许额外 header 覆盖', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 0, data: { ok: true } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const payload = await fetchJson<{ code: number; data: { ok: boolean } }>('https://example.com/api', {
      headers: {
        'x-test': '1',
      },
    });

    expect(payload).toEqual({ code: 0, data: { ok: true } });
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/api', expect.objectContaining({
      credentials: 'include',
      headers: expect.objectContaining({
        accept: 'application/json, text/plain, */*',
        'x-test': '1',
      }),
    }));
  });

  it('fetchJson 在非 2xx 响应时抛出网络错误', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
    }));

    await expect(fetchJson('https://example.com/api')).rejects.toThrow('网络请求失败（403）');
  });

  it('unwrapData 在 code 非 0 时抛出标准化 BiliApiError', () => {
    expect(() => unwrapData({
      code: -352,
      message: '-352',
      data: null,
    })).toThrow(BiliApiError);

    try {
      unwrapData({
        code: -352,
        message: '-352',
        data: null,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(BiliApiError);
      expect((error as BiliApiError).message).toBe('风控校验失败（-352）');
      expect((error as BiliApiError).code).toBe(-352);
    }
  });

  it('formatDisplayError 会保留上下文并兜底未知错误', () => {
    expect(formatDisplayError(new Error('接口超时'), '加载首页')).toBe('加载首页失败：接口超时');
    expect(formatDisplayError('unknown')).toBe('请求失败');
  });
});
