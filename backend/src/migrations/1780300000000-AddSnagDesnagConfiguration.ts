import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSnagDesnagConfiguration1780300000000
  implements MigrationInterface
{
  name = 'AddSnagDesnagConfiguration1780300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "snag_process_step" (
        "id" SERIAL NOT NULL,
        "project_id" integer NOT NULL,
        "name" character varying(120) NOT NULL,
        "description" text,
        "workflow_serial_no" integer NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_snag_process_step" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_snag_process_step_project_serial" UNIQUE ("project_id", "workflow_serial_no")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "snag_process_activity" (
        "id" SERIAL NOT NULL,
        "project_id" integer NOT NULL,
        "process_step_id" integer NOT NULL,
        "activity_id" integer NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_snag_process_activity" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_snag_process_activity_project_activity" UNIQUE ("project_id", "activity_id"),
        CONSTRAINT "FK_snag_process_activity_step" FOREIGN KEY ("process_step_id") REFERENCES "snag_process_step"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_snag_process_activity_activity" FOREIGN KEY ("activity_id") REFERENCES "quality_activity"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_snag_process_activity_step_order"
      ON "snag_process_activity" ("process_step_id", "sort_order")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "snag_common_point" (
        "id" SERIAL NOT NULL,
        "project_id" integer NOT NULL,
        "process_activity_id" integer NOT NULL,
        "activity_id" integer NOT NULL,
        "title" character varying(255) NOT NULL,
        "description" text,
        "severity" character varying(40) NOT NULL DEFAULT 'medium',
        "requires_evidence" boolean NOT NULL DEFAULT false,
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_snag_common_point" PRIMARY KEY ("id"),
        CONSTRAINT "FK_snag_common_point_process_activity" FOREIGN KEY ("process_activity_id") REFERENCES "snag_process_activity"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_snag_common_point_activity" FOREIGN KEY ("activity_id") REFERENCES "quality_activity"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_snag_common_point_process_activity_order"
      ON "snag_common_point" ("process_activity_id", "sort_order")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_snag_common_point_process_activity_order"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "snag_common_point"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_snag_process_activity_step_order"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "snag_process_activity"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "snag_process_step"`);
  }
}
