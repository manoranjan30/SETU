import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds enum values that TypeORM's synchronize:true cannot add automatically.
 *
 * PostgreSQL ALTER TYPE ... ADD VALUE is safe (non-destructive) and supports
 * IF NOT EXISTS so this migration is idempotent — safe to run multiple times.
 *
 * Affected types:
 *   quality_inspections_status_enum  — missing: PARTIALLY_APPROVED,
 *                                      PROVISIONALLY_APPROVED, CANCELED, REVERSED
 *   quality_inspection_stages_status_enum — missing: COMPLETED
 */
export class AddMissingEnumValues1710900000000 implements MigrationInterface {
  name = 'AddMissingEnumValues1710900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── quality_inspections.status enum ──────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'PARTIALLY_APPROVED'
            AND enumtypid = (
              SELECT oid FROM pg_type WHERE typname = 'quality_inspections_status_enum'
            )
        ) THEN
          ALTER TYPE quality_inspections_status_enum ADD VALUE 'PARTIALLY_APPROVED';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'PROVISIONALLY_APPROVED'
            AND enumtypid = (
              SELECT oid FROM pg_type WHERE typname = 'quality_inspections_status_enum'
            )
        ) THEN
          ALTER TYPE quality_inspections_status_enum ADD VALUE 'PROVISIONALLY_APPROVED';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'CANCELED'
            AND enumtypid = (
              SELECT oid FROM pg_type WHERE typname = 'quality_inspections_status_enum'
            )
        ) THEN
          ALTER TYPE quality_inspections_status_enum ADD VALUE 'CANCELED';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'REVERSED'
            AND enumtypid = (
              SELECT oid FROM pg_type WHERE typname = 'quality_inspections_status_enum'
            )
        ) THEN
          ALTER TYPE quality_inspections_status_enum ADD VALUE 'REVERSED';
        END IF;
      END $$;
    `);

    // ── quality_inspection_stages.status enum ─────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'COMPLETED'
            AND enumtypid = (
              SELECT oid FROM pg_type WHERE typname = 'quality_inspection_stages_status_enum'
            )
        ) THEN
          ALTER TYPE quality_inspection_stages_status_enum ADD VALUE 'COMPLETED';
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing enum values without dropping and
    // recreating the type. The down migration is a no-op intentionally.
    // To roll back: drop affected tables/types and recreate from scratch.
  }
}
