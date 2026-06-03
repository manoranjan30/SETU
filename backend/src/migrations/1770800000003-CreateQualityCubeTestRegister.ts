import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQualityCubeTestRegister1770800000003
  implements MigrationInterface
{
  name = 'CreateQualityCubeTestRegister1770800000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "quality_cube_test_register_testage_enum" AS ENUM ('7_DAY', '28_DAY');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "quality_cube_test_register_status_enum" AS ENUM (
          'PENDING',
          'DUE_TODAY',
          'OVERDUE',
          'TESTED',
          'APPROVED',
          'FAILED'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quality_cube_test_register" (
        "id" SERIAL NOT NULL,
        "projectId" integer NOT NULL,
        "inspectionId" integer NOT NULL,
        "pourCardId" integer NOT NULL,
        "pourEntryIndex" integer,
        "cubeId" character varying(80) NOT NULL,
        "testAge" "quality_cube_test_register_testage_enum" NOT NULL,
        "castDate" date NOT NULL,
        "dueDate" date NOT NULL,
        "projectNameSnapshot" character varying(255),
        "activityName" character varying(255),
        "elementName" character varying(255),
        "goLabel" character varying(255),
        "goDetails" text,
        "locationText" character varying(255),
        "mixIdOrGrade" character varying(255),
        "truckNo" character varying(255),
        "deliveryChallanNo" character varying(255),
        "quantityM3" numeric(12,3),
        "specimenSize" character varying(80),
        "loadKn" numeric(12,3),
        "compressiveStrengthMpa" numeric(12,3),
        "averageStrengthMpa" numeric(12,3),
        "requiredStrengthMpa" numeric(12,3),
        "calculationDetails" jsonb,
        "status" "quality_cube_test_register_status_enum" NOT NULL DEFAULT 'PENDING',
        "testedByName" character varying(255),
        "testedDate" date,
        "remarks" text,
        "approvedAt" TIMESTAMP,
        "approvedByUserId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quality_cube_test_register" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_quality_cube_project_cube"
      ON "quality_cube_test_register" ("projectId", "cubeId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quality_cube_project_due"
      ON "quality_cube_test_register" ("projectId", "dueDate")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quality_cube_inspection"
      ON "quality_cube_test_register" ("inspectionId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quality_cube_inspection"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quality_cube_project_due"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quality_cube_project_cube"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "quality_cube_test_register"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "quality_cube_test_register_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "quality_cube_test_register_testage_enum"`,
    );
  }
}
