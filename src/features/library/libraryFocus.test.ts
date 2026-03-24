import { describe, expect, it } from 'vitest';
import {
  FAVORITE_VIDEO_SECTION_ID,
  buildFavoriteFolderFocusId,
  buildFavoriteFolderSectionLeaveFor,
  buildFavoriteVideoSectionLeaveFor,
} from './libraryFocus';

describe('libraryFocus', () => {
  it('为收藏夹按钮生成稳定的 focusId', () => {
    expect(buildFavoriteFolderFocusId(0)).toBe('favorite-folder-0');
    expect(buildFavoriteFolderFocusId(7)).toBe('favorite-folder-7');
  });

  it('收藏夹 section 始终向下进入视频区', () => {
    expect(buildFavoriteFolderSectionLeaveFor()).toEqual({
      left: '@side-nav',
      down: `@${FAVORITE_VIDEO_SECTION_ID}`,
    });
  });

  it('视频区向上回到当前激活收藏夹，而不是写死到固定按钮', () => {
    expect(buildFavoriteVideoSectionLeaveFor(3)).toEqual({
      left: '@side-nav',
      up: 'favorite-folder-3',
    });
  });

  it('没有激活收藏夹时，视频区不会伪造一个上行目标', () => {
    expect(buildFavoriteVideoSectionLeaveFor(null)).toEqual({
      left: '@side-nav',
    });
  });
});
