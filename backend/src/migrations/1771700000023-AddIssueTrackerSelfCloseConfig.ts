import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIssueTrackerSelfCloseConfig1771700000023 implements MigrationInterface {
  name = 'AddIssueTrackerSelfCloseConfig1771700000023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "issue_tracker_dept_project_config"
      ADD COLUMN IF NOT EXISTS "allowMemberSelfClose" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "issue_tracker_dept_project_config"
      DROP COLUMN IF EXISTS "allowMemberSelfClose"
    `);
  }
}
