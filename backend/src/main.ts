import 'dotenv/config'; // Load .env file before anything else
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { join } from 'path';
import { json, urlencoded } from 'express';
import * as express from 'express';

import { existsSync, mkdirSync } from 'fs';

const logger = new Logger('Bootstrap');

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    if (
      statusCode === HttpStatus.NOT_FOUND &&
      !request.url.startsWith('/api') &&
      !request.url.startsWith('/uploads')
    ) {
      const indexPath = join(process.cwd(), 'client', 'index.html');
      if (existsSync(indexPath)) {
        response.sendFile(indexPath);
        return;
      }

      response.status(404).json({
        statusCode: 404,
        message:
          'Frontend not found and API endpoint does not exist. Did you forget the /api prefix?',
        path: request.url,
      });
      return;
    }

    if (!isHttpException) {
      const error = exception as Error;
      this.logger.error(
        `${request.method} ${request.url} failed`,
        error?.stack || String(exception),
      );
    }

    if (request.url.startsWith('/api') || request.url.startsWith('/uploads')) {
      const exceptionResponse = isHttpException
        ? exception.getResponse()
        : 'Internal server error';
      const exceptionMessage =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any)?.message;
      const normalizedMessage = Array.isArray(exceptionMessage)
        ? exceptionMessage.join(', ')
        : exceptionMessage;
      response.status(statusCode).json({
        statusCode,
        message:
          normalizedMessage ||
          (statusCode === HttpStatus.NOT_FOUND
            ? `Endpoint or File not found: ${request.url}`
            : 'Internal server error'),
        path: request.url,
        timestamp: new Date().toISOString(),
      });
    } else {
      response.status(statusCode).json({
        statusCode,
        message: 'Unexpected application error',
        path: request.url,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

function parsePositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer. Received: ${raw}`);
  }

  return parsed;
}

function validateRuntimeConfig() {
  parsePositiveInt('DATABASE_PORT', 5432);
  parsePositiveInt('PORT', 3000);

  const isProduction = process.env.NODE_ENV === 'production';
  const jwtSecret = process.env.JWT_SECRET;
  const weakSecrets = new Set(['supersecretkey', 'secret', 'password']);

  if (!jwtSecret) {
    const message = 'JWT_SECRET is not configured.';
    if (isProduction) throw new Error(message);
    logger.warn(`${message} Development fallback may be used by auth modules.`);
  } else if (isProduction && weakSecrets.has(jwtSecret.toLowerCase())) {
    throw new Error('JWT_SECRET is using a known weak development value.');
  }
}

async function bootstrap() {
  validateRuntimeConfig();

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();

  app.use((request: any, _response: any, next: () => void) => {
    if (typeof request.url === 'string') {
      request.url = request.url
        .replace(/\/%20approve(?=\/?$)/i, '/approve')
        .replace(/\/\s+approve(?=\/?$)/i, '/approve');
    }

    if (
      typeof request.url === 'string' &&
      request.url.startsWith('/api/quality/inspections')
    ) {
      console.log(`[QualityRoute] ${request.method} ${request.url}`);
    }
    next();
  });

  // Increase body limits for large payloads (e.g. for BOQ/WorkOrder imports)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  app.useGlobalFilters(new GlobalExceptionFilter());

  // Serve uploads statically bypassing NestJS routing prefix logic entirely
  const uploadRoot = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
  mkdirSync(uploadRoot, { recursive: true });
  app.use('/uploads', express.static(uploadRoot));

  const port = parsePositiveInt('PORT', 3000);
  const server = await app.listen(port, '0.0.0.0');
  server.requestTimeout = parsePositiveInt('HTTP_REQUEST_TIMEOUT_MS', 120000);
  server.headersTimeout = parsePositiveInt('HTTP_HEADERS_TIMEOUT_MS', 125000);
  server.keepAliveTimeout = parsePositiveInt(
    'HTTP_KEEP_ALIVE_TIMEOUT_MS',
    65000,
  );

  logger.log(`SETU backend listening on port ${port}`);
}
bootstrap().catch((error) => {
  logger.error('SETU backend failed to start', error?.stack || String(error));
  process.exit(1);
});
