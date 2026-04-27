import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFloorVisibilityToQualityActivity1770300000000
  implements MigrationInterface
{
  name = 'AddFloorVisibilityToQualityActivity1770300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('quality_activity'))) {
      return;
    }

    await queryRunner.query(`
      ALTER TABLE "quality_activity"
      ADD COLUMN IF NOT EXISTS "floor_visibility" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('quality_activity'))) {
      return;
    }

    await queryRunner.query(`
      ALTER TABLE "quality_activity"
      DROP COLUMN IF EXISTS "floor_visibility"
    `);
  }
}
