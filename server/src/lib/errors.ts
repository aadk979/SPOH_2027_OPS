/**
 * Errors with a stable machine-readable `code` and an HTTP status. Services throw these;
 * the error-handler plugin turns them into `{ error: { code, message, details? } }`.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Please sign in.') =>
  new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'You are not allowed to do this.') =>
  new AppError(403, 'FORBIDDEN', message);
export const notFound = (what = 'Item') => new AppError(404, 'NOT_FOUND', `${what} not found.`);
export const conflict = (message: string, details?: unknown) =>
  new AppError(409, 'CONFLICT', message, details);
export const tooManyRequests = (message: string) => new AppError(429, 'TOO_MANY_REQUESTS', message);
