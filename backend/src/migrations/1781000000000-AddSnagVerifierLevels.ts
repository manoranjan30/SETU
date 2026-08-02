import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSnagVerifierLevels1781000000000
  implements MigrationInterface
{
  name = 'AddSnagVerifierLevels1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "snag_round"
      ADD COLUMN IF NOT EXISTS "current_verifier_level" integer NOT NULL DEFAULT 1
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_round"
      ADD COLUMN IF NOT EXISTS "current_verifier_level_name" character varying(255)
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_round"
      ADD COLUMN IF NOT EXISTS "level_status" character varying(40) NOT NULL DEFAULT 'ready_pending'
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_round"
      ADD COLUMN IF NOT EXISTS "level_closed_at" timestamp
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_round"
      ADD COLUMN IF NOT EXISTS "level_closed_by_id" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_round"
      ADD COLUMN IF NOT EXISTS "level_closure_signature_data" text
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_snag_round_level_closed_by'
        ) THEN
          ALTER TABLE "snag_round"
          ADD CONSTRAINT "FK_snag_round_level_closed_by"
          FOREIGN KEY ("level_closed_by_id")
          REFERENCES "user"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "snag_item"
      ADD COLUMN IF NOT EXISTS "verifier_level_order" integer NOT NULL DEFAULT 1
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_item"
      ADD COLUMN IF NOT EXISTS "verifier_level_name" character varying(255)
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_item"
      ADD COLUMN IF NOT EXISTS "raised_by_verifier_user_id" integer
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_snag_item_raised_by_verifier'
        ) THEN
          ALTER TABLE "snag_item"
          ADD CONSTRAINT "FK_snag_item_raised_by_verifier"
          FOREIGN KEY ("raised_by_verifier_user_id")
          REFERENCES "user"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "snag_round_level_closure" (
        "id" SERIAL NOT NULL,
        "snag_round_id" integer NOT NULL,
        "level_order" integer NOT NULL,
        "level_name" character varying(255) NOT NULL,
        "closed_by_id" integer,
        "closed_at" timestamp,
        "signature_data" text,
        "remarks" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_snag_round_level_closure" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_snag_round_level_closure_round_level" UNIQUE ("snag_round_id", "level_order"),
        CONSTRAINT "FK_snag_round_level_closure_round" FOREIGN KEY ("snag_round_id") REFERENCES "snag_round"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_snag_round_level_closure_closed_by" FOREIGN KEY ("closed_by_id") REFERENCES "user"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_snag_item_round_level_status"
      ON "snag_item" ("snag_round_id", "verifier_level_order", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_snag_item_round_level_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "snag_round_level_closure"`);
    await queryRunner.query(`
      ALTER TABLE "snag_item"
      DROP CONSTRAINT IF EXISTS "FK_snag_item_raised_by_verifier"
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_item"
      DROP COLUMN IF EXISTS "raised_by_verifier_user_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_item"
      DROP COLUMN IF EXISTS "verifier_level_name"
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_item"
      DROP COLUMN IF EXISTS "verifier_level_order"
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_round"
      DROP CONSTRAINT IF EXISTS "FK_snag_round_level_closed_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_round"
      DROP COLUMN IF EXISTS "level_closure_signature_data"
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_round"
      DROP COLUMN IF EXISTS "level_closed_by_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_round"
      DROP COLUMN IF EXISTS "level_closed_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_round"
      DROP COLUMN IF EXISTS "level_status"
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_round"
      DROP COLUMN IF EXISTS "current_verifier_level_name"
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_round"
      DROP COLUMN IF EXISTS "current_verifier_level"
    `);
  }
}
