import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSnagItemVendor1781200000000 implements MigrationInterface {
  name = 'AddSnagItemVendor1781200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "snag_item"
      ADD COLUMN IF NOT EXISTS "vendor_id" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_item"
      ADD COLUMN IF NOT EXISTS "vendor_name" character varying(255)
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_snag_item_vendor'
        ) THEN
          ALTER TABLE "snag_item"
          ADD CONSTRAINT "FK_snag_item_vendor"
          FOREIGN KEY ("vendor_id")
          REFERENCES "vendors"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_snag_item_vendor"
      ON "snag_item" ("vendor_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_snag_item_vendor"`);
    await queryRunner.query(`
      ALTER TABLE "snag_item"
      DROP CONSTRAINT IF EXISTS "FK_snag_item_vendor"
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_item"
      DROP COLUMN IF EXISTS "vendor_name"
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_item"
      DROP COLUMN IF EXISTS "vendor_id"
    `);
  }
}
