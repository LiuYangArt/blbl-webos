import { TV_ICONS } from '../app/iconRegistry';
import { TvIconButton } from './TvIconButton';

type PlayerControlBarProps = {
  isPlaying: boolean;
  onBack: () => void;
  onReplay: () => void;
  onTogglePlay: () => void;
  onForward: () => void;
  onRefresh: () => void;
};

export function PlayerControlBar({
  isPlaying,
  onBack,
  onReplay,
  onTogglePlay,
  onForward,
  onRefresh,
}: PlayerControlBarProps) {
  return (
    <div className="player-control-bar">
      <div className="player-control-bar__row">
        <TvIconButton
          row={0}
          col={10}
          symbol={TV_ICONS.playerBack}
          label="返回"
          iconSize="md"
          variant="glass"
          size="md"
          className="player-control-bar__action"
          onClick={onBack}
        />
        <TvIconButton
          row={0}
          col={11}
          symbol={TV_ICONS.playerReplay10}
          label="-10 秒"
          iconSize="md"
          variant="glass"
          size="md"
          className="player-control-bar__action"
          onClick={onReplay}
        />
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
        <TvIconButton
          row={0}
          col={13}
          symbol={TV_ICONS.playerForward10}
          label="+10 秒"
          iconSize="md"
          variant="glass"
          size="md"
          className="player-control-bar__action"
          onClick={onForward}
        />
        <TvIconButton
          row={0}
          col={14}
          symbol={TV_ICONS.playerRefresh}
          label="重载播放源"
          iconSize="md"
          variant="glass"
          size="md"
          className="player-control-bar__action"
          onClick={onRefresh}
        />
      </div>
    </div>
  );
}
