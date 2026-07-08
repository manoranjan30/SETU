import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQualityPlanningReadPerformanceIndexes1771700000020
  implements MigrationInterface
{
  name = 'AddQualityPlanningReadPerformanceIndexes1771700000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quality_inspections_project_eps_activity_go"
      ON "quality_inspections" ("projectId", "epsNodeId", "activityId", "partNo")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quality_inspections_project_activity_status_created"
      ON "quality_inspections" ("projectId", "activityId", "status", "createdAt" DESC, "id" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_project_tasks_project_status_due"
      ON "project_tasks" ("projectId", "status", "dueDate", "id" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_project_tasks_project_assignee_status_due"
      ON "project_tasks" ("projectId", "assignedToUserId", "status", "dueDate", "id" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_project_tasks_project_updated"
      ON "project_tasks" ("projectId", "updatedAt" DESC, "id" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_followup_actions_project_status_due"
      ON "followup_actions" ("projectId", "status", "dueDate", "id" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_followup_actions_project_assignee_status_due"
      ON "followup_actions" ("projectId", "assignedToUserId", "status", "dueDate", "id" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_followup_actions_project_updated"
      ON "followup_actions" ("projectId", "updatedAt" DESC, "id" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_site_journal_entries_project_status_date"
      ON "site_journal_entries" ("projectId", "status", "date" DESC, "id" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_site_journal_entries_project_author_date"
      ON "site_journal_entries" ("projectId", "authorUserId", "date" DESC, "id" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_site_journal_entries_project_author_date"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_site_journal_entries_project_status_date"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_followup_actions_project_updated"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_followup_actions_project_assignee_status_due"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_followup_actions_project_status_due"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_project_tasks_project_updated"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_project_tasks_project_assignee_status_due"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_project_tasks_project_status_due"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_quality_inspections_project_activity_status_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_quality_inspections_project_eps_activity_go"`,
    );
  }
}
