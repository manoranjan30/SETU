import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeWorkflowTemplateNullable1710500000000
  implements MigrationInterface
{
  name = 'MakeWorkflowTemplateNullable1710500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE inspection_workflow_runs
      ALTER COLUMN "workflowTemplateId" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM inspection_workflow_runs
      WHERE "workflowTemplateId" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE inspection_workflow_runs
      ALTER COLUMN "workflowTemplateId" SET NOT NULL
    `);
  }
}
