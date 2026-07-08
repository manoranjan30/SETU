import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePlanningCustomTrackers1771700000026
  implements MigrationInterface
{
  name = 'CreatePlanningCustomTrackers1771700000026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "planning_custom_trackers" (
        "id" SERIAL PRIMARY KEY,
        "projectId" integer NOT NULL,
        "name" varchar(180) NOT NULL,
        "description" text,
        "trackerType" varchar(80) NOT NULL DEFAULT 'GENERAL',
        "status" varchar(24) NOT NULL DEFAULT 'ACTIVE',
        "locationScopeTypes" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "categoryConfig" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "chartConfig" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdByUserId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "planning_custom_tracker_fields" (
        "id" SERIAL PRIMARY KEY,
        "trackerId" integer NOT NULL,
        "label" varchar(120) NOT NULL,
        "key" varchar(120) NOT NULL,
        "fieldType" varchar(32) NOT NULL DEFAULT 'TEXT',
        "required" boolean NOT NULL DEFAULT false,
        "unit" varchar(40),
        "options" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "formula" text,
        "sequence" integer NOT NULL DEFAULT 0,
        "isKpi" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "planning_custom_tracker_records" (
        "id" SERIAL PRIMARY KEY,
        "trackerId" integer NOT NULL,
        "projectId" integer NOT NULL,
        "epsNodeId" integer,
        "locationText" varchar(500),
        "categoryValues" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "values" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "status" varchar(32) NOT NULL DEFAULT 'NOT_STARTED',
        "progressPercent" numeric(5,2) NOT NULL DEFAULT 0,
        "remarks" text,
        "createdByUserId" integer,
        "updatedByUserId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "planning_custom_tracker_fields"
        ADD CONSTRAINT "UQ_planning_custom_tracker_fields_tracker_key"
        UNIQUE ("trackerId", "key")
    `);
    await queryRunner.query(`
      ALTER TABLE "planning_custom_tracker_fields"
        ADD CONSTRAINT "FK_planning_custom_tracker_fields_tracker"
        FOREIGN KEY ("trackerId") REFERENCES "planning_custom_trackers"("id")
        ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "planning_custom_tracker_records"
        ADD CONSTRAINT "FK_planning_custom_tracker_records_tracker"
        FOREIGN KEY ("trackerId") REFERENCES "planning_custom_trackers"("id")
        ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_planning_custom_trackers_project_status"
      ON "planning_custom_trackers" ("projectId", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_planning_custom_tracker_fields_tracker_sequence"
      ON "planning_custom_tracker_fields" ("trackerId", "sequence")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_planning_custom_tracker_records_tracker_status"
      ON "planning_custom_tracker_records" ("trackerId", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_planning_custom_tracker_records_project_location"
      ON "planning_custom_tracker_records" ("projectId", "epsNodeId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_planning_custom_tracker_records_values_gin"
      ON "planning_custom_tracker_records" USING GIN ("values")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_planning_custom_tracker_records_categories_gin"
      ON "planning_custom_tracker_records" USING GIN ("categoryValues")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_planning_custom_tracker_records_categories_gin"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_planning_custom_tracker_records_values_gin"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_planning_custom_tracker_records_project_location"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_planning_custom_tracker_records_tracker_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_planning_custom_tracker_fields_tracker_sequence"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_planning_custom_trackers_project_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "planning_custom_tracker_records"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "planning_custom_tracker_fields"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "planning_custom_trackers"`);
  }
}
