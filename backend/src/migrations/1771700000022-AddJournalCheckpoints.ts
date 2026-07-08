import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddJournalCheckpoints1771700000022 implements MigrationInterface {
  name = 'AddJournalCheckpoints1771700000022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "site_journal_entries"
      ADD COLUMN IF NOT EXISTS "checkpoints" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "site_journal_entries"
      DROP COLUMN IF EXISTS "checkpoints"
    `);
  }
}
