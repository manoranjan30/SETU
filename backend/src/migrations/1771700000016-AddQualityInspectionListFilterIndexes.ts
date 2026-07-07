import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQualityInspectionListFilterIndexes1771700000016 implements MigrationInterface {
  name = 'AddQualityInspectionListFilterIndexes1771700000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quality_inspections_project_eps_list_created"
      ON "quality_inspections" ("projectId", "epsNodeId", "listId", "createdAt" DESC, "id" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quality_inspections_project_list_status_created"
      ON "quality_inspections" ("projectId", "listId", "status", "createdAt" DESC, "id" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_quality_inspections_project_list_status_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_quality_inspections_project_eps_list_created"`,
    );
  }
}
