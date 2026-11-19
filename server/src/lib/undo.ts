import { UNDO_WINDOW_MS, type CurrentUser } from '@spoh/shared';
import { AppError, forbidden } from './errors.js';

/**
 * Undo rule shared by every kind of tap (FR-REG-3, FR-FOOT-5, later FR-GIFT-5): only the
 * person who recorded it, and only within the undo window. Later fixes are an Admin void.
 */
export function assertUndoable(
  record: { recordedBy: string | null; recordedAt: Date },
  user: CurrentUser,
  now: Date,
): void {
  if (record.recordedBy !== user.id) {
    throw forbidden('Only the person who recorded this can undo it.');
  }
  if (now.getTime() - record.recordedAt.getTime() > UNDO_WINDOW_MS) {
    throw new AppError(409, 'UNDO_EXPIRED', 'Too late to undo. Ask an Admin to correct it.');
  }
}
