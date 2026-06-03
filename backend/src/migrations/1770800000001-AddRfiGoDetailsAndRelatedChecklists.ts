import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRfiGoDetailsAndRelatedChecklists1770800000001
  implements MigrationInterface
{
  name = 'AddRfiGoDetailsAndRelatedChecklists1770800000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('quality_inspections'))) {
      return;
    }

    await queryRunner.query(`
      ALTER TABLE "quality_inspections"
      ADD COLUMN IF NOT EXISTS "go_details" text
    `);
    await queryRunner.query(`
      ALTER TABLE "quality_inspections"
      ADD COLUMN IF NOT EXISTS "related_checklist_inspection_ids" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('quality_inspections'))) {
      return;
    }

    await queryRunner.query(`
      ALTER TABLE "quality_inspections"
      DROP COLUMN IF EXISTS "related_checklist_inspection_ids"
    `);
    await queryRunner.query(`
      ALTER TABLE "quality_inspections"
      DROP COLUMN IF EXISTS "go_details"
    `);
  }
}
