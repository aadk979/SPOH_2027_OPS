import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { AppDeps } from './deps.js';

/** Options every feature module receives. */
export interface ModuleOptions {
  deps: AppDeps;
}

/** A feature module: a Fastify plugin with zod-typed routes and injected dependencies. */
export type AppPlugin = FastifyPluginAsync<ModuleOptions, never, ZodTypeProvider>;
