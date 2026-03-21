import { FocusButton } from './FocusButton';

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
        <FocusButton row={0} col={10} variant="glass" size="icon" onClick={onBack}>
          返回
        </FocusButton>
        <FocusButton row={0} col={11} variant="glass" size="icon" onClick={onReplay}>
          -10 秒
        </FocusButton>
        <FocusButton row={0} col={12} variant="primary" size="icon-lg" defaultFocus onClick={onTogglePlay}>
          {isPlaying ? '暂停' : '播放'}
        </FocusButton>
        <FocusButton row={0} col={13} variant="glass" size="icon" onClick={onForward}>
          +10 秒
        </FocusButton>
        <FocusButton row={0} col={14} variant="glass" onClick={onRefresh}>
          重载播放源
        </FocusButton>
      </div>
    </div>
  );
}
