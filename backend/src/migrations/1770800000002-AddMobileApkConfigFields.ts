import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMobileApkConfigFields1770800000002
  implements MigrationInterface
{
  name = 'AddMobileApkConfigFields1770800000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('app_config'))) {
      return;
    }

    await queryRunner.query(`
      ALTER TABLE "app_config"
      ADD COLUMN IF NOT EXISTS "apkFileName" text
    `);
    await queryRunner.query(`
      ALTER TABLE "app_config"
      ADD COLUMN IF NOT EXISTS "apkOriginalName" text
    `);
    await queryRunner.query(`
      ALTER TABLE "app_config"
      ADD COLUMN IF NOT EXISTS "apkFileSize" bigint
    `);
    await queryRunner.query(`
      ALTER TABLE "app_config"
      ADD COLUMN IF NOT EXISTS "apkUploadedAt" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('app_config'))) {
      return;
    }

    await queryRunner.query(`
      ALTER TABLE "app_config"
      DROP COLUMN IF EXISTS "apkUploadedAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "app_config"
      DROP COLUMN IF EXISTS "apkFileSize"
    `);
    await queryRunner.query(`
      ALTER TABLE "app_config"
      DROP COLUMN IF EXISTS "apkOriginalName"
    `);
    await queryRunner.query(`
      ALTER TABLE "app_config"
      DROP COLUMN IF EXISTS "apkFileName"
    `);
  }
}
