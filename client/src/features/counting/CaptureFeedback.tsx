import { Notice } from '../../components/ui';
import { SaveStateBar } from './SaveStateBar';
import { UndoToast } from './UndoToast';
import type { Capture } from './useCountCapture';

/**
 * The feedback strip under every counting pad: Saved + Undo, retrying, or why it failed.
 * It keeps a fixed minimum height so the buttons don't jump while you tap.
 */
export function CaptureFeedback<P>({ capture }: { capture: Capture<P> }) {
  const { lastSaved } = capture;
  return (
    <div className="flex min-h-14 flex-col gap-2" aria-live="polite">
      <SaveStateBar
        pending={capture.pending}
        failed={capture.failed}
        onCancel={capture.cancelPending}
        onDismiss={capture.dismissFailed}
      />
      {lastSaved && (
        <UndoToast
          key={lastSaved.job.id}
          label={lastSaved.job.label}
          sentAt={lastSaved.sentAt}
          busy={capture.undoing}
          onUndo={capture.undoLast}
          onExpire={capture.dismissSaved}
        />
      )}
      {capture.undoError && <Notice tone="error">{capture.undoError}</Notice>}
    </div>
  );
}

/** People in taps that are still on their way to the server (shown optimistically). */
export function pendingPeople<P>(capture: Capture<P>): number {
  return capture.pending.reduce((n, j) => n + j.people, 0);
}
