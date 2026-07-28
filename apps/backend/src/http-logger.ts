import type { RequestHandler } from 'express';
import pino from 'pino';

export type HttpLogLevel = 'info' | 'warn' | 'error';

export type HttpCompletionEvent = Readonly<{
  event: 'http_request_completed';
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
}>;

export type HttpLogger = {
  info(event: HttpCompletionEvent): void;
  warn(event: HttpCompletionEvent): void;
  error(event: HttpCompletionEvent): void;
};

export const appLogger: HttpLogger = pino();

export function httpLogLevel(statusCode: number): HttpLogLevel {
  if (statusCode >= 500) return 'error';
  if (statusCode >= 400) return 'warn';
  return 'info';
}

export function createHttpLoggingMiddleware(logger: HttpLogger): RequestHandler {
  return (request, response, next) => {
    const startedAt = performance.now();

    response.once('finish', () => {
      const event: HttpCompletionEvent = {
        event: 'http_request_completed',
        requestId: String(response.locals.requestId),
        method: request.method,
        path: request.path,
        statusCode: response.statusCode,
        durationMs: Math.max(0, performance.now() - startedAt)
      };

      try {
        logger[httpLogLevel(response.statusCode)](event);
      } catch {
        // Logging must never affect an HTTP response.
      }
    });

    next();
  };
}
