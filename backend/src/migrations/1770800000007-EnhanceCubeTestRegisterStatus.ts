import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhanceCubeTestRegisterStatus1770800000007
  implements MigrationInterface
{
  name = 'EnhanceCubeTestRegisterStatus1770800000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "quality_cube_test_register_status_enum"
      ADD VALUE IF NOT EXISTS 'PASSED'
    `);
    await queryRunner.query(`
      ALTER TYPE "quality_cube_test_register_status_enum"
      ADD VALUE IF NOT EXISTS 'NEEDS_ATTENTION'
    `);
    await queryRunner.query(`
      ALTER TABLE "quality_cube_test_register"
      ADD COLUMN IF NOT EXISTS "witnessedByName" character varying(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "quality_cube_test_register"
      DROP COLUMN IF EXISTS "witnessedByName"
    `);
  }
}
