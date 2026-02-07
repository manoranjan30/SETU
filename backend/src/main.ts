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
      response.sendFile(join(__dirname, '..', 'client', 'index.html'));
    }
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();

  // Use SPA Filter
  app.useGlobalFilters(new SpaFallbackFilter());

  await app.listen(3000);
}
bootstrap();
