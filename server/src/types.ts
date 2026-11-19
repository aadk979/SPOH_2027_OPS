import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { AppDeps } from './deps.js';

/** Options every feature module receives. */
export interface ModuleOptions {
  deps: AppDeps;
}

/** A feature module: a Fastify plugin with zod-typed routes and injected dependencies. */
export type AppPlugin = FastifyPluginAsyncZod<ModuleOptions>;
