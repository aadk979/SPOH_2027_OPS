import { ApiError } from './api';

/**
 * The server's message for one form field, from a 400 response's details
 * (`{ path }` from schema validation or `{ field }` from business rules).
 */
export function fieldError(error: unknown, field: string): string | undefined {
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) return undefined;
  const details = error.details as { field?: string; path?: string; message?: string }[];
  return details.find((d) => d.field === field || d.path === field)?.message;
}
