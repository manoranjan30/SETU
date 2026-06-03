import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCubeRegisterCascadeKeys1770800000004
  implements MigrationInterface
{
  name = 'AddCubeRegisterCascadeKeys1770800000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('quality_cube_test_register'))) {
      return;
    }

    await queryRunner.query(`
      ALTER TABLE "quality_cube_test_register"
      DROP CONSTRAINT IF EXISTS "FK_quality_cube_register_inspection"
    `);
    await queryRunner.query(`
      ALTER TABLE "quality_cube_test_register"
      ADD CONSTRAINT "FK_quality_cube_register_inspection"
      FOREIGN KEY ("inspectionId")
      REFERENCES "quality_inspections"("id")
      ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "quality_cube_test_register"
      DROP CONSTRAINT IF EXISTS "FK_quality_cube_register_pour_card"
    `);
    await queryRunner.query(`
      ALTER TABLE "quality_cube_test_register"
      ADD CONSTRAINT "FK_quality_cube_register_pour_card"
      FOREIGN KEY ("pourCardId")
      REFERENCES "quality_pour_cards"("id")
      ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('quality_cube_test_register'))) {
      return;
    }

    await queryRunner.query(`
      ALTER TABLE "quality_cube_test_register"
      DROP CONSTRAINT IF EXISTS "FK_quality_cube_register_pour_card"
    `);
    await queryRunner.query(`
      ALTER TABLE "quality_cube_test_register"
      DROP CONSTRAINT IF EXISTS "FK_quality_cube_register_inspection"
    `);
  }
}
