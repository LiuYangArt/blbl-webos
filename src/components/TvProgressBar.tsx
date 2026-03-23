type TvProgressBarProps = {
  leadingLabel: string;
  trailingLabel: string;
  valuePercent: number;
};

export function TvProgressBar({
  leadingLabel,
  trailingLabel,
  valuePercent,
}: TvProgressBarProps) {
  const normalizedValue = Math.max(0, Math.min(100, valuePercent));

  return (
    <div className="player-progress">
      <div className="player-progress__meta">
        <span>{leadingLabel}</span>
        <span>{trailingLabel}</span>
      </div>
      <div className="player-progress__track">
        <div className="player-progress__value" style={{ width: `${normalizedValue}%` }} />
      </div>
    </div>
  );
}
