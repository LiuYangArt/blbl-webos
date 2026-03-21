import { TV_ICONS } from '../app/iconRegistry';
import { FocusButton } from './FocusButton';
import { TvIcon } from './TvIcon';

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
        <FocusButton row={0} col={10} variant="glass" size="md" className="player-control-bar__action" onClick={onBack}>
          <span className="player-control-bar__action-content">
            <TvIcon symbol={TV_ICONS.playerBack} size="md" />
            <span className="player-control-bar__action-text">返回</span>
          </span>
        </FocusButton>
        <FocusButton row={0} col={11} variant="glass" size="md" className="player-control-bar__action" onClick={onReplay}>
          <span className="player-control-bar__action-content">
            <TvIcon symbol={TV_ICONS.playerReplay10} size="md" />
            <span className="player-control-bar__action-text">-10 秒</span>
          </span>
        </FocusButton>
        <FocusButton
          row={0}
          col={12}
          variant="primary"
          size="md"
          className="player-control-bar__action player-control-bar__action--primary"
          defaultFocus
          onClick={onTogglePlay}
        >
          <span className="player-control-bar__action-content">
            <TvIcon symbol={isPlaying ? TV_ICONS.playerPause : TV_ICONS.playerPlay} size="lg" />
            <span className="player-control-bar__action-text">{isPlaying ? '暂停' : '播放'}</span>
          </span>
        </FocusButton>
        <FocusButton row={0} col={13} variant="glass" size="md" className="player-control-bar__action" onClick={onForward}>
          <span className="player-control-bar__action-content">
            <TvIcon symbol={TV_ICONS.playerForward10} size="md" />
            <span className="player-control-bar__action-text">+10 秒</span>
          </span>
        </FocusButton>
        <FocusButton row={0} col={14} variant="glass" size="md" className="player-control-bar__action" onClick={onRefresh}>
          <span className="player-control-bar__action-content">
            <TvIcon symbol={TV_ICONS.playerRefresh} size="md" />
            <span className="player-control-bar__action-text">重载播放源</span>
          </span>
        </FocusButton>
      </div>
    </div>
  );
}
