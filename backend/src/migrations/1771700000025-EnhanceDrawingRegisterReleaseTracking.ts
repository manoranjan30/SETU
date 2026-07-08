import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhanceDrawingRegisterReleaseTracking1771700000025
  implements MigrationInterface
{
  name = 'EnhanceDrawingRegisterReleaseTracking1771700000025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "drawing_register"
        ADD COLUMN IF NOT EXISTS "targetReleaseDate" date,
        ADD COLUMN IF NOT EXISTS "actualReleaseDate" date,
        ADD COLUMN IF NOT EXISTS "responsibleDiscipline" varchar(120)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_drawing_register_project_target_release"
      ON "drawing_register" ("projectId", "targetReleaseDate")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_drawing_register_project_target_release"`);
    await queryRunner.query(`
      ALTER TABLE "drawing_register"
        DROP COLUMN IF EXISTS "responsibleDiscipline",
        DROP COLUMN IF EXISTS "actualReleaseDate",
        DROP COLUMN IF EXISTS "targetReleaseDate"
    `);
  }
}
