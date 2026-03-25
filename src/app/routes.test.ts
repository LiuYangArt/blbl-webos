import { describe, expect, it } from 'vitest';
import { getActiveNav } from './routes';

describe('routes', () => {
  it('主导航页面映射到对应导航 key', () => {
    expect(getActiveNav({ name: 'home' }, false)).toBe('home');
    expect(getActiveNav({ name: 'search-results', keyword: '电视' }, false)).toBe('search');
    expect(getActiveNav({ name: 'favorites' }, true)).toBe('favorites');
    expect(getActiveNav({ name: 'history' }, true)).toBe('history');
  });

  it('详情页在登录态下映射到对应频道，未登录则不高亮', () => {
    expect(getActiveNav({ name: 'video-detail', bvid: 'BV1xx411c7mD', title: '视频' }, true)).toBe('following');
    expect(getActiveNav({ name: 'video-detail', bvid: 'BV1xx411c7mD', title: '视频' }, false)).toBeNull();
    expect(getActiveNav({ name: 'pgc-detail', seasonId: 1001, title: '番剧' }, true)).toBe('subscriptions');
    expect(getActiveNav({ name: 'pgc-detail', seasonId: 1001, title: '番剧' }, false)).toBeNull();
  });

  it('播放器页不高亮任何主导航', () => {
    expect(getActiveNav({
      name: 'player',
      bvid: 'BV1xx411c7mD',
      cid: 12345,
      title: '播放页',
    }, true)).toBeNull();
    expect(getActiveNav({
      name: 'author-space',
      mid: 10086,
      authorName: '作者',
      sourceBvid: 'BV1xx411c7mD',
    }, true)).toBeNull();
  });
});
