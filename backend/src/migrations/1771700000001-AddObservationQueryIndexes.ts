import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddObservationQueryIndexes1771700000001
  implements MigrationInterface
{
  name = 'AddObservationQueryIndexes1771700000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ehs_observations_project_status_created"
      ON "ehs_observations" ("projectId", "status", "createdAt" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ehs_observations_project_severity_created"
      ON "ehs_observations" ("projectId", "severity", "createdAt" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_site_observations_project_status_created"
      ON "site_observations" ("projectId", "status", "createdAt" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_site_observations_project_severity_created"
      ON "site_observations" ("projectId", "severity", "createdAt" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_site_observations_project_severity_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_site_observations_project_status_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ehs_observations_project_severity_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ehs_observations_project_status_created"`,
    );
  }
}
