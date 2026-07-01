import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAdminDataCorrections1771700000013
  implements MigrationInterface
{
  name = 'CreateAdminDataCorrections1771700000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'admin_data_corrections_actiontype_enum'
        ) THEN
          CREATE TYPE "admin_data_corrections_actiontype_enum"
          AS ENUM ('UPDATE', 'REVERT');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_data_corrections" (
        "id" SERIAL PRIMARY KEY,
        "tableName" varchar(128) NOT NULL,
        "primaryKeyColumn" varchar(128) NOT NULL,
        "primaryKeyValue" text NOT NULL,
        "actionType" "admin_data_corrections_actiontype_enum" NOT NULL DEFAULT 'UPDATE',
        "beforeData" jsonb NOT NULL,
        "afterData" jsonb NOT NULL,
        "changedFields" jsonb NOT NULL,
        "reason" text NOT NULL,
        "revertedFromCorrectionId" integer,
        "createdByUserId" integer,
        "createdByName" varchar(255),
        "ipAddress" varchar(100),
        "userAgent" text,
        "createdAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_admin_data_corrections_target"
      ON "admin_data_corrections" ("tableName", "primaryKeyValue", "createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_admin_data_corrections_user"
      ON "admin_data_corrections" ("createdByUserId", "createdAt" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_admin_data_corrections_user"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_admin_data_corrections_target"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_data_corrections"`);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'admin_data_corrections_actiontype_enum'
        ) THEN
          DROP TYPE "admin_data_corrections_actiontype_enum";
        END IF;
      END $$;
    `);
  }
}
