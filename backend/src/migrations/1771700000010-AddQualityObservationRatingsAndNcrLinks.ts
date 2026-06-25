import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQualityObservationRatingsAndNcrLinks1771700000010
  implements MigrationInterface
{
  name = 'AddQualityObservationRatingsAndNcrLinks1771700000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "site_observations"
      ADD COLUMN IF NOT EXISTS "observationRating" varchar(20) NOT NULL DEFAULT 'MINOR',
      ADD COLUMN IF NOT EXISTS "ncrId" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "activity_observations"
      ADD COLUMN IF NOT EXISTS "observationRating" varchar(20) NOT NULL DEFAULT 'MINOR',
      ADD COLUMN IF NOT EXISTS "ncrId" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "quality_observations_ncr"
      ADD COLUMN IF NOT EXISTS "sourceType" varchar(40),
      ADD COLUMN IF NOT EXISTS "sourceId" varchar(80),
      ADD COLUMN IF NOT EXISTS "sourceReference" varchar(120)
    `);
    await queryRunner.query(`
      UPDATE "site_observations"
      SET "observationRating" = CASE
        WHEN "severity"::text = 'INFO' THEN 'OFI'
        WHEN "severity"::text = 'CRITICAL' THEN 'CRITICAL'
        WHEN "severity"::text = 'MAJOR' THEN 'MAJOR'
        ELSE 'MINOR'
      END
    `);
    await queryRunner.query(`
      UPDATE "activity_observations"
      SET "observationRating" = CASE
        WHEN UPPER(COALESCE("type", '')) = 'CRITICAL' THEN 'CRITICAL'
        WHEN UPPER(COALESCE("type", '')) = 'MAJOR' THEN 'MAJOR'
        WHEN UPPER(COALESCE("type", '')) = 'MODERATE' THEN 'MODERATE'
        WHEN UPPER(COALESCE("type", '')) IN ('OFI', 'INFO') THEN 'OFI'
        ELSE 'MINOR'
      END
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_quality_ncr_source"
      ON "quality_observations_ncr" ("sourceType", "sourceId")
      WHERE "sourceType" IS NOT NULL AND "sourceId" IS NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "site_observations"
      ADD CONSTRAINT "FK_site_observations_ncr"
      FOREIGN KEY ("ncrId") REFERENCES "quality_observations_ncr"("id")
      ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "activity_observations"
      ADD CONSTRAINT "FK_activity_observations_ncr"
      FOREIGN KEY ("ncrId") REFERENCES "quality_observations_ncr"("id")
      ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "activity_observations" DROP CONSTRAINT IF EXISTS "FK_activity_observations_ncr"`,
    );
    await queryRunner.query(
      `ALTER TABLE "site_observations" DROP CONSTRAINT IF EXISTS "FK_site_observations_ncr"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_quality_ncr_source"`);
    await queryRunner.query(`
      ALTER TABLE "quality_observations_ncr"
      DROP COLUMN IF EXISTS "sourceReference",
      DROP COLUMN IF EXISTS "sourceId",
      DROP COLUMN IF EXISTS "sourceType"
    `);
    await queryRunner.query(`
      ALTER TABLE "activity_observations"
      DROP COLUMN IF EXISTS "ncrId",
      DROP COLUMN IF EXISTS "observationRating"
    `);
    await queryRunner.query(`
      ALTER TABLE "site_observations"
      DROP COLUMN IF EXISTS "ncrId",
      DROP COLUMN IF EXISTS "observationRating"
    `);
  }
}
