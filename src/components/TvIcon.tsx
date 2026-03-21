import type { HTMLAttributes } from 'react';
import type { TvIconName } from '../app/iconRegistry';

type TvIconProps = {
  symbol: TvIconName;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  filled?: boolean;
  decorative?: boolean;
} & HTMLAttributes<HTMLSpanElement>;

export function TvIcon({
  symbol,
  size = 'md',
  filled = false,
  decorative = true,
  className,
  ...props
}: TvIconProps) {
  return (
    <span
      {...props}
      aria-hidden={decorative ? true : undefined}
      className={['tv-icon', 'material-symbols-rounded', `tv-icon--${size}`, filled ? 'tv-icon--filled' : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      {symbol}
    </span>
  );
}
