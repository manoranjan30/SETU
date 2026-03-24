import {
  Injectable, Logger, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiModelConfig } from './entities/ai-model-config.entity';
import {
  CreateAiModelConfigDto,
  UpdateAiModelConfigDto,
  TestAiModelConfigDto,
} from './dto/ai-model-config.dto';
import { AiProviderFactory } from './providers/ai-provider.factory';

@Injectable()
export class AiModelConfigService {
  private readonly logger = new Logger(AiModelConfigService.name);

  constructor(
    @InjectRepository(AiModelConfig)
    private readonly repo: Repository<AiModelConfig>,
    private readonly providerFactory: AiProviderFactory,
  ) {}

  findAll(): Promise<AiModelConfig[]> {
    return this.repo.find({ order: { createdAt: 'ASC' } });
  }

  async findOne(id: number): Promise<AiModelConfig> {
    const config = await this.repo.findOne({ where: { id } });
    if (!config) throw new NotFoundException(`AI model config #${id} not found`);
    return config;
  }

  async findActive(): Promise<AiModelConfig | null> {
    return this.repo.findOne({ where: { isActive: true } });
  }

  async create(dto: CreateAiModelConfigDto): Promise<AiModelConfig> {
    if (dto.isActive) {
      // Deactivate any existing active config before creating a new active one
      await this.repo.update({ isActive: true }, { isActive: false });
    }
    const config = this.repo.create(dto);
    return this.repo.save(config);
  }

  async update(id: number, dto: UpdateAiModelConfigDto): Promise<AiModelConfig> {
    const config = await this.findOne(id);

    if (dto.isActive && !config.isActive) {
      // Deactivate others when activating this one
      await this.repo.update({ isActive: true }, { isActive: false });
    }

    Object.assign(config, dto);
    return this.repo.save(config);
  }

  async setActive(id: number): Promise<AiModelConfig> {
    await this.findOne(id); // Ensure it exists
    await this.repo.update({ isActive: true }, { isActive: false });
    await this.repo.update(id, { isActive: true });
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const config = await this.findOne(id);
    if (config.isActive) {
      throw new BadRequestException(
        'Cannot delete the active AI model config. ' +
        'Activate a different config first.',
      );
    }
    await this.repo.remove(config);
  }

  /**
   * Sends a short test prompt to verify the config is working.
   * Returns the AI response text on success, throws on failure.
   */
  async testConfig(dto: TestAiModelConfigDto): Promise<{ success: boolean; response: string; modelUsed: string; tokensUsed: number | null }> {
    const { provider, config } = dto.configId
      ? await this.providerFactory.getProviderForConfig(dto.configId)
      : await this.providerFactory.getActiveProvider();

    const prompt =
      dto.prompt ??
      'Respond with exactly this JSON: {"status": "ok", "message": "SETU AI connection test successful"}';

    this.logger.log(`Testing AI config #${config.id} (${config.provider}/${config.model})`);

    const result = await provider.complete({
      userPrompt: prompt,
      maxTokens: 200,
      temperature: 0,
    });

    return {
      success: true,
      response: result.text,
      modelUsed: result.modelUsed,
      tokensUsed: result.tokensUsed,
    };
  }
}
