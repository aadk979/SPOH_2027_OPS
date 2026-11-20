import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { allowedOrigins } from './config.js';
import type { AppDeps } from './deps.js';
import { registerErrorHandler, registerNotFound } from './plugins/error-handler.js';
import { authPlugin } from './plugins/auth.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { peopleRoutes } from './modules/people/people.routes.js';
import { rosterRoutes } from './modules/roster/roster.routes.js';
import { configRoutes } from './modules/config/config.routes.js';
import { stationRoutes } from './modules/stations/stations.routes.js';
import { registrationRoutes } from './modules/registration/registration.routes.js';
import { footfallRoutes } from './modules/footfall/footfall.routes.js';
import { setupRoutes } from './modules/setup/setup.routes.js';
import { deploymentRoutes } from './modules/deployment/deployment.routes.js';
import { dutyRoutes } from './modules/duty/duty.routes.js';
import { notificationRoutes } from './modules/notifications/notifications.routes.js';
import { breakRoutes } from './modules/breaks/breaks.routes.js';

/**
 * Builds the Fastify app without starting it, so tests can call app.inject().
 * Each feature lives in src/modules/<feature>/ and is registered under /api here.
 */
export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { config } = deps;
  const app = Fastify({
    logger: config.NODE_ENV === 'test' ? false : { level: config.LOG_LEVEL },
    trustProxy: true,
    bodyLimit: 1_048_576, // 1 MB (CSV import limit)
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: allowedOrigins(config),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.register(
    async (api) => {
      await api.register(authPlugin, { deps });
      await api.register(healthRoutes, { deps });
      await api.register(authRoutes, { deps });
      await api.register(peopleRoutes, { deps });
      await api.register(rosterRoutes, { deps });
      await api.register(configRoutes, { deps });
      await api.register(stationRoutes, { deps });
      // Rule 1: registration and footfall are separate modules with separate endpoints.
      await api.register(registrationRoutes, { deps });
      await api.register(footfallRoutes, { deps });
      await api.register(setupRoutes, { deps });
      await api.register(deploymentRoutes, { deps });
      await api.register(dutyRoutes, { deps });
      await api.register(notificationRoutes, { deps });
      await api.register(breakRoutes, { deps });
    },
    { prefix: '/api' },
  );

  if (config.SERVE_CLIENT) {
    await app.register(fastifyStatic, { root: path.resolve(config.CLIENT_DIST_DIR) });
  }
  registerNotFound(app, { spaFallback: config.SERVE_CLIENT });

  return app;
}
