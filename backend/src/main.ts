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

import { existsSync } from 'fs';

@Catch(NotFoundException)
export class SpaFallbackFilter implements ExceptionFilter {
  catch(exception: NotFoundException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    if (request.url.startsWith('/api')) {
      // API 404 -> Return JSON
      response.status(404).json({
        statusCode: 404,
        message: `API Endpoint not found: ${request.url}`,
      });
    } else {
      // Frontend 404 -> Serve index.html (SPA)
      const indexPath = join(__dirname, '..', 'client', 'index.html');
      if (existsSync(indexPath)) {
        response.sendFile(indexPath);
      } else {
        response.status(404).json({
          statusCode: 404,
          message: 'Frontend not found and API endpoint does not exist. Did you forget the /api prefix?',
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

  // Increase body limits for large payloads (e.g. for BOQ/WorkOrder imports)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  // Use SPA Filter
  app.useGlobalFilters(new SpaFallbackFilter());

  await app.listen(3000, '0.0.0.0');
}
bootstrap();
