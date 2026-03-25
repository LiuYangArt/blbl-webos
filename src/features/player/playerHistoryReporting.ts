export type PlayerHistoryHeartbeatTrigger = 'playing' | 'status' | 'completed';

type ResolvePlayerHistoryHeartbeatOptions = {
  trigger: PlayerHistoryHeartbeatTrigger;
  progress: number;
  duration: number;
  lastReportedProgress: number;
};

type ResolvePlayerHistoryFlushOptions = {
  progress: number;
  duration: number;
  lastReportedProgress: number;
  completed?: boolean;
  completedReported?: boolean;
};

export type PlayerHistoryHeartbeatDecision = {
  playedTime: number;
  nextReportedProgress: number;
  completed: boolean;
};

export type PlayerHistoryFlushDecision = {
  progress: number;
  completed: boolean;
};

const PLAYER_HISTORY_PLAYING_INTERVAL_SECONDS = 5;
const PLAYER_HISTORY_STATUS_INTERVAL_SECONDS = 2;
const PLAYER_HISTORY_COMPLETION_TOLERANCE_SECONDS = 1;

export function resolvePlayerHistoryHeartbeat(
  options: ResolvePlayerHistoryHeartbeatOptions,
): PlayerHistoryHeartbeatDecision | null {
  const progress = normalizeProgressSeconds(options.progress);
  if (progress <= 0) {
    return null;
  }

  const duration = normalizeProgressSeconds(options.duration);
  const completed = isPlaybackCompleted(progress, duration);

  switch (options.trigger) {
    case 'playing':
      if (progress - options.lastReportedProgress < PLAYER_HISTORY_PLAYING_INTERVAL_SECONDS) {
        return null;
      }
      return {
        playedTime: progress,
        nextReportedProgress: progress,
        completed: false,
      };
    case 'status':
      if (progress - options.lastReportedProgress < PLAYER_HISTORY_STATUS_INTERVAL_SECONDS) {
        return null;
      }
      return {
        playedTime: progress,
        nextReportedProgress: progress,
        completed: false,
      };
    case 'completed':
      return {
        playedTime: completed ? -1 : progress,
        nextReportedProgress: progress,
        completed,
      };
  }
}

export function resolvePlayerHistoryFlush(
  options: ResolvePlayerHistoryFlushOptions,
): PlayerHistoryFlushDecision | null {
  const progress = normalizeProgressSeconds(options.progress);
  if (progress <= 0) {
    return null;
  }

  const duration = normalizeProgressSeconds(options.duration);
  const completed = Boolean(options.completed) && isPlaybackCompleted(progress, duration);

  if (completed && options.completedReported) {
    return null;
  }

  const normalizedProgress = completed && duration > 0 ? duration : progress;
  if (!completed && normalizedProgress === options.lastReportedProgress) {
    return null;
  }

  return {
    progress: normalizedProgress,
    completed,
  };
}

export function canSyncPlayerHistory(isAuthenticated: boolean, cid: number) {
  return isAuthenticated && cid > 0;
}

function normalizeProgressSeconds(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

function isPlaybackCompleted(progress: number, duration: number) {
  return duration > 0 && duration - progress <= PLAYER_HISTORY_COMPLETION_TOLERANCE_SECONDS;
}
