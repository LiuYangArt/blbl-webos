import { TV_ICONS } from '../app/iconRegistry';
import { TvIconButton } from './TvIconButton';

type PlayerControlBarProps = {
  isPlaying: boolean;
  onBack: () => void;
  onReplay: () => void;
  onTogglePlay: () => void;
  onForward: () => void;
  onRefresh: () => void;
  onOpenSettings: () => void;
};

export function PlayerControlBar({
  isPlaying,
  onBack,
  onReplay,
  onTogglePlay,
  onForward,
  onRefresh,
  onOpenSettings,
}: PlayerControlBarProps) {
  const secondaryActions = [
    { col: 10, symbol: TV_ICONS.playerBack, label: '返回', onClick: onBack },
    { col: 11, symbol: TV_ICONS.playerReplay10, label: '-10 秒', onClick: onReplay },
    { col: 13, symbol: TV_ICONS.playerForward10, label: '+10 秒', onClick: onForward },
    { col: 14, symbol: TV_ICONS.playerRefresh, label: '重载播放源', onClick: onRefresh },
    { col: 15, symbol: TV_ICONS.playerSettings, label: '设置', onClick: onOpenSettings },
  ] as const;

  return (
    <div className="player-control-bar">
      <div className="player-control-bar__row">
        {secondaryActions.slice(0, 2).map((action) => (
          <TvIconButton
            key={action.col}
            row={0}
            col={action.col}
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
          row={0}
          col={12}
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
            key={action.col}
            row={0}
            col={action.col}
            symbol={action.symbol}
            label={action.label}
            iconSize="md"
            variant="glass"
            size="md"
            className="player-control-bar__action"
            onClick={action.onClick}
          />
        ))}
      </div>
    </div>
  );
}
