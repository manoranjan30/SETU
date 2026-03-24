import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateDrawingRegisterStatusEnum1769250000000
  implements MigrationInterface
{
  name = 'UpdateDrawingRegisterStatusEnum1769250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "drawing_register_status_enum" ADD VALUE IF NOT EXISTS 'ON_HOLD'
    `);
    await queryRunner.query(`
      ALTER TYPE "drawing_register_status_enum" ADD VALUE IF NOT EXISTS 'SUPERSEDED'
    `);
    await queryRunner.query(`
      ALTER TYPE "drawing_register_status_enum" ADD VALUE IF NOT EXISTS 'ACTIVE_GFC'
    `);
    await queryRunner.query(`
      ALTER TYPE "drawing_register_status_enum" ADD VALUE IF NOT EXISTS 'ADVANCE_COPY'
    `);
    await queryRunner.query(`
      ALTER TYPE "drawing_register_status_enum" ADD VALUE IF NOT EXISTS 'REFERENCE_ONLY'
    `);

    await queryRunner.query(`
      ALTER TABLE "drawing_register"
      ADD COLUMN IF NOT EXISTS "statusUpdatedAt" TIMESTAMP
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "drawing_open_receipt" (
        "id" SERIAL NOT NULL,
        "registerId" integer NOT NULL,
        "userId" integer NOT NULL,
        "lastOpenedRevisionId" integer,
        "openedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_drawing_open_receipt_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_drawing_open_receipt_register_user" UNIQUE ("registerId", "userId"),
        CONSTRAINT "FK_drawing_open_receipt_register" FOREIGN KEY ("registerId") REFERENCES "drawing_register"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_drawing_open_receipt_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      UPDATE "drawing_register"
      SET "statusUpdatedAt" = COALESCE("statusUpdatedAt", "updatedAt")
      WHERE "statusUpdatedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "drawing_open_receipt"
    `);

    await queryRunner.query(`
      ALTER TABLE "drawing_register"
      DROP COLUMN IF EXISTS "statusUpdatedAt"
    `);
  }
}
