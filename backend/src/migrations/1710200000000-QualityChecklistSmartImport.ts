import { MigrationInterface, QueryRunner } from 'typeorm';

export class QualityChecklistSmartImport1710200000000
  implements MigrationInterface
{
  name = 'QualityChecklistSmartImport1710200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasChecklistTemplates = await queryRunner.hasTable(
      'quality_checklist_templates',
    );
    const hasStageTemplates = await queryRunner.hasTable(
      'quality_stage_templates',
    );
    const hasInspections = await queryRunner.hasTable('quality_inspections');

    if (hasChecklistTemplates) {
    await queryRunner.query(`
      ALTER TABLE quality_checklist_templates
      ADD COLUMN IF NOT EXISTS checklist_no VARCHAR(50),
      ADD COLUMN IF NOT EXISTS rev_no VARCHAR(20) DEFAULT '01',
      ADD COLUMN IF NOT EXISTS activity_title VARCHAR(255),
      ADD COLUMN IF NOT EXISTS activity_type VARCHAR(100),
      ADD COLUMN IF NOT EXISTS discipline VARCHAR(100),
      ADD COLUMN IF NOT EXISTS applicable_trade VARCHAR(100),
      ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT FALSE
    `);
    }

    if (hasStageTemplates) {
    await queryRunner.query(`
      ALTER TABLE quality_stage_templates
      ADD COLUMN IF NOT EXISTS signature_slots JSONB
    `);
    }

    if (hasInspections) {
    await queryRunner.query(`
      ALTER TABLE quality_inspections
      ADD COLUMN IF NOT EXISTS drawing_no VARCHAR(100),
      ADD COLUMN IF NOT EXISTS contractor_name VARCHAR(255)
    `);
    }

    if (hasChecklistTemplates) {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_quality_checklist_no_project
      ON quality_checklist_templates("projectId", checklist_no)
      WHERE checklist_no IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_quality_checklist_global
      ON quality_checklist_templates(is_global)
    `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasChecklistTemplates = await queryRunner.hasTable(
      'quality_checklist_templates',
    );
    const hasStageTemplates = await queryRunner.hasTable(
      'quality_stage_templates',
    );
    const hasInspections = await queryRunner.hasTable('quality_inspections');

    if (hasChecklistTemplates) {
      await queryRunner.query(`DROP INDEX IF EXISTS idx_quality_checklist_global`);
      await queryRunner.query(
        `DROP INDEX IF EXISTS idx_quality_checklist_no_project`,
      );
    }
    if (hasInspections) {
    await queryRunner.query(`
      ALTER TABLE quality_inspections
      DROP COLUMN IF EXISTS contractor_name,
      DROP COLUMN IF EXISTS drawing_no
    `);
    }
    if (hasStageTemplates) {
    await queryRunner.query(`
      ALTER TABLE quality_stage_templates
      DROP COLUMN IF EXISTS signature_slots
    `);
    }
    if (hasChecklistTemplates) {
    await queryRunner.query(`
      ALTER TABLE quality_checklist_templates
      DROP COLUMN IF EXISTS is_global,
      DROP COLUMN IF EXISTS applicable_trade,
      DROP COLUMN IF EXISTS discipline,
      DROP COLUMN IF EXISTS activity_type,
      DROP COLUMN IF EXISTS activity_title,
      DROP COLUMN IF EXISTS rev_no,
      DROP COLUMN IF EXISTS checklist_no
    `);
    }
  }
}
