import { FocusButton } from './FocusButton';

type MediaCardProps = {
  row: number;
  col: number;
  title: string;
  subtitle: string;
  duration: string;
  tone: 'sunset' | 'peach' | 'cyan' | 'violet' | 'rose' | 'ember';
  onClick: () => void;
};

export function MediaCard({
  row,
  col,
  title,
  subtitle,
  duration,
  tone,
  onClick,
}: MediaCardProps) {
  return (
    <FocusButton
      row={row}
      col={col}
      variant="card"
      className={['media-card', `media-card--${tone}`].join(' ')}
      onClick={onClick}
    >
      <div className="media-card__poster" aria-hidden="true">
        <span className="media-card__duration">{duration}</span>
      </div>
      <div className="media-card__body">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
    </FocusButton>
  );
}
