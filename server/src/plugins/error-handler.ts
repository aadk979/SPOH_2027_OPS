import type { FastifyError, FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { AppError } from '../lib/errors.js';

export interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

/** Consistent JSON error responses; never leaks stack traces or SQL to clients. */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err: FastifyError | AppError, request, reply) => {
    if (err instanceof AppError) {
      const body: ErrorBody = { error: { code: err.code, message: err.message } };
      if (err.details !== undefined) body.error.details = err.details;
      return reply.status(err.statusCode).send(body);
    }

    if (hasZodFastifySchemaValidationErrors(err)) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Some fields are missing or invalid.',
          details: err.validation.map((v) => ({
            path: v.instancePath.replace(/^\//, '').replaceAll('/', '.'),
            message: v.message,
          })),
        },
      } satisfies ErrorBody);
    }

    if (err.statusCode && err.statusCode < 500) {
      return reply
        .status(err.statusCode)
        .send({ error: { code: err.code ?? 'REQUEST_ERROR', message: err.message } });
    }

    request.log.error({ err }, 'Unhandled error');
    return reply
      .status(500)
      .send({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
  });
}

const NOT_FOUND_BODY: ErrorBody = { error: { code: 'NOT_FOUND', message: 'Route not found.' } };

/**
 * JSON 404 for unknown API routes. When the server also hosts the client, every other
 * unknown path falls back to index.html so client-side routes (e.g. /duty) load on refresh.
 */
export function registerNotFound(app: FastifyInstance, options: { spaFallback: boolean }): void {
  app.setNotFoundHandler((request, reply) => {
    if (options.spaFallback && request.method === 'GET' && !request.url.startsWith('/api')) {
      return reply.sendFile('index.html');
    }
    return reply.status(404).send(NOT_FOUND_BODY);
  });
}
