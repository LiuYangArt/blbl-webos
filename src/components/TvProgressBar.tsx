import type { MouseEvent } from 'react';

type TvProgressBarProps = {
  leadingLabel: string;
  trailingLabel: string;
  valuePercent: number;
  onSeekPercent?: (valuePercent: number) => void;
};

export function TvProgressBar({
  leadingLabel,
  trailingLabel,
  valuePercent,
  onSeekPercent,
}: TvProgressBarProps) {
  const normalizedValue = Math.max(0, Math.min(100, valuePercent));
  const isInteractive = typeof onSeekPercent === 'function';

  const handleTrackClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!onSeekPercent) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }

    const clickOffset = event.clientX - rect.left;
    const nextPercent = Math.max(0, Math.min(100, (clickOffset / rect.width) * 100));
    onSeekPercent(nextPercent);
  };

  return (
    <div className="player-progress">
      <div className="player-progress__meta">
        <span>{leadingLabel}</span>
        <span>{trailingLabel}</span>
      </div>
      <div
        className={['player-progress__track', isInteractive ? 'player-progress__track--interactive' : ''].filter(Boolean).join(' ')}
        onClick={isInteractive ? handleTrackClick : undefined}
      >
        <div className="player-progress__value" style={{ width: `${normalizedValue}%` }} />
      </div>
    </div>
  );
}
