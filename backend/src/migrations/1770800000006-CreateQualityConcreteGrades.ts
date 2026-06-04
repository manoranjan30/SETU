import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQualityConcreteGrades1770800000006
  implements MigrationInterface
{
  name = 'CreateQualityConcreteGrades1770800000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quality_concrete_grades" (
        "id" SERIAL NOT NULL,
        "projectId" integer NOT NULL,
        "grade" character varying(80) NOT NULL,
        "targetMeanStrengthMpa" numeric(12,3),
        "characteristicStrengthMpa" numeric(12,3),
        "mixRatio" character varying(120),
        "slumpRangeMm" character varying(120),
        "waterCementRatio" numeric(12,3),
        "cementContentKgM3" numeric(12,3),
        "remarks" text,
        "propertyDetails" jsonb,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quality_concrete_grades" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_quality_concrete_grades_project_grade"
      ON "quality_concrete_grades" ("projectId", "grade")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_quality_concrete_grades_project_grade"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "quality_concrete_grades"`);
  }
}
