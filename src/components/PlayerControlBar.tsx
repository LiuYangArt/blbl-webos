import { FocusButton } from './FocusButton';

type PlayerControlBarProps = {
  onBack: () => void;
  onTogglePlay: () => void;
  onReplay: () => void;
  onForward: () => void;
  onDanmaku: () => void;
  onQuality: () => void;
  onSettings: () => void;
};

export function PlayerControlBar({
  onBack,
  onTogglePlay,
  onReplay,
  onForward,
  onDanmaku,
  onQuality,
  onSettings,
}: PlayerControlBarProps) {
  return (
    <div className="player-control-bar">
      <div className="player-control-bar__row">
        <FocusButton row={0} col={0} variant="glass" size="icon" onClick={onBack}>
          返回
        </FocusButton>
        <FocusButton row={0} col={1} variant="glass" size="icon" onClick={onReplay}>
          -10 秒
        </FocusButton>
        <FocusButton row={0} col={2} variant="primary" size="icon-lg" onClick={onTogglePlay}>
          播放
        </FocusButton>
        <FocusButton row={0} col={3} variant="glass" size="icon" onClick={onForward}>
          +10 秒
        </FocusButton>
      </div>

      <div className="player-control-bar__row player-control-bar__row--right">
        <FocusButton row={0} col={4} variant="glass" onClick={onDanmaku}>
          弹幕开关
        </FocusButton>
        <FocusButton row={0} col={5} variant="glass" onClick={onQuality}>
          1080P
        </FocusButton>
        <FocusButton row={0} col={6} variant="glass" onClick={onSettings}>
          设置
        </FocusButton>
      </div>
    </div>
  );
}
