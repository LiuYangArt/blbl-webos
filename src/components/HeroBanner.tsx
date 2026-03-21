import type { VideoCardItem } from '../services/api/types';
import { FocusButton } from './FocusButton';

type HeroBannerProps = {
  item: VideoCardItem;
  onPrimaryAction: () => void;
  onSecondaryAction: () => void;
  primaryLabel: string;
  secondaryLabel: string;
  sectionId: string;
  primaryFocusId: string;
  secondaryFocusId: string;
};

export function HeroBanner({
  item,
  onPrimaryAction,
  onSecondaryAction,
  primaryLabel,
  secondaryLabel,
  sectionId,
  primaryFocusId,
  secondaryFocusId,
}: HeroBannerProps) {
  return (
    <section className="hero-banner">
      <div className="hero-banner__backdrop" aria-hidden="true">
        <div className="hero-banner__orb hero-banner__orb--pink" />
        <div className="hero-banner__orb hero-banner__orb--blue" />
        <img className="hero-banner__cover" src={item.cover} alt="" referrerPolicy="no-referrer" />
      </div>

      <div className="hero-banner__content">
        <span className="hero-banner__tag">今日推荐</span>
        <h1>{item.title}</h1>
        <div className="hero-banner__meta" aria-label="视频信息">
          <span>{item.typeName || '推荐视频'}</span>
          <span>{item.ownerName}</span>
          <span>{formatPlayCount(item.playCount)} 播放</span>
        </div>
        <div className="hero-banner__actions">
          <FocusButton
            variant="primary"
            size="hero"
            sectionId={sectionId}
            focusId={primaryFocusId}
            defaultFocus
            onClick={onPrimaryAction}
          >
            {primaryLabel}
          </FocusButton>
          <FocusButton
            variant="secondary"
            size="hero"
            sectionId={sectionId}
            focusId={secondaryFocusId}
            onClick={onSecondaryAction}
          >
            {secondaryLabel}
          </FocusButton>
        </div>
      </div>
    </section>
  );
}

function formatPlayCount(value: number) {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)} 万`;
  }
  return `${value}`;
}
