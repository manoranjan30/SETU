import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQualityInspectionLocationPath1771700000014
  implements MigrationInterface
{
  name = 'AddQualityInspectionLocationPath1771700000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "quality_inspections"
      ADD COLUMN IF NOT EXISTS "location_path" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "quality_inspections"
      DROP COLUMN IF EXISTS "location_path"
    `);
  }
}
