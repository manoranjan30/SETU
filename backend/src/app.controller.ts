import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller()
export class AppController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('hello')
  getHello(): string {
    return 'Hello World!';
  }

  @Get('health/live')
  getLiveness() {
    return {
      status: 'ok',
      service: 'setu-backend',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  @Get('health')
  async getHealth() {
    const startedAt = Date.now();
    await this.dataSource.query('SELECT 1');

    return {
      status: 'ok',
      service: 'setu-backend',
      checks: {
        database: 'ok',
      },
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
