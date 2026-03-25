import { describe, expect, it } from 'vitest';
import { pickImageUrls } from './videoListLoading';

describe('pickImageUrls', () => {
  it('会去重、跳过空值，并保持原有顺序', () => {
    const items = [
      { cover: ' https://example.com/a.jpg ' },
      { cover: '' },
      { cover: 'https://example.com/a.jpg' },
      { cover: 'https://example.com/b.jpg' },
      { cover: '   ' },
      { cover: 'https://example.com/c.jpg' },
    ];

    expect(pickImageUrls(items, (item) => item.cover, 12)).toEqual([
      'https://example.com/a.jpg',
      'https://example.com/b.jpg',
      'https://example.com/c.jpg',
    ]);
  });

  it('会按 limit 截断首屏预加载图片数量', () => {
    const items = [
      { cover: 'https://example.com/1.jpg' },
      { cover: 'https://example.com/2.jpg' },
      { cover: 'https://example.com/3.jpg' },
    ];

    expect(pickImageUrls(items, (item) => item.cover, 2)).toEqual([
      'https://example.com/1.jpg',
      'https://example.com/2.jpg',
    ]);
  });
});
