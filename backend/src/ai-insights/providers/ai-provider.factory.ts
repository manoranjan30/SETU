import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiModelConfig } from '../entities/ai-model-config.entity';
import { IAiProvider } from './ai-provider.interface';
import { OpenRouterProvider } from './openrouter.provider';
import { AzureOpenAiProvider } from './azure-openai.provider';

/**
 * Resolves the correct IAiProvider implementation for a given AiModelConfig.
 *
 * Usage:
 *   const provider = await factory.getActiveProvider();
 *   const response = await provider.complete({ userPrompt: '...' });
 *
 * Provider resolution order:
 *  1. Use the active DB config (isActive=true).
 *  2. Fall back to env var AI_PROVIDER if no DB config exists.
 *  3. Default to 'openrouter' if AI_PROVIDER is unset.
 */
@Injectable()
export class AiProviderFactory {
  private readonly logger = new Logger(AiProviderFactory.name);

  constructor(
    @InjectRepository(AiModelConfig)
    private readonly configRepo: Repository<AiModelConfig>,
  ) {}

  /** Returns a provider for the currently active model config. */
  async getActiveProvider(): Promise<{ provider: IAiProvider; config: AiModelConfig }> {
    const config = await this.configRepo.findOne({ where: { isActive: true } });

    if (!config) {
      throw new NotFoundException(
        'No active AI model configuration found. ' +
        'Please configure an AI provider in Admin → AI Settings.',
      );
    }

    return { provider: this.buildProvider(config), config };
  }

  /**
   * Returns all configs that have an API key, ordered so the active one is first.
   * Used for automatic fallback rotation when a model is rate-limited.
   */
  async getAllWithKeys(): Promise<{ provider: IAiProvider; config: AiModelConfig }[]> {
    const configs = await this.configRepo.find({ order: { isActive: 'DESC', id: 'ASC' } });
    return configs
      .filter((c) => c.apiKey && c.apiKey.trim().length > 0)
      .map((c) => ({ provider: this.buildProvider(c), config: c }));
  }

  /** Returns a provider for a specific config by id. */
  async getProviderForConfig(configId: number): Promise<{ provider: IAiProvider; config: AiModelConfig }> {
    const config = await this.configRepo.findOne({ where: { id: configId } });

    if (!config) {
      throw new NotFoundException(`AI model config #${configId} not found`);
    }

    return { provider: this.buildProvider(config), config };
  }

  private buildProvider(config: AiModelConfig): IAiProvider {
    switch (config.provider) {
      case 'azure':
        this.logger.debug(`Using Azure OpenAI provider (config #${config.id})`);
        return new AzureOpenAiProvider(config);

      case 'openai':
      case 'openrouter':
      default:
        this.logger.debug(
          `Using OpenRouter/OpenAI-compatible provider (config #${config.id}, provider=${config.provider})`,
        );
        return new OpenRouterProvider(config);
    }
  }
}
