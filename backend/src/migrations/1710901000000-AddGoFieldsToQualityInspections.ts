import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGoFieldsToQualityInspections1710901000000
  implements MigrationInterface
{
  name = 'AddGoFieldsToQualityInspections1710901000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('quality_inspections'))) {
      return;
    }

    await queryRunner.query(`
      ALTER TABLE "quality_inspections"
      ADD COLUMN IF NOT EXISTS "go_no" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "quality_inspections"
      ADD COLUMN IF NOT EXISTS "go_label" character varying(100)
    `);
    await queryRunner.query(`
      UPDATE "quality_inspections"
      SET
        "go_no" = COALESCE("go_no", "partNo"),
        "go_label" = COALESCE(
          NULLIF("go_label", ''),
          CASE
            WHEN "partNo" IS NOT NULL THEN 'GO ' || "partNo"::text
            ELSE NULL
          END
        ),
        "partLabel" = CASE
          WHEN "partLabel" IS NOT NULL AND "partLabel" LIKE 'Part %'
            THEN regexp_replace("partLabel", '^Part', 'GO')
          ELSE "partLabel"
        END
      WHERE "documentType" = 'FLOOR_RFI'
         OR "processCode" = 'QA_QC_APPROVAL'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('quality_inspections'))) {
      return;
    }

    await queryRunner.query(`
      ALTER TABLE "quality_inspections"
      DROP COLUMN IF EXISTS "go_label"
    `);
    await queryRunner.query(`
      ALTER TABLE "quality_inspections"
      DROP COLUMN IF EXISTS "go_no"
    `);
  }
}
