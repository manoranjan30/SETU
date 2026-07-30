import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSnagFinalClosureSignature1780700000000
  implements MigrationInterface
{
  name = 'AddSnagFinalClosureSignature1780700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "snag_round"
      ADD COLUMN IF NOT EXISTS "final_closure_signed_at" timestamp
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_round"
      ADD COLUMN IF NOT EXISTS "final_closure_signed_by_id" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_round"
      ADD COLUMN IF NOT EXISTS "final_closure_signature_data" text
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_round"
      ADD COLUMN IF NOT EXISTS "final_closure_remarks" text
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_snag_round_final_closure_signed_by'
        ) THEN
          ALTER TABLE "snag_round"
          ADD CONSTRAINT "FK_snag_round_final_closure_signed_by"
          FOREIGN KEY ("final_closure_signed_by_id")
          REFERENCES "user"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "snag_round"
      DROP CONSTRAINT IF EXISTS "FK_snag_round_final_closure_signed_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_round"
      DROP COLUMN IF EXISTS "final_closure_remarks"
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_round"
      DROP COLUMN IF EXISTS "final_closure_signature_data"
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_round"
      DROP COLUMN IF EXISTS "final_closure_signed_by_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_round"
      DROP COLUMN IF EXISTS "final_closure_signed_at"
    `);
  }
}
