import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhanceSnagWorkflowForRealWorldOps1711301000000
  implements MigrationInterface
{
  name = 'EnhanceSnagWorkflowForRealWorldOps1711301000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasSnagList = await queryRunner.hasTable('snag_list');
    const hasSnagItem = await queryRunner.hasTable('snag_item');

    if (hasSnagList) {
    await queryRunner.query(`
      ALTER TABLE snag_list
      ADD COLUMN IF NOT EXISTS common_checklist jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
    }

    if (hasSnagItem) {
    await queryRunner.query(`
      ALTER TABLE snag_item
      ADD COLUMN IF NOT EXISTS rectification_notes TEXT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE snag_item
      ADD COLUMN IF NOT EXISTS closure_remarks TEXT NULL
    `);
    }

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_enum
          WHERE enumlabel = 'closure'
            AND enumtypid = 'snag_photo_type'::regtype
        ) THEN
          ALTER TYPE snag_photo_type ADD VALUE 'closure';
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('snag_photo')) {
      await queryRunner.query(`
        UPDATE snag_photo
        SET type = 'after'
        WHERE type = 'closure'
      `);

      await queryRunner.query(`
        ALTER TABLE snag_photo
        ALTER COLUMN type TYPE text
      `);

      await queryRunner.query(`DROP TYPE IF EXISTS snag_photo_type`);
      await queryRunner.query(`
        CREATE TYPE snag_photo_type AS ENUM ('before', 'after')
      `);

      await queryRunner.query(`
        ALTER TABLE snag_photo
        ALTER COLUMN type TYPE snag_photo_type
        USING type::snag_photo_type
      `);
    }

    if (await queryRunner.hasTable('snag_item')) {
      await queryRunner.query(`
        ALTER TABLE snag_item
        DROP COLUMN IF EXISTS closure_remarks
      `);

      await queryRunner.query(`
        ALTER TABLE snag_item
        DROP COLUMN IF EXISTS rectification_notes
      `);
    }

    if (await queryRunner.hasTable('snag_list')) {
      await queryRunner.query(`
        ALTER TABLE snag_list
        DROP COLUMN IF EXISTS common_checklist
      `);
    }
  }
}
