import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExportPresetsAndHistory1771700000002
  implements MigrationInterface
{
  name = 'AddExportPresetsAndHistory1771700000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "export_presets" (
        "id" SERIAL PRIMARY KEY,
        "userId" integer NOT NULL,
        "module" text NOT NULL,
        "tableKey" text NOT NULL,
        "name" text NOT NULL,
        "filters" jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_export_presets_user_scope_name"
          UNIQUE ("userId", "module", "tableKey", "name")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_export_presets_user_scope"
      ON "export_presets" ("userId", "module", "tableKey", "updatedAt" DESC)
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "export_history" (
        "id" SERIAL PRIMARY KEY,
        "module" text NOT NULL,
        "exportType" text NOT NULL,
        "projectId" integer NULL,
        "status" text NOT NULL,
        "recipientCount" integer NOT NULL DEFAULT 0,
        "fileName" text NULL,
        "dateFrom" date NULL,
        "dateTo" date NULL,
        "errorMessage" text NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_export_history_module_created"
      ON "export_history" ("module", "createdAt" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_export_history_module_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "export_history"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_export_presets_user_scope"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "export_presets"`);
  }
}
