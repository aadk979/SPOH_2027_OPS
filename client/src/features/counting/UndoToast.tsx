import { useEffect, useState } from 'react';
import { UNDO_WINDOW_MS } from '@spoh/shared';

/**
 * Green "Saved" bar with an Undo countdown (design system "UndoToast"). It disappears when
 * the 10 s window ends (FR-REG-3: undo after 10 s is not offered). The countdown starts when
 * the saving request was sent, so it always ends before the server's own window does.
 */
export function UndoToast({
  label,
  sentAt,
  busy,
  onUndo,
  onExpire,
}: {
  label: string;
  sentAt: number;
  busy: boolean;
  onUndo: () => void;
  onExpire: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  const secondsLeft = Math.ceil((UNDO_WINDOW_MS - (now - sentAt)) / 1000);
  const expired = secondsLeft <= 0;
  useEffect(() => {
    if (expired) onExpire();
  }, [expired, onExpire]);
  if (expired) return null;

  return (
    <div
      role="status"
      className="flex min-h-14 items-center justify-between gap-3 rounded-btn border border-ok/30 bg-ok-bg pl-3 text-sm text-ok"
    >
      <span className="font-semibold">✓ Saved: {label}</span>
      <button
        type="button"
        className="min-h-14 px-4 font-bold text-ink underline-offset-2 hover:underline disabled:opacity-50"
        disabled={busy}
        onClick={onUndo}
      >
        Undo <span className="font-mono">({secondsLeft}s)</span>
      </button>
    </div>
  );
}
