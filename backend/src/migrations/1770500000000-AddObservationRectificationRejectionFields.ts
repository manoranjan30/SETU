import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddObservationRectificationRejectionFields1770500000000
  implements MigrationInterface
{
  name = 'AddObservationRectificationRejectionFields1770500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "site_observations"
      ADD COLUMN IF NOT EXISTS "rectificationRejectedRemarks" text NULL,
      ADD COLUMN IF NOT EXISTS "rectificationRejectedById" character varying NULL,
      ADD COLUMN IF NOT EXISTS "rectificationRejectedAt" TIMESTAMP NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "ehs_observations"
      ADD COLUMN IF NOT EXISTS "rectificationRejectedRemarks" text NULL,
      ADD COLUMN IF NOT EXISTS "rectificationRejectedById" character varying NULL,
      ADD COLUMN IF NOT EXISTS "rectificationRejectedAt" TIMESTAMP NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "activity_observations"
      ADD COLUMN IF NOT EXISTS "rectificationRejectedRemarks" text NULL,
      ADD COLUMN IF NOT EXISTS "rectificationRejectedBy" character varying NULL,
      ADD COLUMN IF NOT EXISTS "rectificationRejectedAt" TIMESTAMP NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "activity_observations"
      DROP COLUMN IF EXISTS "rectificationRejectedAt",
      DROP COLUMN IF EXISTS "rectificationRejectedBy",
      DROP COLUMN IF EXISTS "rectificationRejectedRemarks"
    `);

    await queryRunner.query(`
      ALTER TABLE "ehs_observations"
      DROP COLUMN IF EXISTS "rectificationRejectedAt",
      DROP COLUMN IF EXISTS "rectificationRejectedById",
      DROP COLUMN IF EXISTS "rectificationRejectedRemarks"
    `);

    await queryRunner.query(`
      ALTER TABLE "site_observations"
      DROP COLUMN IF EXISTS "rectificationRejectedAt",
      DROP COLUMN IF EXISTS "rectificationRejectedById",
      DROP COLUMN IF EXISTS "rectificationRejectedRemarks"
    `);
  }
}
