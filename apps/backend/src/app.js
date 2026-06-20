import crypto from 'node:crypto';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.FRONTEND_URL || false }));
  app.use(express.json({ limit: '1mb' }));

  app.use((request, response, next) => {
    const requestId = request.headers['x-request-id'] || crypto.randomUUID();
    response.locals.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    next();
  });

  app.get('/api/v1/health', (request, response) => {
    response.status(200).json({
      success: true,
      data: {
        status: 'ok',
        service: 'moneyhub-backend',
        version: '0.1.0'
      },
      error: null,
      meta: {
        requestId: response.locals.requestId
      }
    });
  });

  app.use((request, response) => {
    response.status(404).json({
      success: false,
      data: null,
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found.',
        details: {
          method: request.method,
          path: request.path
        }
      },
      meta: {
        requestId: response.locals.requestId
      }
    });
  });

  return app;
}
