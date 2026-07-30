import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSnagPhotoRequirementConfig1780600000000
  implements MigrationInterface
{
  name = 'AddSnagPhotoRequirementConfig1780600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "snag_process_step"
      ADD COLUMN IF NOT EXISTS "raise_photo_required" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_process_step"
      ADD COLUMN IF NOT EXISTS "rectification_photo_required" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_process_step"
      ADD COLUMN IF NOT EXISTS "desnag_completion_photo_required" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "snag_process_step"
      DROP COLUMN IF EXISTS "desnag_completion_photo_required"
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_process_step"
      DROP COLUMN IF EXISTS "rectification_photo_required"
    `);
    await queryRunner.query(`
      ALTER TABLE "snag_process_step"
      DROP COLUMN IF EXISTS "raise_photo_required"
    `);
  }
}
