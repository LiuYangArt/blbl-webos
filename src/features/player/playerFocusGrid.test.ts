import { describe, expect, it } from 'vitest';
import { buildRowTargets, buildStackedGridFocusMap } from './playerFocusGrid';

describe('playerFocusGrid', () => {
  it('buildRowTargets 会把目标列映射到首行或末行的最近按钮', () => {
    expect(buildRowTargets(['a', 'b', 'c'], 2, 'first', 3)).toEqual(['a', 'b', 'b']);
    expect(buildRowTargets(['a', 'b', 'c', 'd', 'e'], 2, 'last', 3)).toEqual(['e', 'e', 'e']);
  });

  it('buildStackedGridFocusMap 会把上下 section 按列连接起来', () => {
    const focusMap = buildStackedGridFocusMap([
      { ids: ['quality-1080', 'quality-720'], columns: 2 },
      { ids: ['codec-auto', 'codec-avc', 'codec-hevc'], columns: 2 },
      { ids: ['action-reload', 'action-order'], columns: 2 },
    ]);

    expect(focusMap['quality-1080']).toMatchObject({
      right: 'quality-720',
      down: 'codec-auto',
    });
    expect(focusMap['quality-720']).toMatchObject({
      left: 'quality-1080',
      down: 'codec-avc',
    });
    expect(focusMap['codec-hevc']).toMatchObject({
      left: undefined,
      up: 'codec-auto',
      down: 'action-reload',
    });
    expect(focusMap['action-order']).toMatchObject({
      left: 'action-reload',
      up: 'codec-hevc',
    });
  });

  it('会忽略空 section，不打断前后 section 的上下映射', () => {
    const focusMap = buildStackedGridFocusMap([
      { ids: ['display-on', 'display-off'], columns: 2 },
      { ids: [], columns: 2 },
      { ids: ['font-standard', 'font-large', 'font-xl'], columns: 3 },
    ]);

    expect(focusMap['display-on']?.down).toBe('font-standard');
    expect(focusMap['display-off']?.down).toBe('font-large');
    expect(focusMap['font-standard']?.up).toBe('display-on');
    expect(focusMap['font-large']?.up).toBe('display-off');
  });
});
