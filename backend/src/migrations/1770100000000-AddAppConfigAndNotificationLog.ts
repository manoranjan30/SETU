import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAppConfigAndNotificationLog1770100000000
  implements MigrationInterface
{
  name = 'AddAppConfigAndNotificationLog1770100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "app_config" (
        "id"             SERIAL NOT NULL,
        "platform"       character varying NOT NULL DEFAULT 'android',
        "latestVersion"  character varying NOT NULL DEFAULT '1.0.0',
        "minimumVersion" character varying NOT NULL DEFAULT '1.0.0',
        "forceUpdate"    boolean NOT NULL DEFAULT false,
        "updateMessage"  text,
        "updateUrl"      text,
        "updatedAt"      TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_app_config_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_app_config_platform" UNIQUE ("platform")
      )
    `);

    // Seed default rows so the endpoint works immediately after migration
    await queryRunner.query(`
      INSERT INTO "app_config" ("platform") VALUES ('android')
      ON CONFLICT ("platform") DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO "app_config" ("platform") VALUES ('ios')
      ON CONFLICT ("platform") DO NOTHING
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_log" (
        "id"             SERIAL NOT NULL,
        "type"           character varying NOT NULL,
        "projectId"      integer,
        "permissionCode" character varying,
        "roleId"         integer,
        "recipientCount" integer NOT NULL DEFAULT 0,
        "successCount"   integer NOT NULL DEFAULT 0,
        "failureCount"   integer NOT NULL DEFAULT 0,
        "failedTokens"   jsonb,
        "sentAt"         TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_log_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notification_log_project"
      ON "notification_log" ("projectId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notification_log_sent_at"
      ON "notification_log" ("sentAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_notification_log_sent_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_notification_log_project"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_log"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "app_config"`);
  }
}
