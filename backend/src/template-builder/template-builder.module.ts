import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PdfTemplate } from './entities/pdf-template.entity';
import { TemplateBuilderService } from './template-builder.service';
import { TemplateBuilderController } from './template-builder.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PdfTemplate])],
  controllers: [TemplateBuilderController],
  providers: [TemplateBuilderService],
  exports: [TemplateBuilderService],
})
export class TemplateBuilderModule {}
