import type { VideoCardItem } from '../services/api/types';
import { FocusButton } from './FocusButton';

type MediaCardProps = {
  row: number;
  col: number;
  item: VideoCardItem;
  onClick: () => void;
};

export function MediaCard({ row, col, item, onClick }: MediaCardProps) {
  return (
    <FocusButton
      row={row}
      col={col}
      variant="card"
      className="media-card"
      onClick={onClick}
    >
      <div className="media-card__poster" aria-hidden="true">
        {item.cover ? <img src={item.cover} alt="" /> : null}
        <span className="media-card__duration">{formatDuration(item.duration)}</span>
        {item.reason ? <span className="media-card__reason">{item.reason}</span> : null}
      </div>
      <div className="media-card__body">
        <strong>{item.title}</strong>
        <span>{item.ownerName || item.typeName || '哔哩哔哩'}</span>
      </div>
    </FocusButton>
  );
}

function formatDuration(duration: number) {
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
