import 'dotenv/config'; // Load .env file before anything else
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  NotFoundException,
  HttpException,
} from '@nestjs/common';
import { join } from 'path';
import { json, urlencoded } from 'express';
import * as express from 'express';

import { existsSync } from 'fs';

@Catch(NotFoundException)
export class SpaFallbackFilter implements ExceptionFilter {
  catch(exception: NotFoundException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    if (request.url.startsWith('/api') || request.url.startsWith('/uploads')) {
      const exceptionResponse = exception.getResponse();
      const exceptionMessage =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any)?.message;
      const normalizedMessage = Array.isArray(exceptionMessage)
        ? exceptionMessage.join(', ')
        : exceptionMessage;
      // API or Static Asset 404 -> Return JSON
      response.status(404).json({
        statusCode: 404,
        message:
          normalizedMessage || `Endpoint or File not found: ${request.url}`,
      });
    } else {
      // Frontend 404 -> Serve index.html (SPA)
      const indexPath = join(process.cwd(), 'client', 'index.html');
      if (existsSync(indexPath)) {
        response.sendFile(indexPath);
      } else {
        response.status(404).json({
          statusCode: 404,
          message:
            'Frontend not found and API endpoint does not exist. Did you forget the /api prefix?',
          path: request.url,
        });
      }
    }
  }
}

async function bootstrap() {
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

  // Use SPA Filter
  app.useGlobalFilters(new SpaFallbackFilter());

  // Serve uploads statically bypassing NestJS routing prefix logic entirely
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  await app.listen(3000, '0.0.0.0');
}
bootstrap();
