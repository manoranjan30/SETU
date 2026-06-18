import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddObservationSearchIndexes1771700000003
  implements MigrationInterface
{
  name = 'AddObservationSearchIndexes1771700000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ehs_observations_search_text"
      ON "ehs_observations"
      USING gin (
        (LOWER(COALESCE("description", '') || ' ' || COALESCE("category", '') || ' ' || COALESCE("locationLabel", '')))
        gin_trgm_ops
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_site_observations_search_text"
      ON "site_observations"
      USING gin (
        (LOWER(COALESCE("description", '') || ' ' || COALESCE("category", '') || ' ' || COALESCE("locationLabel", '')))
        gin_trgm_ops
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_eps_node_name_trgm"
      ON "eps_node"
      USING gin (LOWER("name") gin_trgm_ops)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_eps_node_name_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_site_observations_search_text"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ehs_observations_search_text"`);
  }
}
