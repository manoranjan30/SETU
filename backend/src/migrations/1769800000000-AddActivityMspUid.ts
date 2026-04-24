import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActivityMspUid1769800000000 implements MigrationInterface {
  name = 'AddActivityMspUid1769800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "activity"
      ADD COLUMN IF NOT EXISTS "mspUid" varchar
    `);

    await queryRunner.query(`
      UPDATE "activity"
      SET "mspUid" = "id"::text
      WHERE "mspUid" IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_activity_project_mspuid"
      ON "activity" ("projectId", "mspUid")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_activity_project_mspuid"`,
    );
    await queryRunner.query(`
      ALTER TABLE "activity"
      DROP COLUMN IF EXISTS "mspUid"
    `);
  }
}
