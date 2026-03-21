import { FocusButton } from './FocusButton';

type HeroBannerProps = {
  title: string;
  description: string;
  meta: string[];
  onPlay: () => void;
  onSecondaryAction: () => void;
};

export function HeroBanner({
  title,
  description,
  meta,
  onPlay,
  onSecondaryAction,
}: HeroBannerProps) {
  return (
    <section className="hero-banner">
      <div className="hero-banner__backdrop" aria-hidden="true">
        <div className="hero-banner__orb hero-banner__orb--pink" />
        <div className="hero-banner__orb hero-banner__orb--blue" />
        <div className="hero-banner__portrait" />
      </div>

      <div className="hero-banner__content">
        <span className="hero-banner__tag">本周精选</span>
        <h1>{title}</h1>
        <div className="hero-banner__meta" aria-label="视频信息">
          {meta.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <p className="hero-banner__description">{description}</p>
        <div className="hero-banner__actions">
          <FocusButton row={0} col={0} variant="primary" size="hero" onClick={onPlay}>
            立即观看
          </FocusButton>
          <FocusButton row={0} col={1} variant="secondary" size="hero" onClick={onSecondaryAction}>
            加入稍后再看
          </FocusButton>
        </div>
      </div>

      <div className="hero-banner__pagination" aria-hidden="true">
        <span className="hero-banner__dot hero-banner__dot--active" />
        <span className="hero-banner__dot" />
        <span className="hero-banner__dot" />
      </div>
    </section>
  );
}
