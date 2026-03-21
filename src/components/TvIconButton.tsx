import type { ComponentProps } from 'react';
import type { TvIconName } from '../app/iconRegistry';
import { FocusButton } from './FocusButton';
import { TvIcon } from './TvIcon';

type FocusButtonProps = ComponentProps<typeof FocusButton>;

type TvIconButtonProps = {
  symbol: TvIconName;
  label: string;
  iconSize?: 'sm' | 'md' | 'lg' | 'xl';
  iconFilled?: boolean;
  contentClassName?: string;
  iconClassName?: string;
  labelClassName?: string;
} & Omit<FocusButtonProps, 'children'>;

export function TvIconButton({
  symbol,
  label,
  iconSize = 'md',
  iconFilled = false,
  className,
  contentClassName,
  iconClassName,
  labelClassName,
  ...props
}: TvIconButtonProps) {
  return (
    <FocusButton {...props} className={className}>
      <span className={['tv-icon-button__content', contentClassName].filter(Boolean).join(' ')}>
        <span className={['tv-icon-button__icon', iconClassName].filter(Boolean).join(' ')}>
          <TvIcon symbol={symbol} size={iconSize} filled={iconFilled} />
        </span>
        <span className={['tv-icon-button__label', labelClassName].filter(Boolean).join(' ')}>
          {label}
        </span>
      </span>
    </FocusButton>
  );
}
