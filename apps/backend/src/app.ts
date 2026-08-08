import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import cors from 'cors';
import express, { type Express, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import {
  verifyFirebaseIdToken,
  type AuthContext,
  type VerifyIdToken
} from './auth.js';
import {
  resolvers,
  typeDefs,
  unauthenticatedError,
  type GraphQLContext
} from './graphql.js';
import { disconnectDatabase } from './database.js';
import {
  appLogger,
  createHttpLoggingMiddleware,
  type HttpLogger
} from './http-logger.js';

type CreateAppOptions = {
  verifyIdToken?: VerifyIdToken;
  logger?: HttpLogger;
  appUrl?: URL;
  frontendDistDir?: string;
  nodeEnvironment?: string;
};

function isLoopbackOrigin(origin: string): boolean {
  try {
    const hostname = new URL(origin).hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function bearerToken(request: Request): string | null {
  const authorization = request.header('authorization');
  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    throw unauthenticatedError();
  }

  return match[1];
}

async function authenticate(
  request: Request,
  verifyIdToken: VerifyIdToken
): Promise<AuthContext | null> {
  const token = bearerToken(request);
  if (!token) {
    return null;
  }

  try {
    return await verifyIdToken(token);
  } catch (error) {
    console.error('[AUTH ERROR] Firebase ID token verification failed:', error);
    throw unauthenticatedError();
  }
}

export async function createApp(
  options: CreateAppOptions = {}
): Promise<Express> {
  const verifyIdToken = options.verifyIdToken ?? verifyFirebaseIdToken;
  const logger = options.logger ?? appLogger;
  const app = express();
  const apollo = new ApolloServer<GraphQLContext>({ typeDefs, resolvers });
  await apollo.start();

  app.disable('x-powered-by');
  app.use(helmet());
  const nodeEnvironment = options.nodeEnvironment ?? process.env.NODE_ENV;
  app.use(cors({
    origin: (origin, callback) => {
      const allowed = !origin
        || origin === options.appUrl?.origin
        || (nodeEnvironment !== 'production' && isLoopbackOrigin(origin));
      callback(null, allowed);
    }
  }));
  app.use((request, response, next) => {
    const requestId = request.header('x-request-id') || crypto.randomUUID();
    response.locals.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    next();
  });
  app.use(createHttpLoggingMiddleware(logger));

  app.get('/health', (_request, response) => {
    response.status(200).json({
      success: true,
      data: {
        status: 'ok',
        service: 'moneyhub-backend',
        version: '0.1.0'
      },
      error: null,
      meta: { requestId: response.locals.requestId }
    });
  });

  app.use(
    '/graphql',
    rateLimit({
      windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 900000),
      limit: Number(process.env.RATE_LIMIT_MAX || 100),
      standardHeaders: 'draft-7',
      legacyHeaders: false
    }),
    express.json({ limit: '1mb' }),
    expressMiddleware(apollo, {
      context: async ({ req }) => ({
        requestId: req.res?.locals.requestId ?? crypto.randomUUID(),
        auth: await authenticate(req, verifyIdToken)
      })
    })
  );

  const frontendIndex = options.frontendDistDir
    ? join(options.frontendDistDir, 'index.html')
    : null;
  if (options.frontendDistDir && frontendIndex && existsSync(frontendIndex)) {
    app.use(express.static(options.frontendDistDir));
    app.get('*', (request, response, next) => {
      if (!request.accepts('html')) {
        next();
        return;
      }

      response.sendFile(frontendIndex);
    });
  }

  app.use((request, response) => {
    response.status(404).json({
      success: false,
      data: null,
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found.',
        details: { method: request.method, path: request.path }
      },
      meta: { requestId: response.locals.requestId }
    });
  });

  app.locals.stop = async () => {
    await apollo.stop();
    await disconnectDatabase();
  };
  return app;
}
