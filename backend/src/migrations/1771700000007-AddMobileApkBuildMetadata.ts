import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMobileApkBuildMetadata1771700000007
  implements MigrationInterface
{
  name = 'AddMobileApkBuildMetadata1771700000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "app_config"
      ADD COLUMN IF NOT EXISTS "apkBuildNumber" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "app_config"
      ADD COLUMN IF NOT EXISTS "apkVersionName" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "app_config"
      DROP COLUMN IF EXISTS "apkVersionName"
    `);
    await queryRunner.query(`
      ALTER TABLE "app_config"
      DROP COLUMN IF EXISTS "apkBuildNumber"
    `);
  }
}
