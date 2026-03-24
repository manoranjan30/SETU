import { Logger } from '@nestjs/common';
import { AiModelConfig } from '../entities/ai-model-config.entity';
import {
  IAiProvider,
  AiCompletionRequest,
  AiCompletionResponse,
} from './ai-provider.interface';

/**
 * OpenRouter provider — compatible with any OpenAI-format endpoint.
 * Also used for plain OpenAI (just set a different baseUrl).
 *
 * Uses the native `fetch` available in Node 18+ so there is no extra
 * dependency.  OpenRouter also supports `openai` npm package but native fetch
 * keeps the bundle lean.
 */
export class OpenRouterProvider implements IAiProvider {
  private readonly logger = new Logger(OpenRouterProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(config: AiModelConfig) {
    // API key: prefer DB record, fall back to env var
    this.apiKey = config.apiKey ?? process.env.AI_API_KEY ?? '';
    this.baseUrl =
      config.endpoint?.replace(/\/$/, '') ??
      'https://openrouter.ai/api/v1';
    this.defaultModel = config.model;

    if (!this.apiKey) {
      this.logger.warn(
        'No API key configured for OpenRouter provider. ' +
        'Get a free key at https://openrouter.ai/keys and save it in Admin → AI Settings.',
      );
    }
  }

  async complete(req: AiCompletionRequest): Promise<AiCompletionResponse> {
    const model = req.modelOverride ?? this.defaultModel;
    const messages: { role: string; content: string }[] = [];

    if (req.systemPrompt) {
      messages.push({ role: 'system', content: req.systemPrompt });
    }
    messages.push({ role: 'user', content: req.userPrompt });

    const body = {
      model,
      messages,
      max_tokens: Math.min(req.maxTokens ?? 4096, 8192),
      temperature: req.temperature ?? 0.2,
      // Tell the model to respond with JSON where possible
      response_format: { type: 'json_object' },
    };

    this.logger.debug(`OpenRouter call → model=${model} tokens=${body.max_tokens}`);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        // OpenRouter-specific headers for app attribution
        'HTTP-Referer': process.env.APP_URL ?? 'https://setu.app',
        'X-Title': 'SETU Construction PM',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `OpenRouter API error ${response.status}: ${errText}`,
      );
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
      model: string;
      usage?: { total_tokens: number };
    };

    const text = data.choices?.[0]?.message?.content ?? '';

    return {
      text,
      modelUsed: data.model ?? model,
      tokensUsed: data.usage?.total_tokens ?? null,
      raw: data,
    };
  }
}
