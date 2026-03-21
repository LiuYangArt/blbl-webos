import type { ButtonHTMLAttributes, ReactNode } from 'react';

type FocusButtonProps = {
  row: number;
  col: number;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'glass' | 'card';
  size?: 'md' | 'hero' | 'icon' | 'icon-lg';
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function FocusButton({
  row,
  col,
  children,
  className,
  variant = 'secondary',
  size = 'md',
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
    >
      {children}
    </button>
  );
}
