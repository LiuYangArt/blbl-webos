import type { ButtonHTMLAttributes } from 'react';
import type { VideoCardItem } from '../services/api/types';
import { FocusButton } from './FocusButton';

type MediaCardProps = {
  item: VideoCardItem;
  onClick: () => void;
  focusId?: string;
  sectionId?: string;
  defaultFocus?: boolean;
  focusLeft?: string;
  focusRight?: string;
  focusUp?: string;
  focusDown?: string;
} & Pick<ButtonHTMLAttributes<HTMLButtonElement>, 'onFocus'>;

export function MediaCard({
  item,
  onClick,
  focusId,
  sectionId,
  defaultFocus = false,
  focusLeft,
  focusRight,
  focusUp,
  focusDown,
  onFocus,
}: MediaCardProps) {
  return (
    <FocusButton
      variant="card"
      className="media-card"
      focusId={focusId}
      sectionId={sectionId}
      defaultFocus={defaultFocus}
      focusLeft={focusLeft}
      focusRight={focusRight}
      focusUp={focusUp}
      focusDown={focusDown}
      onClick={onClick}
      onFocus={onFocus}
    >
      <div className="media-card__poster" aria-hidden="true">
        {item.cover ? <img src={item.cover} alt="" referrerPolicy="no-referrer" /> : null}
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
