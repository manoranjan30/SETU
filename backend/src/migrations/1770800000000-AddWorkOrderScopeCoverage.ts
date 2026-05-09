import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkOrderScopeCoverage1770800000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('work_order_items'))) {
      return;
    }

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'work_order_items_issuescopemode_enum') THEN
          CREATE TYPE "work_order_items_issuescopemode_enum" AS ENUM ('FULL_SCOPE', 'SPLIT_SCOPE', 'CREEP_SCOPE');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      ALTER TABLE "work_order_items"
      ADD COLUMN IF NOT EXISTS "issueScopeMode" "work_order_items_issuescopemode_enum" NOT NULL DEFAULT 'FULL_SCOPE',
      ADD COLUMN IF NOT EXISTS "originalBoqQty" numeric(15,3),
      ADD COLUMN IF NOT EXISTS "originalBoqRate" numeric(15,2),
      ADD COLUMN IF NOT EXISTS "issuedScopeSummary" text,
      ADD COLUMN IF NOT EXISTS "pendingScopeSummary" text,
      ADD COLUMN IF NOT EXISTS "creepScopeSummary" text,
      ADD COLUMN IF NOT EXISTS "scopeCreepReason" text,
      ADD COLUMN IF NOT EXISTS "issuedScopeComponents" json,
      ADD COLUMN IF NOT EXISTS "pendingScopeComponents" json,
      ADD COLUMN IF NOT EXISTS "creepScopeComponents" json,
      ADD COLUMN IF NOT EXISTS "hasPendingScope" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "vendorOnboardStatus" character varying(30) NOT NULL DEFAULT 'PENDING'
    `);

    await queryRunner.query(`
      UPDATE "work_order_items"
      SET
        "issueScopeMode" = COALESCE("issueScopeMode", 'FULL_SCOPE'),
        "originalBoqQty" = COALESCE("originalBoqQty", "boqQty"),
        "originalBoqRate" = COALESCE("originalBoqRate", "rate"),
        "vendorOnboardStatus" = COALESCE(NULLIF(TRIM("vendorOnboardStatus"), ''), 'PENDING')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('work_order_items'))) {
      return;
    }

    await queryRunner.query(`
      ALTER TABLE "work_order_items"
      DROP COLUMN IF EXISTS "vendorOnboardStatus",
      DROP COLUMN IF EXISTS "hasPendingScope",
      DROP COLUMN IF EXISTS "creepScopeComponents",
      DROP COLUMN IF EXISTS "pendingScopeComponents",
      DROP COLUMN IF EXISTS "issuedScopeComponents",
      DROP COLUMN IF EXISTS "scopeCreepReason",
      DROP COLUMN IF EXISTS "creepScopeSummary",
      DROP COLUMN IF EXISTS "pendingScopeSummary",
      DROP COLUMN IF EXISTS "issuedScopeSummary",
      DROP COLUMN IF EXISTS "originalBoqRate",
      DROP COLUMN IF EXISTS "originalBoqQty",
      DROP COLUMN IF EXISTS "issueScopeMode"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "work_order_items_issuescopemode_enum"
    `);
  }
}
