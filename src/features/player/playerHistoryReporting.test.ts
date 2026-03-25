import { describe, expect, it } from 'vitest';
import {
  canSyncPlayerHistory,
  resolvePlayerHistoryFlush,
  resolvePlayerHistoryHeartbeat,
} from './playerHistoryReporting';

describe('playerHistoryReporting', () => {
  it('播放中 heartbeat 至少每 5 秒触发一次', () => {
    expect(resolvePlayerHistoryHeartbeat({
      trigger: 'playing',
      progress: 4,
      duration: 120,
      lastReportedProgress: 0,
    })).toBeNull();

    expect(resolvePlayerHistoryHeartbeat({
      trigger: 'playing',
      progress: 5,
      duration: 120,
      lastReportedProgress: 0,
    })).toEqual({
      playedTime: 5,
      nextReportedProgress: 5,
      completed: false,
    });
  });

  it('状态变化 heartbeat 至少每 2 秒补一次', () => {
    expect(resolvePlayerHistoryHeartbeat({
      trigger: 'status',
      progress: 6,
      duration: 120,
      lastReportedProgress: 5,
    })).toBeNull();

    expect(resolvePlayerHistoryHeartbeat({
      trigger: 'status',
      progress: 7,
      duration: 120,
      lastReportedProgress: 5,
    })).toEqual({
      playedTime: 7,
      nextReportedProgress: 7,
      completed: false,
    });
  });

  it('完成态 heartbeat 会在接近片尾时改成 -1', () => {
    expect(resolvePlayerHistoryHeartbeat({
      trigger: 'completed',
      progress: 119,
      duration: 120,
      lastReportedProgress: 110,
    })).toEqual({
      playedTime: -1,
      nextReportedProgress: 119,
      completed: true,
    });
  });

  it('进度 flush 会跳过重复值，但完成态会强制保留最后一次', () => {
    expect(resolvePlayerHistoryFlush({
      progress: 12,
      duration: 120,
      lastReportedProgress: 12,
    })).toBeNull();

    expect(resolvePlayerHistoryFlush({
      progress: 119,
      duration: 120,
      lastReportedProgress: 119,
      completed: true,
      completedReported: false,
    })).toEqual({
      progress: 120,
      completed: true,
    });
  });

  it('只有登录且 CID 有效时才允许同步历史', () => {
    expect(canSyncPlayerHistory(true, 123)).toBe(true);
    expect(canSyncPlayerHistory(false, 123)).toBe(false);
    expect(canSyncPlayerHistory(true, 0)).toBe(false);
  });
});
