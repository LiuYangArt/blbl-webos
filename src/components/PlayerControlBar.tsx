import { useState } from 'react';
import { TV_ICONS } from '../app/iconRegistry';
import { FocusSection } from '../platform/focus';
import { TvIconButton } from './TvIconButton';

type PlayerControlBarProps = {
  sectionId: string;
  isPlaying: boolean;
  disabled?: boolean;
  authorAvailable?: boolean;
  subtitleAvailable?: boolean;
  onBack: () => void;
  onReplay: () => void;
  onTogglePlay: () => void;
  onForward: () => void;
  onRestartFromBeginning: () => void;
  onRefresh: () => void;
  onOpenEpisodes: () => void;
  onOpenAuthor: () => void;
  onOpenSubtitles: () => void;
  onOpenSettings: () => void;
  onOpenRecommendations: () => void;
};

type PlayerControlAction = {
  focusId: string;
  symbol: (typeof TV_ICONS)[keyof typeof TV_ICONS];
  label: string;
  onClick: () => void;
  className?: string;
  defaultFocus?: boolean;
};

export function PlayerControlBar({
  sectionId,
  isPlaying,
  disabled = false,
  authorAvailable = true,
  subtitleAvailable = true,
  onBack,
  onReplay,
  onTogglePlay,
  onForward,
  onRestartFromBeginning,
  onRefresh,
  onOpenEpisodes,
  onOpenAuthor,
  onOpenSubtitles,
  onOpenSettings,
  onOpenRecommendations,
}: PlayerControlBarProps) {
  const [focusedActionId, setFocusedActionId] = useState<string | null>(null);
  const secondaryActions: PlayerControlAction[] = [
    { focusId: 'player-back', symbol: TV_ICONS.playerBack, label: '返回', onClick: onBack },
    { focusId: 'player-replay', symbol: TV_ICONS.playerReplay10, label: '-10 秒', onClick: onReplay },
    { focusId: 'player-forward', symbol: TV_ICONS.playerForward10, label: '+10 秒', onClick: onForward },
    { focusId: 'player-restart', symbol: TV_ICONS.playerRestart, label: '从头播放', onClick: onRestartFromBeginning },
    { focusId: 'player-refresh', symbol: TV_ICONS.playerRefresh, label: '重载播放源', onClick: onRefresh },
    { focusId: 'player-open-episodes', symbol: TV_ICONS.playerEpisodes, label: '分P / 选集', onClick: onOpenEpisodes },
    {
      focusId: 'player-open-author',
      symbol: TV_ICONS.playerAuthor,
      label: 'UP主页',
      onClick: onOpenAuthor,
      className: getAvailabilityActionClass(authorAvailable),
    },
    {
      focusId: 'player-open-subtitles',
      symbol: TV_ICONS.playerSubtitle,
      label: 'CC 字幕',
      onClick: onOpenSubtitles,
      className: getAvailabilityActionClass(subtitleAvailable),
    },
    { focusId: 'player-open-settings', symbol: TV_ICONS.playerSettings, label: '设置', onClick: onOpenSettings },
    { focusId: 'player-open-recommendations', symbol: TV_ICONS.playerRecommendations, label: '推荐视频', onClick: onOpenRecommendations },
  ];

  const renderAction = (action: PlayerControlAction) => {
    const isExpanded = focusedActionId === action.focusId;

    return (
      <TvIconButton
        key={action.focusId}
        sectionId={sectionId}
        focusId={action.focusId}
        symbol={action.symbol}
        label={action.label}
        iconSize="xl"
        variant="glass"
        size="md"
        defaultFocus={action.defaultFocus}
        className={[
          'player-control-bar__action',
          isExpanded ? 'player-control-bar__action--expanded' : '',
          action.className,
        ].filter(Boolean).join(' ')}
        labelClassName={isExpanded ? undefined : 'player-control-bar__label--hidden'}
        onFocus={() => setFocusedActionId(action.focusId)}
        onBlur={() => setFocusedActionId((current) => (current === action.focusId ? null : current))}
        onClick={action.onClick}
      />
    );
  };

  return (
    <div className="player-control-bar">
      <FocusSection
        as="div"
        id={sectionId}
        group="content"
        enterTo="last-focused"
        disabled={disabled}
        className="player-control-bar__row"
      >
        {secondaryActions.slice(0, 2).map(renderAction)}
        {renderAction({
          focusId: 'player-toggle-play',
          symbol: isPlaying ? TV_ICONS.playerPause : TV_ICONS.playerPlay,
          label: isPlaying ? '暂停' : '播放',
          onClick: onTogglePlay,
          defaultFocus: true,
        })}
        {secondaryActions.slice(2).map(renderAction)}
      </FocusSection>
    </div>
  );
}

function getAvailabilityActionClass(isAvailable: boolean): string | undefined {
  if (isAvailable) {
    return undefined;
  }

  return 'focus-button--disabled player-control-bar__action--inactive';
}
