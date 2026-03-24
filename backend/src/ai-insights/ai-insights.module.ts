import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModelConfig } from './entities/ai-model-config.entity';
import { InsightTemplate } from './entities/insight-template.entity';
import { InsightRun } from './entities/insight-run.entity';
import { AiInsightsController } from './ai-insights.controller';
import { AiInsightsService } from './ai-insights.service';
import { AiModelConfigService } from './ai-model-config.service';
import { AiProviderFactory } from './providers/ai-provider.factory';
import { InsightDataAggregatorService } from './insight-data-aggregator.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiModelConfig, InsightTemplate, InsightRun]),
  ],
  controllers: [AiInsightsController],
  providers: [
    AiInsightsService,
    AiModelConfigService,
    AiProviderFactory,
    InsightDataAggregatorService,
  ],
  exports: [AiInsightsService, AiModelConfigService],
})
export class AiInsightsModule {}
