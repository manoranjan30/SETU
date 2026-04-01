import { Logger } from '@nestjs/common';
import { AiModelConfig } from '../entities/ai-model-config.entity';
import {
  IAiProvider,
  AiCompletionRequest,
  AiCompletionResponse,
} from './ai-provider.interface';

export class AzureOpenAiProvider implements IAiProvider {
  private readonly logger = new Logger(AzureOpenAiProvider.name);
  private readonly config: AiModelConfig;
  private cachedToken: { value: string; expiresAt: number } | null = null;

  private static readonly API_VERSION = '2024-02-01';

  constructor(config: AiModelConfig) {
    this.config = config;
  }

  async complete(req: AiCompletionRequest): Promise<AiCompletionResponse> {
    const endpoint = this.buildEndpoint();
    const authHeader = await this.getAuthHeader();

    const messages: { role: string; content: string }[] = [];
    if (req.systemPrompt) {
      messages.push({ role: 'system', content: req.systemPrompt });
    }
    messages.push({ role: 'user', content: req.userPrompt });

    const body = {
      messages,
      max_tokens: req.maxTokens ?? this.config.maxTokens ?? 4096,
      temperature: req.temperature ?? this.config.temperature ?? 0.2,
      response_format: { type: 'json_object' },
    };

    this.logger.debug(`Azure OpenAI call -> ${endpoint}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Azure OpenAI error ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as {
      choices: { message?: { content?: unknown }; text?: string; finish_reason?: string }[];
      model: string;
      usage?: { total_tokens: number };
      output_text?: string;
    };

    return {
      text: this.extractText(data).trim(),
      modelUsed:
        this.config.azureDeployment ?? this.config.model ?? 'azure-gpt',
      tokensUsed: data.usage?.total_tokens ?? null,
      finishReason: data.choices?.[0]?.finish_reason ?? null,
      raw: data,
    };
  }

  private extractText(data: {
    choices?: Array<{ message?: { content?: unknown }; text?: string }>;
    output_text?: string;
  }): string {
    const messageContent = data.choices?.[0]?.message?.content;
    if (typeof messageContent === 'string') return messageContent;

    if (Array.isArray(messageContent)) {
      const parts = messageContent
        .map((part) => {
          if (typeof part === 'string') return part;
          if (part && typeof part === 'object') {
            const record = part as Record<string, unknown>;
            if (typeof record.text === 'string') return record.text;
            if (typeof record.content === 'string') return record.content;
          }
          return '';
        })
        .filter(Boolean);
      if (parts.length > 0) return parts.join('\n');
    }

    if (typeof data.output_text === 'string' && data.output_text.trim()) {
      return data.output_text;
    }

    if (typeof data.choices?.[0]?.text === 'string') {
      return data.choices[0].text;
    }

    return '';
  }

  private buildEndpoint(): string {
    const base =
      this.config.endpoint?.replace(/\/$/, '') ??
      process.env.AI_AZURE_ENDPOINT ?? '';

    if (!base) {
      throw new Error(
        'Azure OpenAI endpoint not configured. ' +
        'Set endpoint in admin settings or AI_AZURE_ENDPOINT env var.',
      );
    }

    const deployment =
      this.config.azureDeployment ??
      process.env.AI_AZURE_DEPLOYMENT ?? '';

    if (base.includes('/deployments/')) {
      return `${base}?api-version=${AzureOpenAiProvider.API_VERSION}`;
    }

    if (!deployment) {
      throw new Error(
        'Azure deployment name not configured. ' +
        'Set azureDeployment in admin settings or AI_AZURE_DEPLOYMENT env var.',
      );
    }

    return `${base}/openai/deployments/${deployment}/chat/completions?api-version=${AzureOpenAiProvider.API_VERSION}`;
  }

  private async getAuthHeader(): Promise<Record<string, string>> {
    const apiKey =
      this.config.apiKey ?? process.env.AI_AZURE_API_KEY ?? '';

    if (apiKey) {
      return { 'api-key': apiKey };
    }

    const token = await this.getServicePrincipalToken();
    return { Authorization: `Bearer ${token}` };
  }

  private async getServicePrincipalToken(): Promise<string> {
    const now = Date.now();

    if (this.cachedToken && this.cachedToken.expiresAt > now + 60_000) {
      return this.cachedToken.value;
    }

    const tenantId =
      this.config.azureTenantId ?? process.env.AI_AZURE_TENANT_ID ?? '';
    const clientId =
      this.config.azureClientId ?? process.env.AI_AZURE_CLIENT_ID ?? '';
    const clientSecret =
      this.config.azureClientSecret ?? process.env.AI_AZURE_CLIENT_SECRET ?? '';

    if (!tenantId || !clientId || !clientSecret) {
      throw new Error(
        'Azure service principal credentials not configured. ' +
        'Provide tenantId, clientId, and clientSecret in admin settings ' +
        'or set AI_AZURE_TENANT_ID / CLIENT_ID / CLIENT_SECRET env vars.',
      );
    }

    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://cognitiveservices.azure.com/.default',
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Azure AAD token error ${response.status}: ${err}`);
    }

    const tokenData = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    this.cachedToken = {
      value: tokenData.access_token,
      expiresAt: now + tokenData.expires_in * 1000,
    };

    return this.cachedToken.value;
  }
}
