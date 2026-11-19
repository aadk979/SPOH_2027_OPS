import clsx from 'clsx';
import type { ButtonHTMLAttributes, MouseEvent } from 'react';

export type TapPadSize = 'hero' | 'large' | 'tile' | 'small';
export type TapPadTone = 'hero' | 'hero-alt' | 'surface';

export interface TapPadProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: TapPadSize;
  tone?: TapPadTone;
}

/** Every size is at least 64 px tall (NFR-U-2). */
const SIZES: Record<TapPadSize, string> = {
  hero: 'min-h-40 rounded-hero text-6xl font-mono',
  large: 'min-h-28 rounded-hero px-4 text-xl font-display',
  tile: 'min-h-[76px] rounded-card px-3 text-[15px] leading-tight',
  small: 'min-h-16 rounded-btn px-2 text-lg font-mono',
};

const TONES: Record<TapPadTone, string> = {
  hero: 'bg-hero text-on-hero',
  'hero-alt': 'bg-ink-2 text-on-hero',
  surface: 'border border-line bg-surface text-ink hover:border-ink-2',
};

/**
 * The big counting button (design system "TapPad"): one obvious thing to press, thumb-sized,
 * with a short vibration where the phone supports it and a 0.98 press scale.
 */
export function TapPad({ size = 'hero', tone = 'hero', className, onClick, ...rest }: TapPadProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (typeof navigator.vibrate === 'function') navigator.vibrate(10);
    onClick?.(event);
  };
  return (
    <button
      type="button"
      className={clsx(
        'flex touch-manipulation select-none items-center justify-center text-center font-bold',
        'transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-40',
        SIZES[size],
        TONES[tone],
        className,
      )}
      onClick={handleClick}
      {...rest}
    />
  );
}
