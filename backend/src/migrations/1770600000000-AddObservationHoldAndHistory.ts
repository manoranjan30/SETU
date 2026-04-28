import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddObservationHoldAndHistory1770600000000
  implements MigrationInterface
{
  name = 'AddObservationHoldAndHistory1770600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "site_observations_status_enum" ADD VALUE IF NOT EXISTS 'HELD'`,
    );
    await queryRunner.query(
      `ALTER TYPE "ehs_observations_status_enum" ADD VALUE IF NOT EXISTS 'HELD'`,
    );

    await queryRunner.query(
      `ALTER TABLE "site_observations" ADD COLUMN IF NOT EXISTS "rectificationHistory" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "site_observations" ADD COLUMN IF NOT EXISTS "holdReason" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "site_observations" ADD COLUMN IF NOT EXISTS "holdStartedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "site_observations" ADD COLUMN IF NOT EXISTS "holdAccumulatedMinutes" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "site_observations" ADD COLUMN IF NOT EXISTS "heldById" text`,
    );

    await queryRunner.query(
      `ALTER TABLE "ehs_observations" ADD COLUMN IF NOT EXISTS "rectificationHistory" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "ehs_observations" ADD COLUMN IF NOT EXISTS "holdReason" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "ehs_observations" ADD COLUMN IF NOT EXISTS "holdStartedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "ehs_observations" ADD COLUMN IF NOT EXISTS "holdAccumulatedMinutes" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "ehs_observations" ADD COLUMN IF NOT EXISTS "heldById" text`,
    );

    await queryRunner.query(
      `ALTER TABLE "activity_observations" ADD COLUMN IF NOT EXISTS "rectificationHistory" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "activity_observations" DROP COLUMN IF EXISTS "rectificationHistory"`,
    );

    await queryRunner.query(
      `ALTER TABLE "ehs_observations" DROP COLUMN IF EXISTS "heldById"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ehs_observations" DROP COLUMN IF EXISTS "holdAccumulatedMinutes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ehs_observations" DROP COLUMN IF EXISTS "holdStartedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ehs_observations" DROP COLUMN IF EXISTS "holdReason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ehs_observations" DROP COLUMN IF EXISTS "rectificationHistory"`,
    );

    await queryRunner.query(
      `ALTER TABLE "site_observations" DROP COLUMN IF EXISTS "heldById"`,
    );
    await queryRunner.query(
      `ALTER TABLE "site_observations" DROP COLUMN IF EXISTS "holdAccumulatedMinutes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "site_observations" DROP COLUMN IF EXISTS "holdStartedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "site_observations" DROP COLUMN IF EXISTS "holdReason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "site_observations" DROP COLUMN IF EXISTS "rectificationHistory"`,
    );
  }
}
