import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixSnagReadyEnumCompatibility1780800000000
  implements MigrationInterface
{
  name = 'FixSnagReadyEnumCompatibility1780800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'snag_list_status'
        ) THEN
          ALTER TYPE "snag_list_status" ADD VALUE IF NOT EXISTS 'ready_for_snag';
        END IF;

        IF EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'snag_list_overall_status_enum'
        ) THEN
          ALTER TYPE "snag_list_overall_status_enum" ADD VALUE IF NOT EXISTS 'ready_for_snag';
        END IF;
      END $$;
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL enum values cannot be dropped safely without rebuilding the
    // dependent table column. Leave the compatibility value in place.
  }
}
