import type { ButtonHTMLAttributes, ReactNode } from 'react';

type FocusButtonProps = {
  row: number;
  col: number;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function FocusButton({ row, col, children, className, ...props }: FocusButtonProps) {
  return (
    <button
      {...props}
      className={['focus-button', className].filter(Boolean).join(' ')}
      data-focus-row={row}
      data-focus-col={col}
    >
      {children}
    </button>
  );
}
