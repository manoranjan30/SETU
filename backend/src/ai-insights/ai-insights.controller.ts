import {
  Controller, Get, Post, Put, Delete, Patch,
  Param, Body, Query, ParseIntPipe,
  UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { AiInsightsService } from './ai-insights.service';
import { AiModelConfigService } from './ai-model-config.service';
import { RunInsightDto, InsightRunQueryDto } from './dto/run-insight.dto';
import {
  CreateInsightTemplateDto,
  UpdateInsightTemplateDto,
} from './dto/insight-template.dto';
import {
  CreateAiModelConfigDto,
  UpdateAiModelConfigDto,
  TestAiModelConfigDto,
} from './dto/ai-model-config.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('ai-insights')
export class AiInsightsController {
  constructor(
    private readonly insightsService: AiInsightsService,
    private readonly modelConfigService: AiModelConfigService,
  ) {}

  @Get('templates')
  @Permissions('AI.INSIGHTS.READ')
  listTemplates(@Query('includeInactive') includeInactive?: string) {
    return this.insightsService.listTemplates(includeInactive === 'true');
  }

  @Get('templates/:id')
  @Permissions('AI.INSIGHTS.READ')
  getTemplate(@Param('id', ParseIntPipe) id: number) {
    return this.insightsService.getTemplate(id);
  }

  @Post('templates')
  @Permissions('AI.INSIGHTS.TEMPLATES.WRITE')
  createTemplate(@Body() dto: CreateInsightTemplateDto, @Request() req: { user: { id: number } }) {
    return this.insightsService.createTemplate(dto, req.user.id);
  }

  @Put('templates/:id')
  @Permissions('AI.INSIGHTS.TEMPLATES.WRITE')
  updateTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInsightTemplateDto,
  ) {
    return this.insightsService.updateTemplate(id, dto);
  }

  @Delete('templates/:id')
  @Permissions('AI.INSIGHTS.TEMPLATES.WRITE')
  deleteTemplate(@Param('id', ParseIntPipe) id: number) {
    return this.insightsService.deleteTemplate(id);
  }

  @Post('run')
  @Permissions('AI.INSIGHTS.RUN')
  runInsight(@Body() dto: RunInsightDto, @Request() req: { user: { id: number; permissions?: string[] } }) {
    return this.insightsService.runInsight(dto, req.user.id);
  }

  @Get('runs')
  @Permissions('AI.INSIGHTS.READ')
  listRuns(
    @Query() query: InsightRunQueryDto,
    @Request() req: { user: { id: number; permissions?: string[] } },
  ) {
    const isAdmin = req.user.permissions?.includes('AI.INSIGHTS.ADMIN') ?? false;
    return this.insightsService.listRuns(query, req.user.id, isAdmin);
  }

  @Get('runs/:id')
  @Permissions('AI.INSIGHTS.READ')
  getRun(@Param('id', ParseIntPipe) id: number) {
    return this.insightsService.getRun(id);
  }

  @Delete('runs/:id')
  @Permissions('AI.INSIGHTS.READ')
  deleteRun(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: { id: number; permissions?: string[] } },
  ) {
    const isAdmin = req.user.permissions?.includes('AI.INSIGHTS.ADMIN') ?? false;
    return this.insightsService.deleteRun(id, req.user.id, isAdmin);
  }

  @Get('admin/model-configs')
  @Permissions('AI.INSIGHTS.ADMIN')
  listModelConfigs() {
    return this.modelConfigService.findAll();
  }

  @Get('admin/model-configs/active')
  @Permissions('AI.INSIGHTS.ADMIN')
  getActiveConfig() {
    return this.modelConfigService.findActive();
  }

  @Get('admin/model-configs/:id')
  @Permissions('AI.INSIGHTS.ADMIN')
  getModelConfig(@Param('id', ParseIntPipe) id: number) {
    return this.modelConfigService.findOne(id);
  }

  @Post('admin/model-configs')
  @Permissions('AI.INSIGHTS.ADMIN')
  createModelConfig(@Body() dto: CreateAiModelConfigDto) {
    return this.modelConfigService.create(dto);
  }

  @Put('admin/model-configs/:id')
  @Permissions('AI.INSIGHTS.ADMIN')
  updateModelConfig(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAiModelConfigDto,
  ) {
    return this.modelConfigService.update(id, dto);
  }

  @Patch('admin/model-configs/:id/activate')
  @Permissions('AI.INSIGHTS.ADMIN')
  activateModelConfig(@Param('id', ParseIntPipe) id: number) {
    return this.modelConfigService.setActive(id);
  }

  @Delete('admin/model-configs/:id')
  @Permissions('AI.INSIGHTS.ADMIN')
  deleteModelConfig(@Param('id', ParseIntPipe) id: number) {
    return this.modelConfigService.remove(id);
  }

  @Post('admin/model-configs/test')
  @Permissions('AI.INSIGHTS.ADMIN')
  testModelConfig(@Body() dto: TestAiModelConfigDto) {
    return this.modelConfigService.testConfig(dto);
  }
}
