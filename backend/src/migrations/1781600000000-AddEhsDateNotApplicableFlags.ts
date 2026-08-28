import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEhsDateNotApplicableFlags1781600000000
  implements MigrationInterface
{
  name = 'AddEhsDateNotApplicableFlags1781600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ehs_legal_registers"
      ADD COLUMN IF NOT EXISTS "certifiedDateNotApplicable" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "expiryDateNotApplicable" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "ehs_machineries"
      ADD COLUMN IF NOT EXISTS "certifiedDateNotApplicable" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "expiryDateNotApplicable" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "ehs_vehicles"
      ADD COLUMN IF NOT EXISTS "fitnessCertDateNotApplicable" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "insuranceDateNotApplicable" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "pollutionDateNotApplicable" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ehs_vehicles"
      DROP COLUMN IF EXISTS "pollutionDateNotApplicable",
      DROP COLUMN IF EXISTS "insuranceDateNotApplicable",
      DROP COLUMN IF EXISTS "fitnessCertDateNotApplicable"
    `);
    await queryRunner.query(`
      ALTER TABLE "ehs_machineries"
      DROP COLUMN IF EXISTS "expiryDateNotApplicable",
      DROP COLUMN IF EXISTS "certifiedDateNotApplicable"
    `);
    await queryRunner.query(`
      ALTER TABLE "ehs_legal_registers"
      DROP COLUMN IF EXISTS "expiryDateNotApplicable",
      DROP COLUMN IF EXISTS "certifiedDateNotApplicable"
    `);
  }
}
