import { MigrationInterface, QueryRunner } from 'typeorm';

export class LinkActivityObservationsToStages1710700000000
  implements MigrationInterface
{
  name = 'LinkActivityObservationsToStages1710700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (
      !(await queryRunner.hasTable('activity_observations')) ||
      !(await queryRunner.hasTable('quality_inspection_stages'))
    ) {
      return;
    }

    await queryRunner.query(`
      ALTER TABLE activity_observations
      ADD COLUMN IF NOT EXISTS "stageId" integer
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_activity_observations_stageId'
            AND table_name = 'activity_observations'
        ) THEN
          ALTER TABLE activity_observations
          ADD CONSTRAINT "FK_activity_observations_stageId"
          FOREIGN KEY ("stageId")
          REFERENCES quality_inspection_stages(id)
          ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_activity_observations_stageId"
      ON activity_observations ("stageId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('activity_observations'))) {
      return;
    }

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_activity_observations_stageId"
    `);

    await queryRunner.query(`
      ALTER TABLE activity_observations
      DROP CONSTRAINT IF EXISTS "FK_activity_observations_stageId"
    `);

    await queryRunner.query(`
      ALTER TABLE activity_observations
      DROP COLUMN IF EXISTS "stageId"
    `);
  }
}
