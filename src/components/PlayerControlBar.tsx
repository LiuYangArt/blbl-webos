import { TV_ICONS } from '../app/iconRegistry';
import { FocusSection } from '../platform/focus';
import { TvIconButton } from './TvIconButton';

type PlayerControlBarProps = {
  sectionId: string;
  isPlaying: boolean;
  onBack: () => void;
  onReplay: () => void;
  onTogglePlay: () => void;
  onForward: () => void;
  onRefresh: () => void;
  onOpenSettings: () => void;
};

export function PlayerControlBar({
  sectionId,
  isPlaying,
  onBack,
  onReplay,
  onTogglePlay,
  onForward,
  onRefresh,
  onOpenSettings,
}: PlayerControlBarProps) {
  const secondaryActions = [
    { focusId: 'player-back', symbol: TV_ICONS.playerBack, label: '返回', onClick: onBack },
    { focusId: 'player-replay', symbol: TV_ICONS.playerReplay10, label: '-10 秒', onClick: onReplay },
    { focusId: 'player-forward', symbol: TV_ICONS.playerForward10, label: '+10 秒', onClick: onForward },
    { focusId: 'player-refresh', symbol: TV_ICONS.playerRefresh, label: '重载播放源', onClick: onRefresh },
    { focusId: 'player-open-settings', symbol: TV_ICONS.playerSettings, label: '设置', onClick: onOpenSettings },
  ] as const;

  return (
    <div className="player-control-bar">
      <FocusSection
        as="div"
        id={sectionId}
        group="content"
        enterTo="last-focused"
        className="player-control-bar__row"
        leaveFor={{ left: '@side-nav', down: '@player-related-grid' }}
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
            className="player-control-bar__action"
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
