import clsx from 'clsx';

type Tone = 'neutral' | 'ok' | 'info' | 'error';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-2',
  ok: 'bg-ok-bg text-ok',
  info: 'bg-quiet-bg text-quiet',
  error: 'bg-busy-bg text-busy',
};

/** "3 new", "1 error": a count with a correctly pluralised noun. Not a room status. */
export function CountChip({
  count,
  one,
  many,
  tone = 'neutral',
}: {
  count: number;
  one: string;
  many?: string;
  tone?: Tone;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        TONES[tone],
      )}
    >
      <span className="font-mono">{count}</span> {count === 1 ? one : (many ?? `${one}s`)}
    </span>
  );
}
