import { Button, Notice } from '../../components/ui';
import { ApiError } from '../../lib/api';

/** True when the server warned that a station would be left empty (FR-BRK-4). */
export const isCoverageGap = (err: unknown): err is ApiError =>
  err instanceof ApiError && err.code === 'COVERAGE_GAP';

/** Warn, don't block: the manager can go ahead or change the break. */
export function CoverageWarning({
  error,
  pending,
  onConfirm,
  onCancel,
}: {
  error: ApiError;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Notice tone="warn" className="flex flex-col gap-2">
      <span>{error.message} Go ahead anyway?</span>
      <div className="flex gap-2">
        <Button disabled={pending} onClick={onConfirm}>
          Yes, go ahead
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Change
        </Button>
      </div>
    </Notice>
  );
}
