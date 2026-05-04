import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMeasurementRateSourceToBoq1770701000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('boq_sub_item')) {
      await queryRunner.query(`
        ALTER TABLE "boq_sub_item"
        ADD COLUMN IF NOT EXISTS "rateSource" character varying(20) NOT NULL DEFAULT 'SUB_ITEM'
      `);
      await queryRunner.query(`
        UPDATE "boq_sub_item"
        SET "rateSource" = 'SUB_ITEM'
        WHERE "rateSource" IS NULL OR TRIM("rateSource") = ''
      `);
    }

    if (await queryRunner.hasTable('measurement_element')) {
      await queryRunner.query(`
        ALTER TABLE "measurement_element"
        ADD COLUMN IF NOT EXISTS "rate" numeric(12,2) NOT NULL DEFAULT 0
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('measurement_element')) {
      await queryRunner.query(`
        ALTER TABLE "measurement_element"
        DROP COLUMN IF EXISTS "rate"
      `);
    }

    if (await queryRunner.hasTable('boq_sub_item')) {
      await queryRunner.query(`
        ALTER TABLE "boq_sub_item"
        DROP COLUMN IF EXISTS "rateSource"
      `);
    }
  }
}
