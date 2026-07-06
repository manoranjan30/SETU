import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQualityActivityListCacheIndexes1771700000015 implements MigrationInterface {
  name = 'AddQualityActivityListCacheIndexes1771700000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quality_activity_list_project_eps_created"
      ON "quality_activity_list" ("projectId", "epsNodeId", "createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quality_activity_list_sequence"
      ON "quality_activity" ("listId", "sequence", "id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_quality_activity_list_sequence"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_quality_activity_list_project_eps_created"
    `);
  }
}
