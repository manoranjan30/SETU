import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBuildingLineCoordinates1710800000000
  implements MigrationInterface
{
  name = 'CreateBuildingLineCoordinates1710800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('eps_node'))) {
      return;
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS building_line_coordinates (
        id SERIAL PRIMARY KEY,
        "projectId" integer NOT NULL,
        "epsNodeId" integer NOT NULL,
        "coordinatesText" text,
        "heightMeters" numeric(12,3),
        "structureSnapshot" jsonb,
        "updatedByUserId" integer,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_building_line_coordinates_project_eps"
      ON building_line_coordinates ("projectId", "epsNodeId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_building_line_coordinates_epsNodeId"
      ON building_line_coordinates ("epsNodeId")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_building_line_coordinates_epsNodeId'
            AND table_name = 'building_line_coordinates'
        ) THEN
          ALTER TABLE building_line_coordinates
          ADD CONSTRAINT "FK_building_line_coordinates_epsNodeId"
          FOREIGN KEY ("epsNodeId")
          REFERENCES "eps_node"(id)
          ON DELETE CASCADE;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE building_line_coordinates
      DROP CONSTRAINT IF EXISTS "FK_building_line_coordinates_epsNodeId"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_building_line_coordinates_epsNodeId"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_building_line_coordinates_project_eps"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS building_line_coordinates
    `);
  }
}
