import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCoordinateUomToBuildingLineCoordinates1769260000000
  implements MigrationInterface
{
  name = 'AddCoordinateUomToBuildingLineCoordinates1769260000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "building_line_coordinates"
      ADD COLUMN IF NOT EXISTS "coordinateUom" varchar(16) NOT NULL DEFAULT 'mm'
    `);
    await queryRunner.query(`
      UPDATE "building_line_coordinates"
      SET "coordinateUom" = 'mm'
      WHERE "coordinateUom" IS NULL OR trim("coordinateUom") = ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "building_line_coordinates"
      DROP COLUMN IF EXISTS "coordinateUom"
    `);
  }
}
