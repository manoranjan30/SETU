import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomFeaturesToBuildingLineCoordinates1710903000000
  implements MigrationInterface
{
  name = 'AddCustomFeaturesToBuildingLineCoordinates1710903000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "building_line_coordinates" ADD COLUMN IF NOT EXISTS "customFeatures" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "building_line_coordinates" DROP COLUMN IF EXISTS "customFeatures"`,
    );
  }
}
