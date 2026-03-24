import {
  IsString, IsOptional, IsBoolean, IsNumber,
  IsIn, Min, Max, MaxLength, IsNotEmpty,
} from 'class-validator';

export class CreateAiModelConfigDto {
  @IsIn(['openrouter', 'azure', 'openai'])
  provider: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  endpoint?: string | null;

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  model: string;

  @IsOptional()
  @IsNumber()
  @Min(256)
  @Max(128000)
  maxTokens?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  // ── Azure-specific ──────────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  @MaxLength(200)
  azureTenantId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  azureClientId?: string | null;

  @IsOptional()
  @IsString()
  azureClientSecret?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  azureDeployment?: string | null;
}

export class UpdateAiModelConfigDto extends CreateAiModelConfigDto {}

export class TestAiModelConfigDto {
  /** Optional config id to test — if omitted tests the active config. */
  @IsOptional()
  @IsNumber()
  configId?: number;

  /** Override prompt for the test call. */
  @IsOptional()
  @IsString()
  prompt?: string;
}
