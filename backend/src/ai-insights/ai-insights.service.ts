import {
  Injectable, Logger, NotFoundException, ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InsightTemplate } from './entities/insight-template.entity';
import { InsightRun } from './entities/insight-run.entity';
import { AiProviderFactory } from './providers/ai-provider.factory';
import { InsightDataAggregatorService } from './insight-data-aggregator.service';
import { RunInsightDto, InsightRunQueryDto } from './dto/run-insight.dto';
import {
  CreateInsightTemplateDto,
  UpdateInsightTemplateDto,
} from './dto/insight-template.dto';

@Injectable()
export class AiInsightsService {
  private readonly logger = new Logger(AiInsightsService.name);
  private static readonly MAX_ARRAY_ITEMS = 40;
  private static readonly MAX_OBJECT_KEYS = 25;
  private static readonly MAX_STRING_LENGTH = 1200;
  private static readonly MAX_PROMPT_DEPTH = 4;

  constructor(
    @InjectRepository(InsightTemplate)
    private readonly templateRepo: Repository<InsightTemplate>,
    @InjectRepository(InsightRun)
    private readonly runRepo: Repository<InsightRun>,
    private readonly providerFactory: AiProviderFactory,
    private readonly aggregator: InsightDataAggregatorService,
  ) {}

  // ── Templates ──────────────────────────────────────────────────────────────

