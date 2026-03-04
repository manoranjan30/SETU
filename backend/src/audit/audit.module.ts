import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './audit-log.entity';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';

@Global() // Makes AuditService injectable everywhere without explicit imports
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditController],
  providers: [
    AuditService,
    // Register as a global APP_INTERCEPTOR — applies to EVERY route in the app
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
  exports: [AuditService],
})
export class AuditModule {}
