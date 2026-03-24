import { IsNumber, IsOptional, IsObject } from 'class-validator';

export class RunInsightDto {
  /** Which template to run. */
  @IsNumber()
  templateId: number;

  /** Project context — required for PROJECT-scoped templates. */
  @IsOptional()
  @IsNumber()
  projectId?: number | null;

  /**
   * Runtime parameter overrides, e.g.:
   * { "dateRange": { "from": "2024-01-01", "to": "2024-01-31" } }
   */
  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;
}

export class InsightRunQueryDto {
  @IsOptional()
  @IsNumber()
  projectId?: number;

  @IsOptional()
  @IsNumber()
  templateId?: number;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
