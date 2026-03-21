import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';

type FocusButtonProps = {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'glass' | 'card' | 'nav' | 'ghost';
  size?: 'sm' | 'md' | 'hero' | 'icon' | 'icon-lg';
  defaultFocus?: boolean;
  focusGroup?: 'content' | 'nav' | 'overlay' | string;
  focusId?: string;
  sectionId?: string;
  focusLeft?: string;
  focusRight?: string;
  focusUp?: string;
  focusDown?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function FocusButton({
  children,
  className,
  variant = 'secondary',
  size = 'md',
  defaultFocus = false,
  focusGroup,
  focusId,
  sectionId,
  focusLeft,
  focusRight,
  focusUp,
  focusDown,
  type = 'button',
  ...props
}: FocusButtonProps) {
  const generatedId = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  return (
    <button
      {...props}
      type={type}
      className={['focus-button', `focus-button--${variant}`, `focus-button--${size}`, className]
        .filter(Boolean)
        .join(' ')}
      data-focusable="true"
      data-focus-id={focusId ?? `focus-${generatedId}`}
      data-focus-section={sectionId}
      data-focus-default={defaultFocus ? 'true' : undefined}
      data-focus-group={focusGroup}
      data-focus-left={focusLeft}
      data-focus-right={focusRight}
      data-focus-up={focusUp}
      data-focus-down={focusDown}
    >
      {children}
    </button>
  );
}
