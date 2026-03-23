import { TV_ICONS } from '../app/iconRegistry';
import { FocusSection } from '../platform/focus';
import { TvIconButton } from './TvIconButton';

type PlayerControlBarProps = {
  sectionId: string;
  isPlaying: boolean;
  disabled?: boolean;
  subtitleAvailable?: boolean;
  onBack: () => void;
  onReplay: () => void;
  onTogglePlay: () => void;
  onForward: () => void;
  onRestartFromBeginning: () => void;
  onRefresh: () => void;
  onOpenEpisodes: () => void;
  onOpenSubtitles: () => void;
  onOpenSettings: () => void;
  onOpenRecommendations: () => void;
};

export function PlayerControlBar({
  sectionId,
  isPlaying,
  disabled = false,
  subtitleAvailable = true,
  onBack,
  onReplay,
  onTogglePlay,
  onForward,
  onRestartFromBeginning,
  onRefresh,
  onOpenEpisodes,
  onOpenSubtitles,
  onOpenSettings,
  onOpenRecommendations,
}: PlayerControlBarProps) {
  const secondaryActions: Array<{
    focusId: string;
    symbol: (typeof TV_ICONS)[keyof typeof TV_ICONS];
    label: string;
    onClick: () => void;
    className?: string;
  }> = [
    { focusId: 'player-back', symbol: TV_ICONS.playerBack, label: '返回', onClick: onBack },
    { focusId: 'player-replay', symbol: TV_ICONS.playerReplay10, label: '-10 秒', onClick: onReplay },
    { focusId: 'player-forward', symbol: TV_ICONS.playerForward10, label: '+10 秒', onClick: onForward },
    { focusId: 'player-restart', symbol: TV_ICONS.playerRestart, label: '从头播放', onClick: onRestartFromBeginning },
    { focusId: 'player-refresh', symbol: TV_ICONS.playerRefresh, label: '重载播放源', onClick: onRefresh },
    { focusId: 'player-open-episodes', symbol: TV_ICONS.playerEpisodes, label: '分P / 选集', onClick: onOpenEpisodes },
    {
      focusId: 'player-open-subtitles',
      symbol: TV_ICONS.playerSubtitle,
      label: 'CC 字幕',
      onClick: onOpenSubtitles,
      className: subtitleAvailable ? undefined : 'focus-button--disabled player-control-bar__action--inactive',
    },
    { focusId: 'player-open-settings', symbol: TV_ICONS.playerSettings, label: '设置', onClick: onOpenSettings },
    { focusId: 'player-open-recommendations', symbol: TV_ICONS.playerRecommendations, label: '推荐视频', onClick: onOpenRecommendations },
  ];

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
        {secondaryActions.slice(0, 2).map((action) => (
          <TvIconButton
            key={action.focusId}
            sectionId={sectionId}
            focusId={action.focusId}
            symbol={action.symbol}
            label={action.label}
            iconSize="md"
            variant="glass"
            size="md"
            className={['player-control-bar__action', action.className].filter(Boolean).join(' ')}
            onClick={action.onClick}
          />
        ))}
        <TvIconButton
          sectionId={sectionId}
          focusId="player-toggle-play"
          symbol={isPlaying ? TV_ICONS.playerPause : TV_ICONS.playerPlay}
          label={isPlaying ? '暂停' : '播放'}
          iconSize="lg"
          variant="primary"
          size="md"
          className="player-control-bar__action player-control-bar__action--primary"
          defaultFocus
          onClick={onTogglePlay}
        />
        {secondaryActions.slice(2).map((action) => (
          <TvIconButton
            key={action.focusId}
            sectionId={sectionId}
            focusId={action.focusId}
            symbol={action.symbol}
            label={action.label}
            iconSize="md"
            variant="glass"
            size="md"
            className="player-control-bar__action"
            onClick={action.onClick}
          />
        ))}
      </FocusSection>
    </div>
  );
}
