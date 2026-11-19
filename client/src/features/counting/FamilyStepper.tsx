import { useState } from 'react';
import { MAX_RECORDS_PER_REQUEST, REG_CATEGORIES, REG_CATEGORY_LABELS } from '@spoh/shared';
import type { RegCategory } from '@spoh/shared';
import { Button } from '../../components/ui';

const SHORT_LABELS: Partial<Record<RegCategory, string>> = { graduated: 'Graduated' };

type Counts = Record<RegCategory, number>;
const empty = (): Counts =>
  Object.fromEntries(REG_CATEGORIES.map((c) => [c, 0])) as unknown as Counts;

/**
 * Wireframe A4: set how many of each category, then confirm. Each person is still one
 * record; they share a group ID so the whole family can be undone together (FR-REG-2).
 */
export function FamilyStepper({
  stationName,
  onConfirm,
  onBack,
}: {
  stationName: string;
  onConfirm: (counts: Counts) => void;
  onBack: () => void;
}) {
  const [counts, setCounts] = useState<Counts>(empty);
  const total = REG_CATEGORIES.reduce((n, c) => n + counts[c], 0);
  const full = total >= MAX_RECORDS_PER_REQUEST;
  const change = (c: RegCategory, delta: 1 | -1) =>
    setCounts((prev) => ({ ...prev, [c]: Math.max(0, prev[c] + delta) }));

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button variant="ghost" className="-ml-2 min-h-11" onClick={onBack}>
          ← Back
        </Button>
        <h1 className="font-display text-2xl font-bold tracking-tight">Family arriving together</h1>
        <p className="text-sm text-muted">
          {stationName}. Set how many of each, then confirm. Everyone is counted individually.
        </p>
      </div>

      <ul className="flex flex-col divide-y divide-line rounded-card border border-line bg-surface">
        {REG_CATEGORIES.map((c) => {
          const label = SHORT_LABELS[c] ?? REG_CATEGORY_LABELS[c];
          return (
            <li key={c} className="flex items-center justify-between gap-2 px-3 py-1.5">
              <span className="text-[15px] font-semibold">{label}</span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={`One fewer ${label}`}
                  className="size-16 rounded-full text-3xl font-bold text-ink-2 active:bg-surface-2 disabled:opacity-30"
                  disabled={counts[c] === 0}
                  onClick={() => change(c, -1)}
                >
                  −
                </button>
                <output
                  aria-label={`${label} count`}
                  className="w-8 text-center font-mono text-xl font-bold"
                >
                  {counts[c]}
                </output>
                <button
                  type="button"
                  aria-label={`One more ${label}`}
                  className="size-16 rounded-full text-3xl font-bold text-ink active:bg-surface-2 disabled:opacity-30"
                  disabled={full}
                  onClick={() => change(c, 1)}
                >
                  +
                </button>
              </span>
            </li>
          );
        })}
      </ul>

      <Button
        variant="primary"
        className="min-h-16 text-base"
        disabled={total === 0}
        onClick={() => onConfirm(counts)}
      >
        Confirm ({total} {total === 1 ? 'person' : 'people'})
      </Button>
    </div>
  );
}

export type FamilyCounts = Counts;
