import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSnagRoundSkipMetadata1711302000000
  implements MigrationInterface
{
  name = 'AddSnagRoundSkipMetadata1711302000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE snag_round
      ADD COLUMN IF NOT EXISTS is_skipped boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE snag_round
      ADD COLUMN IF NOT EXISTS skipped_at TIMESTAMP NULL
    `);

    await queryRunner.query(`
      ALTER TABLE snag_round
      ADD COLUMN IF NOT EXISTS skipped_by_id integer NULL
    `);

    await queryRunner.query(`
      ALTER TABLE snag_round
      ADD COLUMN IF NOT EXISTS skip_reason TEXT NULL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_snag_round_skipped_by_user'
        ) THEN
          ALTER TABLE snag_round
          ADD CONSTRAINT FK_snag_round_skipped_by_user
          FOREIGN KEY (skipped_by_id) REFERENCES "user"(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE snag_round
      DROP CONSTRAINT IF EXISTS FK_snag_round_skipped_by_user
    `);

    await queryRunner.query(`
      ALTER TABLE snag_round
      DROP COLUMN IF EXISTS skip_reason
    `);

    await queryRunner.query(`
      ALTER TABLE snag_round
      DROP COLUMN IF EXISTS skipped_by_id
    `);

    await queryRunner.query(`
      ALTER TABLE snag_round
      DROP COLUMN IF EXISTS skipped_at
    `);

    await queryRunner.query(`
      ALTER TABLE snag_round
      DROP COLUMN IF EXISTS is_skipped
    `);
  }
}
