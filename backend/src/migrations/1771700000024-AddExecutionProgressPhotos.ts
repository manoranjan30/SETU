import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExecutionProgressPhotos1771700000024 implements MigrationInterface {
  name = 'AddExecutionProgressPhotos1771700000024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "execution_progress_entry"
      ADD COLUMN IF NOT EXISTS "photoUrls" text[] NOT NULL DEFAULT ARRAY[]::text[]
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "execution_progress_entry"
      DROP COLUMN IF EXISTS "photoUrls"
    `);
  }
}
