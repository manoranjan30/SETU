import { MigrationInterface, QueryRunner } from 'typeorm';

export class TuneSnagReadyAndNotSatisfactory1780500000000
  implements MigrationInterface
{
  name = 'TuneSnagReadyAndNotSatisfactory1780500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'snag_list_status') THEN
          ALTER TYPE "snag_list_status" ADD VALUE IF NOT EXISTS 'ready_for_snag';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "snag_item"
      ADD COLUMN IF NOT EXISTS "not_satisfactory_count" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_item"
      ADD COLUMN IF NOT EXISTS "last_not_satisfactory_remarks" text
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_item"
      ADD COLUMN IF NOT EXISTS "last_not_satisfactory_at" TIMESTAMP
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_item"
      ADD COLUMN IF NOT EXISTS "last_not_satisfactory_by_id" integer
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_snag_item_last_not_satisfactory_by'
        ) THEN
          ALTER TABLE "snag_item"
          ADD CONSTRAINT "FK_snag_item_last_not_satisfactory_by"
          FOREIGN KEY ("last_not_satisfactory_by_id") REFERENCES "user"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "snag_item"
      DROP CONSTRAINT IF EXISTS "FK_snag_item_last_not_satisfactory_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_item" DROP COLUMN IF EXISTS "last_not_satisfactory_by_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_item" DROP COLUMN IF EXISTS "last_not_satisfactory_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_item" DROP COLUMN IF EXISTS "last_not_satisfactory_remarks"
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_item" DROP COLUMN IF EXISTS "not_satisfactory_count"
    `);
  }
}