  async listTemplates(includeInactive = false): Promise<InsightTemplate[]> {
    const where = includeInactive ? {} : { isActive: true };
    return this.templateRepo.find({
      where,
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async getTemplate(id: number): Promise<InsightTemplate> {
    const t = await this.templateRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException(`Insight template #${id} not found`);
    return t;
  }

  async getTemplateBySlug(slug: string): Promise<InsightTemplate> {
    const t = await this.templateRepo.findOne({ where: { slug } });
    if (!t) throw new NotFoundException(`Insight template "${slug}" not found`);
    return t;
  }

  async createTemplate(
    dto: CreateInsightTemplateDto,
    userId: number,
  ): Promise<InsightTemplate> {
    const template = this.templateRepo.create({
      ...dto,
      isSystem: false,
      createdById: userId,
    });
    return this.templateRepo.save(template);
  }

  async updateTemplate(
    id: number,
    dto: UpdateInsightTemplateDto,
  ): Promise<InsightTemplate> {
    const template = await this.getTemplate(id);
    // System templates: allow updating some fields but not slug / isSystem
    Object.assign(template, dto);
    template.isSystem = template.isSystem; // preserve original
    return this.templateRepo.save(template);
  }

  async deleteTemplate(id: number): Promise<void> {
    const template = await this.getTemplate(id);
    if (template.isSystem) {
      throw new ForbiddenException('System templates cannot be deleted.');
    }
    await this.templateRepo.remove(template);
  }

  // ── Runs ───────────────────────────────────────────────────────────────────

  async listRuns(
    query: InsightRunQueryDto,
    userId: number,
    isAdmin: boolean,
  ): Promise<{ runs: InsightRun[]; total: number }> {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(50, Math.max(1, Number(query.limit ?? 20)));
    const skip = (page - 1) * limit;

    const qb = this.runRepo
      .createQueryBuilder('run')
      .leftJoinAndSelect('run.template', 'template')
      .leftJoinAndSelect('run.requestedBy', 'requestedBy')
      .orderBy('run.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (!isAdmin) {
      qb.andWhere('run.requestedById = :userId', { userId });
    }
    if (query.projectId) {
      qb.andWhere('run.projectId = :projectId', { projectId: query.projectId });
    }
    if (query.templateId) {
      qb.andWhere('run.templateId = :templateId', { templateId: query.templateId });
    }

    const [runs, total] = await qb.getManyAndCount();
    return { runs, total };
  }

  async getRun(id: number): Promise<InsightRun> {
    const run = await this.runRepo.findOne({
      where: { id },
      relations: ['template', 'requestedBy', 'modelConfig'],
    });
    if (!run) throw new NotFoundException(`Insight run #${id} not found`);
    return run;
  }

  async deleteRun(id: number, userId: number, isAdmin: boolean): Promise<void> {
    const run = await this.getRun(id);
    if (!isAdmin && run.requestedById !== userId) {
      throw new ForbiddenException('You can only delete your own AI insight runs.');
    }
    await this.runRepo.remove(run);
  }

  /**
   * Executes an insight run end-to-end:
   *  1. Load template
   *  2. Aggregate SETU data
   *  3. Render prompt
   *  4. Call AI provider
   *  5. Parse JSON result
   *  6. Save and return InsightRun
   */
  async runInsight(dto: RunInsightDto, userId: number): Promise<InsightRun> {
    const template = await this.getTemplate(dto.templateId);

    // Create a run record immediately (RUNNING state)
    const run = await this.runRepo.save(
      this.runRepo.create({
        templateId: template.id,
        projectId: dto.projectId ?? null,
        requestedById: userId,
        status: 'RUNNING',
        parameters: dto.parameters ?? null,
      }),
    );

    const startTime = Date.now();

    try {
      // 1. Get all providers (active first) for fallback rotation
      const candidates = await this.providerFactory.getAllWithKeys();
      if (candidates.length === 0) {
        throw new NotFoundException(
          'No AI model configurations with API keys found. ' +
          'Please configure an AI provider in Admin → AI Settings.',
        );
      }

      // 2. Aggregate data
      this.logger.log(
        `Run #${run.id}: aggregating data for template "${template.slug}"`,
      );
      const rawDataMap = await this.aggregator.aggregate(
        template.dataSources as { key: string; filters?: Record<string, unknown> }[],
        dto.projectId ?? null,
        dto.parameters as Record<string, unknown> | undefined,
      );
      const dataMap = this.compactDataMap(rawDataMap);

      // 3. Render prompt
      const prompt = this.renderPrompt(
        template.promptTemplate,
        dataMap,
        dto.projectId,
        dto.parameters,
      );

      // 4. Call AI — try each candidate in order, skip rate-limited ones
      let aiResponse: Awaited<ReturnType<typeof candidates[0]['provider']['complete']>> | null = null;
      let usedConfig = candidates[0].config;
      let lastError: Error | null = null;

      for (const { provider, config } of candidates) {
        try {
          this.logger.log(
            `Run #${run.id}: calling ${config.provider}/${config.model} (config #${config.id})`,
          );
          aiResponse = await provider.complete({
            userPrompt: prompt,
            maxTokens: config.maxTokens,
            temperature: config.temperature,
          });
          usedConfig = config;
          break; // success — stop rotating
        } catch (err) {
          const msg = String(err);
          if (msg.includes('429') || msg.toLowerCase().includes('rate-limit') || msg.toLowerCase().includes('rate limit')) {
            this.logger.warn(
              `Run #${run.id}: config #${config.id} (${config.model}) rate-limited, trying next...`,
            );
            lastError = err as Error;
            continue;
          }
          throw err; // non-rate-limit error — bubble up immediately
        }
      }

      if (!aiResponse) {
        throw lastError ?? new ServiceUnavailableException(
          'All AI provider configurations are rate-limited. Please wait and try again.',
        );
      }

      if ((aiResponse.finishReason || '').toLowerCase() === 'length') {
        throw new ServiceUnavailableException(
          'AI response was truncated by the token limit. Reduce scope or retry with a larger model.',
        );
      }

      if (!aiResponse.text || !aiResponse.text.trim()) {
        throw new ServiceUnavailableException(
          'AI provider returned an empty completion. Please retry with a different model or rerun the analysis.',
        );
      }

      const config = usedConfig;
      await this.runRepo.update(run.id, { modelConfigId: config.id });

      // 5. Parse JSON
      let result: object;
      try {
        result = JSON.parse(aiResponse.text);
      } catch {
        // Model may have returned markdown-fenced JSON
        const match = aiResponse.text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match) {
          result = JSON.parse(match[1]);
        } else {
          // Store raw text as { raw } if not parseable
          result = { raw: aiResponse.text };
        }
      }

      const durationMs = Date.now() - startTime;

      // 6. Update run with results
      await this.runRepo.update(run.id, {
        status: 'COMPLETED',
        dataSnapshot: dataMap,
        promptRendered: prompt,
        result,
        rawResponse: aiResponse.text,
        modelUsed: aiResponse.modelUsed,
        tokensUsed: aiResponse.tokensUsed,
        durationMs,
        completedAt: new Date(),
      });

      this.logger.log(
        `Run #${run.id} COMPLETED in ${durationMs}ms (tokens=${aiResponse.tokensUsed})`,
      );

      return this.getRun(run.id);
    } catch (err) {
      const durationMs = Date.now() - startTime;

      await this.runRepo.update(run.id, {
        status: 'FAILED',
        errorMessage: String(err),
        durationMs,
        completedAt: new Date(),
      });

      this.logger.error(`Run #${run.id} FAILED: ${err}`);
      throw err;
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private renderPrompt(
    template: string,
    dataMap: Record<string, unknown>,
    projectId?: number | null,
    parameters?: Record<string, unknown> | null,
  ): string {
    let rendered = template;

    // Replace {{project_name}} — fetch from project data if available, else id
    rendered = rendered.replace(
      /\{\{project_name\}\}/g,
      String(projectId ?? 'Unknown Project'),
    );

    // Replace {{date_range}}
    const now = new Date();
    const days = Number((parameters as Record<string, number> | null)?.['days'] ?? 30);
    const from = new Date(now);
    from.setDate(from.getDate() - days);
    rendered = rendered.replace(
      /\{\{date_range\}\}/g,
      `${from.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`,
    );

    // Replace {{key_data}} for each data source
    for (const [key, data] of Object.entries(dataMap)) {
      const placeholder = new RegExp(`\\{\\{${key}_data\\}\\}`, 'g');
      rendered = rendered.replace(
        placeholder,
        JSON.stringify(data, null, 2),
      );
    }

    return `${rendered}

Important response rules:
- Return concise JSON only.
- Prefer summaries, top items, and clear recommendations.
- Do not repeat or echo the full input data.
- Keep the response compact enough to avoid token truncation.`;
  }

  private compactDataMap(dataMap: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(dataMap).map(([key, value]) => [key, this.compactValue(value, 0)]),
    );
  }

  private compactValue(value: unknown, depth: number): unknown {
    if (value == null) return value;

    if (typeof value === 'string') {
      return value.length > AiInsightsService.MAX_STRING_LENGTH
        ? `${value.slice(0, AiInsightsService.MAX_STRING_LENGTH)}…`
        : value;
    }

    if (typeof value !== 'object') return value;

    if (depth >= AiInsightsService.MAX_PROMPT_DEPTH) {
      if (Array.isArray(value)) {
        return `[truncated array: ${value.length} items]`;
      }
      return '[truncated object]';
    }

    if (Array.isArray(value)) {
      const sliced = value
        .slice(0, AiInsightsService.MAX_ARRAY_ITEMS)
        .map((item) => this.compactValue(item, depth + 1));
      if (value.length > AiInsightsService.MAX_ARRAY_ITEMS) {
        sliced.push(`[${value.length - AiInsightsService.MAX_ARRAY_ITEMS} more items omitted]`);
      }
      return sliced;
    }

    const entries = Object.entries(value as Record<string, unknown>);
    const compacted = entries
      .slice(0, AiInsightsService.MAX_OBJECT_KEYS)
      .reduce<Record<string, unknown>>((acc, [key, item]) => {
        acc[key] = this.compactValue(item, depth + 1);
        return acc;
      }, {});
    if (entries.length > AiInsightsService.MAX_OBJECT_KEYS) {
      compacted.__truncatedKeys = entries.length - AiInsightsService.MAX_OBJECT_KEYS;
    }
    return compacted;
  }
}
