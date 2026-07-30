import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBatchSlipFieldSynonyms1780400000000
  implements MigrationInterface
{
  name = 'AddBatchSlipFieldSynonyms1780400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quality_batch_slip_field_synonyms" (
        "id" SERIAL NOT NULL,
        "projectId" integer,
        "fieldKey" character varying(40) NOT NULL,
        "label" character varying(60) NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdByUserId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quality_batch_slip_field_synonyms" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quality_batch_slip_synonyms_project_field"
      ON "quality_batch_slip_field_synonyms" ("projectId", "fieldKey")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_quality_batch_slip_synonyms_project_label"
      ON "quality_batch_slip_field_synonyms" ("projectId", "fieldKey", lower("label"))
      WHERE "projectId" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_quality_batch_slip_synonyms_global_label"
      ON "quality_batch_slip_field_synonyms" ("fieldKey", lower("label"))
      WHERE "projectId" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "quality_batch_slip_field_synonyms"
      ADD CONSTRAINT "FK_quality_batch_slip_synonyms_project"
      FOREIGN KEY ("projectId") REFERENCES "eps_node"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "quality_batch_slip_field_synonyms"
      ADD CONSTRAINT "FK_quality_batch_slip_synonyms_created_by"
      FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "quality_batch_slip_field_synonyms"
      DROP CONSTRAINT IF EXISTS "FK_quality_batch_slip_synonyms_created_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "quality_batch_slip_field_synonyms"
      DROP CONSTRAINT IF EXISTS "FK_quality_batch_slip_synonyms_project"
    `);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_quality_batch_slip_synonyms_global_label"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_quality_batch_slip_synonyms_project_label"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_quality_batch_slip_synonyms_project_field"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "quality_batch_slip_field_synonyms"`,
    );
  }
}
