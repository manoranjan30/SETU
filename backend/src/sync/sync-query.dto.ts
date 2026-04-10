import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class SyncQueryDto {
  /**
   * ISO-8601 timestamp. Only records updated AFTER this time are returned.
   * If omitted, all records for the project are returned (bootstrap fetch).
   */
  @IsOptional()
  @IsDateString()
  since?: string;

  /** The project to scope the sync to. */
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  projectId: number;
}
