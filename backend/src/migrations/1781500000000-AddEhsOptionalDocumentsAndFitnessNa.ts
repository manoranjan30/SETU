import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEhsOptionalDocumentsAndFitnessNa1781500000000
  implements MigrationInterface
{
  name = 'AddEhsOptionalDocumentsAndFitnessNa1781500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ehs_legal_registers"
      ADD COLUMN IF NOT EXISTS "documentNumber" character varying(120),
      ADD COLUMN IF NOT EXISTS "documentUrl" text,
      ADD COLUMN IF NOT EXISTS "documentOriginalName" text,
      ADD COLUMN IF NOT EXISTS "documentMimeType" character varying(120),
      ADD COLUMN IF NOT EXISTS "documentSize" bigint
    `);
    await queryRunner.query(`
      ALTER TABLE "ehs_machineries"
      ADD COLUMN IF NOT EXISTS "documentUrl" text,
      ADD COLUMN IF NOT EXISTS "documentOriginalName" text,
      ADD COLUMN IF NOT EXISTS "documentMimeType" character varying(120),
      ADD COLUMN IF NOT EXISTS "documentSize" bigint
    `);
    await queryRunner.query(`
      ALTER TABLE "ehs_vehicles"
      ADD COLUMN IF NOT EXISTS "documentUrl" text,
      ADD COLUMN IF NOT EXISTS "documentOriginalName" text,
      ADD COLUMN IF NOT EXISTS "documentMimeType" character varying(120),
      ADD COLUMN IF NOT EXISTS "documentSize" bigint
    `);
    await queryRunner.query(`
      ALTER TABLE "ehs_competencies"
      ADD COLUMN IF NOT EXISTS "fitnessExpiryNotApplicable" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "documentUrl" text,
      ADD COLUMN IF NOT EXISTS "documentOriginalName" text,
      ADD COLUMN IF NOT EXISTS "documentMimeType" character varying(120),
      ADD COLUMN IF NOT EXISTS "documentSize" bigint
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ehs_competencies"
      DROP COLUMN IF EXISTS "documentSize",
      DROP COLUMN IF EXISTS "documentMimeType",
      DROP COLUMN IF EXISTS "documentOriginalName",
      DROP COLUMN IF EXISTS "documentUrl",
      DROP COLUMN IF EXISTS "fitnessExpiryNotApplicable"
    `);
    await queryRunner.query(`
      ALTER TABLE "ehs_vehicles"
      DROP COLUMN IF EXISTS "documentSize",
      DROP COLUMN IF EXISTS "documentMimeType",
      DROP COLUMN IF EXISTS "documentOriginalName",
      DROP COLUMN IF EXISTS "documentUrl"
    `);
    await queryRunner.query(`
      ALTER TABLE "ehs_machineries"
      DROP COLUMN IF EXISTS "documentSize",
      DROP COLUMN IF EXISTS "documentMimeType",
      DROP COLUMN IF EXISTS "documentOriginalName",
      DROP COLUMN IF EXISTS "documentUrl"
    `);
    await queryRunner.query(`
      ALTER TABLE "ehs_legal_registers"
      DROP COLUMN IF EXISTS "documentSize",
      DROP COLUMN IF EXISTS "documentMimeType",
      DROP COLUMN IF EXISTS "documentOriginalName",
      DROP COLUMN IF EXISTS "documentUrl",
      DROP COLUMN IF EXISTS "documentNumber"
    `);
  }
}
