import type { ButtonHTMLAttributes, ReactNode } from 'react';

type FocusButtonProps = {
  row: number;
  col: number;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'glass' | 'card' | 'nav' | 'ghost';
  size?: 'sm' | 'md' | 'hero' | 'icon' | 'icon-lg';
  defaultFocus?: boolean;
  focusGroup?: 'content' | 'nav' | string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function FocusButton({
  row,
  col,
  children,
  className,
  variant = 'secondary',
  size = 'md',
  defaultFocus = false,
  focusGroup = 'content',
  type = 'button',
  ...props
}: FocusButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={['focus-button', `focus-button--${variant}`, `focus-button--${size}`, className]
        .filter(Boolean)
        .join(' ')}
      data-focus-row={row}
      data-focus-col={col}
      data-focus-default={defaultFocus ? 'true' : undefined}
      data-focus-group={focusGroup}
    >
      {children}
    </button>
  );
}
