import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMultiUserApprovalColumns1710301000000
  implements MigrationInterface
{
  name = 'AddMultiUserApprovalColumns1710301000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasReleaseStrategySteps = await queryRunner.hasTable(
      'release_strategy_steps',
    );
    const hasInspectionWorkflowSteps = await queryRunner.hasTable(
      'inspection_workflow_steps',
    );

    if (hasReleaseStrategySteps) {
    await queryRunner.query(`
      ALTER TABLE release_strategy_steps
      ADD COLUMN IF NOT EXISTS "userIds" JSONB
    `);

    await queryRunner.query(`
      UPDATE release_strategy_steps
      SET "userIds" = CASE
        WHEN "userIds" IS NOT NULL THEN "userIds"
        WHEN "userId" IS NOT NULL THEN jsonb_build_array("userId")
        ELSE '[]'::jsonb
      END
      WHERE "userIds" IS NULL
    `);
    }

    if (hasInspectionWorkflowSteps) {
    await queryRunner.query(`
      ALTER TABLE inspection_workflow_steps
      ADD COLUMN IF NOT EXISTS "assignedUserIds" JSONB
    `);

    await queryRunner.query(`
      UPDATE inspection_workflow_steps
      SET "assignedUserIds" = CASE
        WHEN "assignedUserIds" IS NOT NULL THEN "assignedUserIds"
        WHEN "assignedUserId" IS NOT NULL THEN jsonb_build_array("assignedUserId")
        ELSE '[]'::jsonb
      END
      WHERE "assignedUserIds" IS NULL
    `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('inspection_workflow_steps')) {
    await queryRunner.query(`
      ALTER TABLE inspection_workflow_steps
      DROP COLUMN IF EXISTS "assignedUserIds"
    `);
    }

    if (await queryRunner.hasTable('release_strategy_steps')) {
    await queryRunner.query(`
      ALTER TABLE release_strategy_steps
      DROP COLUMN IF EXISTS "userIds"
    `);
    }
  }
}
