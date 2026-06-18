import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLargeListPaginationIndexes1771700000004
  implements MigrationInterface
{
  name = 'AddLargeListPaginationIndexes1771700000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quality_inspections_project_created"
      ON "quality_inspections" ("projectId", "createdAt" DESC, "id" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quality_inspections_project_status_created"
      ON "quality_inspections" ("projectId", "status", "createdAt" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_drawing_register_project_updated"
      ON "drawing_register" ("projectId", "updatedAt" DESC, "id" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quality_items_project_type_created"
      ON "quality_items" ("projectId", "type", "createdAt" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ehs_incidents_project_date"
      ON "ehs_incidents" ("projectId", "incidentDate" DESC, "id" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_execution_progress_project_status_created"
      ON "execution_progress_entry" ("projectId", "status", "createdAt" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_execution_progress_project_status_created"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ehs_incidents_project_date"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_quality_items_project_type_created"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_drawing_register_project_updated"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_quality_inspections_project_status_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_quality_inspections_project_created"`,
    );
  }
}
