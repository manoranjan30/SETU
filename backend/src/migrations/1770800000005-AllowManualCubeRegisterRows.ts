import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowManualCubeRegisterRows1770800000005
  implements MigrationInterface
{
  name = 'AllowManualCubeRegisterRows1770800000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('quality_cube_test_register'))) {
      return;
    }

    await queryRunner.query(`
      ALTER TABLE "quality_cube_test_register"
      ALTER COLUMN "inspectionId" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "quality_cube_test_register"
      ALTER COLUMN "pourCardId" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('quality_cube_test_register'))) {
      return;
    }

    await queryRunner.query(`
      DELETE FROM "quality_cube_test_register"
      WHERE "inspectionId" IS NULL OR "pourCardId" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "quality_cube_test_register"
      ALTER COLUMN "pourCardId" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "quality_cube_test_register"
      ALTER COLUMN "inspectionId" SET NOT NULL
    `);
  }
}
