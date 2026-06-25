import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddObservationClosureAudit1771700000011
  implements MigrationInterface
{
  name = 'AddObservationClosureAudit1771700000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "activity_observations"
      ADD COLUMN IF NOT EXISTS "closedBy" text,
      ADD COLUMN IF NOT EXISTS "closedAt" timestamp
    `);
    await queryRunner.query(`
      UPDATE "activity_observations"
      SET
        "closedBy" = COALESCE("closedBy", "resolvedBy"),
        "closedAt" = COALESCE("closedAt", "resolvedAt")
      WHERE "status"::text = 'CLOSED'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "activity_observations"
      DROP COLUMN IF EXISTS "closedAt",
      DROP COLUMN IF EXISTS "closedBy"
    `);
  }
}
