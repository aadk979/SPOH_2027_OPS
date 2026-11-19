import type { PendingChange } from '@spoh/shared';
import { Button } from '../../components/ui';
import { sgtClock } from '../../lib/timeAgo';
import { useAcknowledge } from './dutyApi';

/**
 * Wireframe A2: "Your duty changed", old → new, with one Got it for everything shown
 * (FR-DUTY-5/7). Kept on screen until acknowledged.
 */
export function PendingBanner({ pending }: { pending: PendingChange[] }) {
  const ack = useAcknowledge();
  if (pending.length === 0) return null;
  return (
    <section
      aria-label="Your duty changed"
      className="flex flex-col gap-3 rounded-card border-2 border-accent bg-surface p-4"
    >
      <h2 className="font-display text-lg font-bold text-accent">
        {pending.length === 1 ? 'Your duty changed' : `Your duty changed (${pending.length})`}
      </h2>
      <ul className="flex flex-col gap-2">
        {pending.map((p) => (
          <li key={p.id}>
            <div className="font-semibold">{p.summary}</div>
            <div className="text-xs text-muted">
              Changed{p.createdBy ? ` by ${p.createdBy}` : ''} · {sgtClock(p.createdAt)}
            </div>
          </li>
        ))}
      </ul>
      {ack.error && <p className="text-sm text-busy">Not saved. {ack.error.message}</p>}
      <Button
        variant="hero"
        className="min-h-14 text-base"
        disabled={ack.isPending}
        onClick={() => ack.mutate(pending.map((p) => p.id))}
      >
        {ack.isPending ? 'Saving…' : 'Got it'}
      </Button>
    </section>
  );
}
