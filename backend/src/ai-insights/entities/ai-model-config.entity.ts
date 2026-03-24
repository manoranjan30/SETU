import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

/**
 * Stores AI provider configurations (OpenRouter, Azure OpenAI, etc.).
 * Managed via the admin panel. Only the active config is used for inference.
 * API keys are stored encrypted at rest (handled by DB-level encryption or env).
 */
@Entity('ai_model_config')
export class AiModelConfig {
  @PrimaryGeneratedColumn()
  id: number;

  /** Provider identifier: 'openrouter' | 'azure' | 'openai' */
  @Column({ type: 'varchar', length: 50, default: 'openrouter' })
  provider: string;

  /** API key — null means "use env var AI_API_KEY" */
  @Column({ type: 'text', nullable: true })
  apiKey: string | null;

  /** Base endpoint URL (required for Azure; optional for OpenRouter) */
  @Column({ type: 'varchar', length: 500, nullable: true })
  endpoint: string | null;

  /** Model name / deployment name */
  @Column({ type: 'varchar', length: 200, default: 'meta-llama/llama-3.3-70b-instruct:free' })
  model: string;

  @Column({ type: 'int', default: 4096 })
  maxTokens: number;

  @Column({ type: 'float', default: 0.2 })
  temperature: number;

  /** Only one config should be active at a time */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /** Human-readable label shown in admin panel */
  @Column({ type: 'varchar', length: 200, nullable: true })
  label: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  // ─── Azure-specific fields ─────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 200, nullable: true })
  azureTenantId: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  azureClientId: string | null;

  @Column({ type: 'text', nullable: true })
  azureClientSecret: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  azureDeployment: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
