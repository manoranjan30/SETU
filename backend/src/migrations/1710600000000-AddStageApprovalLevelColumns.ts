import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStageApprovalLevelColumns1710600000000
  implements MigrationInterface
{
  name = 'AddStageApprovalLevelColumns1710600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('quality_signatures'))) {
      return;
    }

    await queryRunner.query(`
      ALTER TABLE quality_signatures
      ADD COLUMN IF NOT EXISTS "approvalLevelOrder" integer
    `);

    await queryRunner.query(`
      ALTER TABLE quality_signatures
      ADD COLUMN IF NOT EXISTS "approvalLevelName" character varying(200)
    `);

    await queryRunner.query(`
      ALTER TABLE quality_signatures
      ADD COLUMN IF NOT EXISTS "approvalAssignedUserId" integer
    `);

    await queryRunner.query(`
      ALTER TABLE quality_signatures
      ADD COLUMN IF NOT EXISTS "approvalAssignedRoleId" integer
    `);

    await queryRunner.query(`
      ALTER TABLE quality_signatures
      ADD COLUMN IF NOT EXISTS "isAutoInherited" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE quality_signatures
      ADD COLUMN IF NOT EXISTS "inheritedFromStepOrder" integer
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('quality_signatures'))) {
      return;
    }

    await queryRunner.query(`
      ALTER TABLE quality_signatures
      DROP COLUMN IF EXISTS "inheritedFromStepOrder"
    `);

    await queryRunner.query(`
      ALTER TABLE quality_signatures
      DROP COLUMN IF EXISTS "isAutoInherited"
    `);

    await queryRunner.query(`
      ALTER TABLE quality_signatures
      DROP COLUMN IF EXISTS "approvalAssignedRoleId"
    `);

    await queryRunner.query(`
      ALTER TABLE quality_signatures
      DROP COLUMN IF EXISTS "approvalAssignedUserId"
    `);

    await queryRunner.query(`
      ALTER TABLE quality_signatures
      DROP COLUMN IF EXISTS "approvalLevelName"
    `);

    await queryRunner.query(`
      ALTER TABLE quality_signatures
      DROP COLUMN IF EXISTS "approvalLevelOrder"
    `);
  }
}
