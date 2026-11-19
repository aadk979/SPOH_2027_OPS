import clsx from 'clsx';
import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'hero' | 'secondary' | 'danger' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  block?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent shadow-[0_8px_20px_rgb(215_31_48/0.22)]',
  hero: 'bg-hero text-on-hero',
  secondary: 'border border-line bg-surface text-ink',
  danger: 'border border-busy text-busy bg-surface',
  ghost: 'text-ink-2 hover:bg-surface-2',
};

/** Design-system button. `hero` is reserved for the single main action on a screen. */
export function Button({ variant = 'primary', block, className, type, ...rest }: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-btn px-4 py-2.5 text-sm font-bold',
        'transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100',
        VARIANTS[variant],
        block && 'w-full',
        className,
      )}
      {...rest}
    />
  );
}
