import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import cors from 'cors';
import express, { type Express, type Request, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import 'helmet';
import { z } from 'zod';
import {
  verifyFirebaseIdToken,
  type AuthContext,
  type VerifyIdToken
} from '../../modules/auth/authentication/auth.js';
import {
  PasswordRecoveryPublicError,
  type PasswordRecoveryService
} from '../../modules/auth/password-recovery/password-recovery.js';
import { createSlidingWindowRateLimiter } from '../rate-limit/sliding-window-rate-limit.js';
import {
  resolvers,
  typeDefs,
  unauthenticatedError,
  type GraphQLContext
} from '../graphql/graphql.js';
import { disconnectDatabase } from '../database/database.js';
import {
  appLogger,
  createHttpLoggingMiddleware,
  type HttpLogger
} from '../http-logger/http-logger.js';

const helmet = createRequire(import.meta.url)('helmet') as () => RequestHandler;

type CreateAppOptions = {
  verifyIdToken?: VerifyIdToken;
  logger?: HttpLogger;
  appUrl?: URL;
  frontendDistDir?: string;
  nodeEnvironment?: string;
  passwordRecovery?: PasswordRecoveryService;
  passwordRecoveryRateLimitNow?: () => number;
};

const passwordRecoveryInput = z.object({
  email: z.string().trim().email()
});
const passwordRecoveryCodeInput = z.object({
  oobCode: z.string().trim().min(1).max(4096)
});
const passwordRecoveryPasswordInput = z.object({
  newPassword: z.string().min(1).max(4096)
});

function rateLimitedResponse(
  response: express.Response,
  message: string
) {
  response.status(429).json({
    success: false,
    data: null,
    error: {
      code: 'RATE_LIMITED',
      message,
      details: null
    },
    meta: { requestId: response.locals.requestId }
  });
}

function passwordRecoveryErrorResponse(
  response: express.Response,
  status: number,
  code: string,
  message: string
) {
  response.status(status).json({
    success: false,
    data: null,
    error: {
      code,
      message,
      details: null
    },
    meta: { requestId: response.locals.requestId }
  });
}

function passwordRecoveryPublicErrorStatus(code: PasswordRecoveryPublicError['code']) {
  return code === 'RECOVERY_UNAVAILABLE' ? 503 : 400;
}

function passwordRecoveryUserIp(request: Request): string {
  return typeof request.ip === 'string' ? request.ip : '';
}

function requestIdFromHeader(rawRequestId: string | undefined) {
  return rawRequestId && /^[A-Za-z0-9._-]{1,128}$/.test(rawRequestId)
    ? rawRequestId
    : crypto.randomUUID();
}

function createPasswordRecoveryRateLimit(options: Readonly<{
  limit: number;
  message: string;
  now: (() => number) | undefined;
}>) {
  const windowMs = 15 * 60 * 1000;
  const limiter = createSlidingWindowRateLimiter({
    limit: options.limit,
    windowMs,
    ...(options.now ? { now: options.now } : {})
  });

  return ((request, response, next) => {
    const result = limiter.consume(passwordRecoveryUserIp(request));
    response.setHeader('RateLimit-Policy', `${options.limit};w=${windowMs / 1000}`);
    response.setHeader(
      'RateLimit',
      `limit=${options.limit}, remaining=${result.remaining}`
    );
    if (!result.allowed) {
      response.setHeader(
        'Retry-After',
        String(Math.max(1, Math.ceil(result.retryAfterMs / 1000)))
      );
      rateLimitedResponse(response, options.message);
      return;
    }

    next();
  }) satisfies express.RequestHandler;
}

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
    const requestId = requestIdFromHeader(request.header('x-request-id'));
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

  app.post(
    '/auth/password-recovery',
    createPasswordRecoveryRateLimit({
      limit: 5,
      message: 'Too many password recovery requests.',
      now: options.passwordRecoveryRateLimitNow
    }),
    express.json({ limit: '16kb' }),
    async (request, response) => {
      const input = passwordRecoveryInput.safeParse(request.body);
      if (!input.success) {
        response.status(400).json({
          success: false,
          data: null,
          error: {
            code: 'INVALID_EMAIL',
            message: 'A valid email address is required.',
            details: null
          },
          meta: { requestId: response.locals.requestId }
        });
        return;
      }

      try {
        await options.passwordRecovery?.request({
          email: input.data.email,
          requestId: String(response.locals.requestId),
          userIp: passwordRecoveryUserIp(request)
        });
      } catch {
        // The public response must not reveal account or provider state.
      }

      response.status(202).json({
        success: true,
        data: { accepted: true },
        error: null,
        meta: { requestId: response.locals.requestId }
      });
    }
  );

  app.post(
    '/auth/password-recovery/verify',
    createPasswordRecoveryRateLimit({
      limit: 10,
      message: 'Too many password recovery verification attempts.',
      now: options.passwordRecoveryRateLimitNow
    }),
    express.json({ limit: '16kb' }),
    async (request, response) => {
      const input = passwordRecoveryCodeInput.safeParse(request.body);
      if (!input.success) {
        passwordRecoveryErrorResponse(
          response,
          400,
          'INVALID_OR_EXPIRED_ACTION_CODE',
          'A valid password recovery code is required.'
        );
        return;
      }

      try {
        if (!options.passwordRecovery) {
          throw new PasswordRecoveryPublicError('RECOVERY_UNAVAILABLE');
        }
        await options.passwordRecovery.verify({
          oobCode: input.data.oobCode,
          requestId: String(response.locals.requestId)
        });
      } catch (error) {
        if (error instanceof PasswordRecoveryPublicError) {
          passwordRecoveryErrorResponse(
            response,
            passwordRecoveryPublicErrorStatus(error.code),
            error.code,
            'Password recovery code could not be verified.'
          );
          return;
        }

        passwordRecoveryErrorResponse(
          response,
          503,
          'RECOVERY_UNAVAILABLE',
          'Password recovery is temporarily unavailable.'
        );
        return;
      }

      response.status(200).json({
        success: true,
        data: { valid: true },
        error: null,
        meta: { requestId: response.locals.requestId }
      });
    }
  );

  app.post(
    '/auth/password-recovery/confirm',
    createPasswordRecoveryRateLimit({
      limit: 10,
      message: 'Too many password recovery confirmation attempts.',
      now: options.passwordRecoveryRateLimitNow
    }),
    express.json({ limit: '16kb' }),
    async (request, response) => {
      const codeInput = passwordRecoveryCodeInput.safeParse(request.body);
      if (!codeInput.success) {
        passwordRecoveryErrorResponse(
          response,
          400,
          'INVALID_OR_EXPIRED_ACTION_CODE',
          'A valid password recovery code is required.'
        );
        return;
      }

      const passwordInput = passwordRecoveryPasswordInput.safeParse(request.body);
      if (!passwordInput.success) {
        passwordRecoveryErrorResponse(
          response,
          400,
          'INVALID_PASSWORD',
          'A new password is required.'
        );
        return;
      }

      try {
        if (!options.passwordRecovery) {
          throw new PasswordRecoveryPublicError('RECOVERY_UNAVAILABLE');
        }
        await options.passwordRecovery.confirm({
          oobCode: codeInput.data.oobCode,
          newPassword: passwordInput.data.newPassword,
          requestId: String(response.locals.requestId)
        });
      } catch (error) {
        if (error instanceof PasswordRecoveryPublicError) {
          passwordRecoveryErrorResponse(
            response,
            passwordRecoveryPublicErrorStatus(error.code),
            error.code,
            error.code === 'WEAK_PASSWORD'
              ? 'New password does not meet requirements.'
              : 'Password recovery could not be confirmed.'
          );
          return;
        }

        passwordRecoveryErrorResponse(
          response,
          503,
          'RECOVERY_UNAVAILABLE',
          'Password recovery is temporarily unavailable.'
        );
        return;
      }

      response.status(200).json({
        success: true,
        data: { confirmed: true },
        error: null,
        meta: { requestId: response.locals.requestId }
      });
    }
  );

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
